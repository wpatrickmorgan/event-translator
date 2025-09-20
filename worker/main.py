#!/usr/bin/env python3
"""
LiveKit Translation Bot Agent (Using Standard AgentSession Pattern)

Uses LiveKit AgentSession for automatic audio management with Google STT/TTS plugins
while keeping Google Translate for accurate translation. RoomIO handles all audio I/O.
"""

import asyncio
import json
import logging
import os
import time
from typing import Optional, Dict, Any, List, Tuple
import numpy as np

from livekit import rtc
from livekit.agents import cli, WorkerOptions, JobContext, AgentSession, Agent, RoomInputOptions
from livekit.plugins import google
from google.cloud import translate_v3 as translate

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TranslationAgent(Agent):
    """Custom translation agent that uses Google Translate instead of LLM"""
    
    def __init__(
        self, 
        primary_lang: str = "en-US",
        translation_targets: List[str] = None,
        audio_targets: List[str] = None,
        **kwargs
    ):
        super().__init__(**kwargs)
        
        # Language configuration
        self.primary_lang = primary_lang
        self.translation_targets = translation_targets or []
        self.audio_targets = audio_targets or []
        
        # Google Translate client (plugins handle STT/TTS)
        self.translate_client: Optional[translate.TranslationServiceClient] = None
        self.gcp_project_id: Optional[str] = None
        
        # Per-language TTS audio tracks
        self.audio_sources: Dict[str, rtc.AudioSource] = {}
        self.published_tracks: Dict[str, rtc.LocalAudioTrack] = {}
        self.tts_queues: Dict[str, asyncio.Queue] = {}
        self.tts_tasks: List[asyncio.Task] = []
        
    async def astart(self, ctx: rtc.Room) -> None:
        """Called when agent starts - set up translation services"""
        await super().astart(ctx)
        
        # Initialize Google Translate
        self.setup_google_translate()
        
        # Set up per-language TTS audio tracks
        if self.audio_targets:
            await self.setup_audio_tracks()
    
    def setup_google_translate(self) -> None:
        """Initialize Google Translate client"""
        try:
            self.translate_client = translate.TranslationServiceClient()
            # Try to get project ID from credentials
            try:
                credentials_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
                if credentials_json:
                    creds = json.loads(credentials_json)
                    self.gcp_project_id = creds.get("project_id")
            except Exception:
                pass
            
            if not self.gcp_project_id:
                logger.warning("GCP project ID not found - translation may not work")
                
            logger.info("Google Translate client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Google Translate client: {e}")
            self.translate_client = None

    async def translate_text(self, text: str, src_lang: str, tgt_lang: str) -> str:
        """Translate text using Google Translate (preserved from original)"""
        if not self.translate_client or not self.gcp_project_id:
            logger.warning("Google Translate not available, returning original text")
            return text
            
        parent = f"projects/{self.gcp_project_id}/locations/global"
        
        def _translate() -> str:
            request = translate.TranslateTextRequest(
                parent=parent,
                contents=[text],
                mime_type="text/plain",
                source_language_code=src_lang,
                target_language_code=tgt_lang,
            )
            response = self.translate_client.translate_text(request=request)
            return response.translations[0].translated_text if response.translations else text
        
        try:
            return await asyncio.to_thread(_translate)
        except Exception as e:
            logger.error(f"Translation error ({src_lang} -> {tgt_lang}): {e}")
            return text

    async def publish_data(self, data_obj: Dict[str, Any]) -> None:
        """Publish JSON to LiveKit data channel (preserved message format)"""
        try:
            data = json.dumps(data_obj).encode('utf-8')
            await self.ctx.room.local_participant.publish_data(data)
        except Exception as e:
            logger.error(f"Error publishing data: {e}")

    async def on_human_speech(self, text: str, *, user_msg) -> None:
        """Called by AgentSession when STT produces final text - this is our main entry point!"""
        logger.info(f"Received speech: {text}")
        
        # Publish original language messages (preserve exact format)
        await self.publish_data({
            "type": "caption",
            "lang": self.primary_lang,
            "text": text,
            "isFinal": True
        })
        
        await self.publish_data({
            "type": "original-language-text",
            "lang": self.primary_lang,
            "text": text,
            "isFinal": True
        })
        
        # Process translations
        await self.process_translations(text)
        
        # Don't call super() - we don't want conversational responses

    async def setup_audio_tracks(self) -> None:
        """Set up audio tracks for TTS output per language"""
        for lang in self.audio_targets:
            try:
                # Create audio source and track for this language
                audio_source = rtc.AudioSource(sample_rate=48000, num_channels=1)
                track = rtc.LocalAudioTrack.create_audio_track(
                    f"translation-audio-{lang}", 
                    audio_source
                )
                
                # Publish the track
                await self.ctx.room.local_participant.publish_track(
                    track, 
                    rtc.TrackPublishOptions(name=f"translation-audio-{lang}")
                )
                
                self.audio_sources[lang] = audio_source
                self.published_tracks[lang] = track
                
                # Set up TTS processing queue for this language
                self.tts_queues[lang] = asyncio.Queue()
                self.tts_tasks.append(
                    asyncio.create_task(self._process_tts_queue(lang))
                )
                
                logger.info(f"Audio track set up for language: {lang}")
                
            except Exception as e:
                logger.error(f"Failed to set up audio track for {lang}: {e}")

    async def _process_tts_queue(self, language: str) -> None:
        """Process TTS requests for a specific language"""
        queue = self.tts_queues[language]
        audio_source = self.audio_sources.get(language)
        
        if not audio_source:
            logger.error(f"No audio source for language: {language}")
            return
            
        while True:
            try:
                text = await queue.get()
                if text is None:  # Shutdown signal
                    break
                    
                # Use plugin for TTS synthesis
                tts_configured = google.TTS(language=language)
                
                # Synthesize audio
                audio_data = await tts_configured.synthesize(text)
                
                # Convert to AudioFrames and publish
                await self._publish_audio_data(audio_source, audio_data)
                
            except Exception as e:
                logger.error(f"TTS processing error for {language}: {e}")

    async def _publish_audio_data(self, audio_source: rtc.AudioSource, audio_data: bytes) -> None:
        """Convert TTS audio data to frames and publish"""
        try:
            # Convert bytes to numpy array (assuming 16-bit PCM)
            int16_data = np.frombuffer(audio_data, dtype=np.int16)
            float32_data = int16_data.astype(np.float32) / 32767.0
            
            # Create audio frames (480 samples per frame for 48kHz)
            frame_samples = 480
            sample_rate = 48000
            channels = 1
            
            for i in range(0, len(float32_data), frame_samples):
                frame_data = float32_data[i:i + frame_samples]
                
                # Pad if necessary
                if len(frame_data) < frame_samples:
                    padded = np.zeros(frame_samples, dtype=np.float32)
                    padded[:len(frame_data)] = frame_data
                    frame_data = padded
                
                # Create and capture frame
                frame = rtc.AudioFrame(
                    data=frame_data.tobytes(),
                    sample_rate=sample_rate,
                    num_channels=channels,
                    samples_per_channel=len(frame_data)
                )
                
                await audio_source.capture_frame(frame)
                
        except Exception as e:
            logger.error(f"Error publishing audio data: {e}")

    async def process_translations(self, text: str) -> None:
        """Process translations for final text"""
        translation_tasks = []
        
        # Create translation tasks for all target languages
        for lang in self.translation_targets:
            translation_tasks.append(
                self.handle_translation(text, self.primary_lang, lang)
            )
        
        # Process translations concurrently
        if translation_tasks:
            await asyncio.gather(*translation_tasks, return_exceptions=True)

    async def handle_translation(self, text: str, src_lang: str, tgt_lang: str) -> None:
        """Handle translation and TTS for a single target language"""
        try:
            # Translate text
            translated_text = await self.translate_text(text, src_lang, tgt_lang)
            
            # Publish translation message (preserve exact format)
            await self.publish_data({
                "type": f"translation-text-{tgt_lang}",
                "srcLang": src_lang,
                "lang": tgt_lang,
                "text": translated_text,
                "isFinal": True
            })
            
            # Queue TTS if this language has audio output enabled
            if tgt_lang in self.audio_targets and tgt_lang in self.tts_queues:
                await self.tts_queues[tgt_lang].put(translated_text)
            
        except Exception as e:
            logger.error(f"Translation handling error for {tgt_lang}: {e}")

    async def cleanup(self) -> None:
        """Cleanup resources"""
        try:
            # Signal TTS tasks to stop
            for queue in self.tts_queues.values():
                await queue.put(None)
                
            # Wait for TTS tasks to complete
            if self.tts_tasks:
                await asyncio.gather(*self.tts_tasks, return_exceptions=True)
                
            logger.info("Translation agent cleanup complete")
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


def _parse_outputs_from_metadata(md: Dict[str, Any]) -> Tuple[List[str], List[str], Optional[str]]:
    """Parse translation targets and source language from room metadata (preserved logic)"""
    t_targets: List[str] = []
    a_targets: List[str] = []
    src_lang: Optional[str] = None
    
    try:
        src = md.get("sourceLanguage")
        if isinstance(src, str) and src:
            src_lang = src
            
        outputs = md.get("outputs")
        if isinstance(outputs, list):
            for o in outputs:
                if not isinstance(o, dict):
                    continue
                lang = o.get("lang")
                if not isinstance(lang, str) or not lang:
                    continue
                if o.get("captions") is True:
                    t_targets.append(lang)
                if o.get("audio") is True:
                    a_targets.append(lang)
    except Exception:
        pass
        
    return t_targets, a_targets, src_lang


async def entrypoint(ctx: JobContext) -> None:
    """Entry point using standard AgentSession pattern - MUCH simpler!"""
    
    # Parse room metadata for configuration
    metadata_obj: Dict[str, Any] = {}
    try:
        if isinstance(ctx.room.metadata, str) and ctx.room.metadata:
            metadata_obj = json.loads(ctx.room.metadata)
    except Exception:
        metadata_obj = {}
    
    # Configure languages from metadata
    t_targets, a_targets, src_lang = _parse_outputs_from_metadata(metadata_obj)
    primary_lang = src_lang or "en-US"
    translation_targets = [l for l in dict.fromkeys(t_targets) if l and l != primary_lang]
    audio_targets = [l for l in dict.fromkeys(a_targets) if l and l != primary_lang]
    
    logger.info(f"Agent configured: src={primary_lang} translations={translation_targets} audio={audio_targets}")
    
    # Create AgentSession with automatic audio management (RoomIO handles everything!)
    session = AgentSession(
        stt=google.STT(
            model="chirp",
            language_code=primary_lang
        ),
        # No TTS here - we handle multi-language TTS manually
        # No LLM - we use Google Translate instead
    )
    
    # Create translation agent with configuration
    agent = TranslationAgent(
        primary_lang=primary_lang,
        translation_targets=translation_targets,
        audio_targets=audio_targets
    )
    
    # Start the session - AgentSession + RoomIO handle ALL audio input/output automatically!
    await session.start(
        room=ctx.room,
        agent=agent,
        room_input_options=RoomInputOptions(
            # Can configure audio behavior here if needed
        )
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
