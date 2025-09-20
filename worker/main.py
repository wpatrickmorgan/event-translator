#!/usr/bin/env python3
"""
LiveKit Translation Bot (Using Standard LiveKit Python SDK)

A clean implementation using standard LiveKit Python SDK for real-time translation.
Uses Google Cloud STT, Google Translate, and Google Cloud TTS for multi-language output.
"""

import asyncio
import json
import logging
import os
import time
from typing import Optional, Dict, Any, List, Tuple
import numpy as np

from livekit import rtc
from livekit.agents import cli, WorkerOptions, JobContext
from livekit.plugins import google
from livekit.agents.stt import SpeechEventType
from google.cloud import translate_v3 as translate
from google.oauth2 import service_account

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TranslationWorker:
    """Clean translation worker using standard LiveKit SDK"""
    
    def __init__(
        self,
        room: rtc.Room,
        primary_lang: str = "en-US",
        translation_targets: Optional[List[str]] = None,
        audio_targets: Optional[List[str]] = None,
    ):
        self.room = room
        self.primary_lang = primary_lang
        self.translation_targets = translation_targets or []
        self.audio_targets = audio_targets or []
        
        # Google Cloud services
        self.stt: Optional[google.STT] = None
        self.translate_client: Optional[translate.TranslationServiceClient] = None
        self.gcp_project_id: Optional[str] = None
        
        # Multi-language TTS setup
        self.audio_sources: Dict[str, rtc.AudioSource] = {}
        self.published_tracks: Dict[str, rtc.LocalAudioTrack] = {}
        self.tts_clients: Dict[str, google.TTS] = {}
        self.tts_queues: Dict[str, asyncio.Queue[Optional[str]]] = {}
        self.tts_tasks: List[asyncio.Task] = []
        
        # Audio processing
        self.audio_stream: Optional[rtc.AudioStream] = None
        self.stt_task: Optional[asyncio.Task] = None
    
    async def start(self) -> None:
        """Initialize and start the translation worker"""
        logger.info(f"Starting translation worker: src={self.primary_lang} translations={self.translation_targets} audio={self.audio_targets}")
        
        # Initialize Google Cloud services
        self.setup_google_services()
        
        # Set up multi-language TTS tracks
        await self.setup_audio_tracks()
        
        # Set up room event handlers
        self.setup_room_handlers()
        
        logger.info("Translation worker started successfully")
    
    def setup_google_services(self) -> None:
        """Initialize Google Cloud STT, TTS, and Translate services"""
        # Get credentials
        credentials_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        credentials_info = None
        
        if credentials_json:
            try:
                credentials_info = json.loads(credentials_json)
                self.gcp_project_id = credentials_info.get("project_id")
                logger.info("Using Google credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON")
            except Exception as e:
                logger.warning(f"Failed to parse Google credentials: {e}")
        else:
            logger.info("No GOOGLE_APPLICATION_CREDENTIALS_JSON found, using default credentials")
        
        # Initialize Google STT
        if credentials_info:
            self.stt = google.STT(
                model="latest_long",
                languages=[self.primary_lang],
                credentials_info=credentials_info
            )
        else:
            self.stt = google.STT(
                model="latest_long", 
                languages=[self.primary_lang]
            )
        
        # Initialize Google Translate
        try:
            if credentials_info:
                # Create credentials object and use it
                credentials = service_account.Credentials.from_service_account_info(credentials_info)
                self.translate_client = translate.TranslationServiceClient(credentials=credentials)
                logger.info("Google Translate client initialized with credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON")
            else:
                self.translate_client = translate.TranslationServiceClient()
                logger.info("Google Translate client initialized with default credentials")
        except Exception as e:
            logger.error(f"Failed to initialize Google Translate client: {e}")
    
    async def setup_audio_tracks(self) -> None:
        """Set up per-language TTS audio tracks and clients"""
        credentials_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        credentials_info = None
        
        if credentials_json:
            try:
                credentials_info = json.loads(credentials_json)
            except Exception as e:
                logger.warning(f"Failed to parse credentials for TTS: {e}")
        
        for lang in self.audio_targets:
            try:
                # Create audio source and track
                audio_source = rtc.AudioSource(sample_rate=48000, num_channels=1)
                track = rtc.LocalAudioTrack.create_audio_track(
                    f"translation-audio-{lang}",
                    audio_source
                )
                
                # Publish track
                options = rtc.TrackPublishOptions()
                options.source = rtc.TrackSource.SOURCE_UNKNOWN
                await self.room.local_participant.publish_track(track, options)
                
                # Store references
                self.audio_sources[lang] = audio_source
                self.published_tracks[lang] = track
                
                # Initialize TTS client
                if credentials_info:
                    self.tts_clients[lang] = google.TTS(
                        language=lang,
                        credentials_info=credentials_info
                    )
                else:
                    self.tts_clients[lang] = google.TTS(language=lang)
                
                # Set up TTS queue and processing task
                self.tts_queues[lang] = asyncio.Queue()
                self.tts_tasks.append(
                    asyncio.create_task(self.process_tts_queue(lang))
                )
                
                logger.info(f"Audio track and TTS client set up for language: {lang}")
                
            except Exception as e:
                logger.error(f"Failed to set up audio track for {lang}: {e}")
    
    def setup_room_handlers(self) -> None:
        """Set up room event handlers"""
        
        @self.room.on("track_subscribed")
        def on_track_subscribed(
            track: rtc.Track,
            publication: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant,
        ) -> None:
            """Handle new track subscriptions - start processing audio input"""
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                logger.info(f"Subscribed to audio track from {participant.identity}")
                asyncio.create_task(self.process_audio_track(track))
        
        @self.room.on("track_unsubscribed")  
        def on_track_unsubscribed(
            track: rtc.Track,
            publication: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant,
        ) -> None:
            """Handle track unsubscriptions"""
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                logger.info(f"Unsubscribed from audio track from {participant.identity}")
        
        @self.room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
            logger.info(f"Participant connected: {participant.identity}")
        
        @self.room.on("participant_disconnected")  
        def on_participant_disconnected(participant: rtc.RemoteParticipant) -> None:
            logger.info(f"Participant disconnected: {participant.identity}")
    
    async def process_audio_track(self, track: rtc.Track) -> None:
        """Process incoming audio track for STT"""
        if not self.stt:
            logger.error("STT not initialized")
            return
            
        try:
            # Create audio stream from track
            audio_stream = rtc.AudioStream(track, sample_rate=48000, num_channels=1)
            
            # Start STT stream
            stt_stream = self.stt.stream()
            
            # Process audio frames
            async def audio_processor() -> None:
                async for audio_event in audio_stream:
                    # Push audio frame to STT
                    stt_stream.push_frame(audio_event.frame)
            
            # Process STT results  
            async def stt_processor() -> None:
                async for stt_event in stt_stream:
                    if stt_event.type == SpeechEventType.FINAL_TRANSCRIPT:
                        await self.handle_transcription(stt_event.alternatives[0].text)
            
            # Run both processors concurrently
            await asyncio.gather(
                audio_processor(),
                stt_processor(),
                return_exceptions=True
            )
            
        except Exception as e:
            logger.error(f"Error processing audio track: {e}")
        finally:
            try:
                await audio_stream.aclose()
                await stt_stream.aclose()
            except:
                pass
    
    async def handle_transcription(self, text: str) -> None:
        """Handle final transcription from STT"""
        logger.info(f"Transcribed: {text}")
        
        # Publish original language messages
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
        translation_tasks = []
        for lang in self.translation_targets:
            translation_tasks.append(
                self.handle_translation(text, self.primary_lang, lang)
            )
        
        if translation_tasks:
            await asyncio.gather(*translation_tasks, return_exceptions=True)
    
    async def handle_translation(self, text: str, src_lang: str, tgt_lang: str) -> None:
        """Handle translation for a single target language"""
        try:
            # Translate text
            translated_text = await self.translate_text(text, src_lang, tgt_lang)
            
            # Publish translation message
            await self.publish_data({
                "type": f"translation-text-{tgt_lang}",
                "srcLang": src_lang,
                "lang": tgt_lang,
                "text": translated_text,
                "isFinal": True
            })
            
            # Queue TTS if audio output enabled for this language
            if tgt_lang in self.audio_targets and tgt_lang in self.tts_queues:
                await self.tts_queues[tgt_lang].put(translated_text)
                
        except Exception as e:
            logger.error(f"Translation handling error for {tgt_lang}: {e}")

    async def translate_text(self, text: str, src_lang: str, tgt_lang: str) -> str:
        """Translate text using Google Translate"""
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
            client = self.translate_client
            assert client is not None
            response = client.translate_text(request=request)
            return response.translations[0].translated_text if response.translations else text
        
        try:
            return await asyncio.to_thread(_translate)
        except Exception as e:
            logger.error(f"Translation error ({src_lang} -> {tgt_lang}): {e}")
            return text
    
    async def publish_data(self, data_obj: Dict[str, Any]) -> None:
        """Publish JSON data to room data channel"""
        try:
            data = json.dumps(data_obj).encode('utf-8')
            await self.room.local_participant.publish_data(data)
        except Exception as e:
            logger.error(f"Error publishing data: {e}")
    
    async def process_tts_queue(self, language: str) -> None:
        """Process TTS requests for a specific language"""
        queue = self.tts_queues[language]
        audio_source = self.audio_sources.get(language)
        tts_client = self.tts_clients.get(language)
        
        if not audio_source or not tts_client:
            logger.error(f"Missing audio source or TTS client for {language}")
            return
        
        while True:
            try:
                text = await queue.get()
                if text is None:  # Shutdown signal
                    break
                
                # Synthesize audio
                stream = tts_client.synthesize(text)
                audio_data = b""
                async for chunk in stream:
                    if hasattr(chunk, 'data'):
                        audio_data += chunk.data
                    else:
                        logger.warning(f"Unexpected TTS chunk format: {type(chunk)}")
                
                # Convert to audio frames and publish
                await self.publish_audio_data(audio_source, audio_data)
                
            except Exception as e:
                logger.error(f"TTS processing error for {language}: {e}")
    
    async def publish_audio_data(self, audio_source: rtc.AudioSource, audio_data: bytes) -> None:
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
                
                # Create and publish frame
                frame = rtc.AudioFrame(
                    data=frame_data.tobytes(),
                    sample_rate=sample_rate,
                    num_channels=channels,
                    samples_per_channel=len(frame_data)
                )
                
                await audio_source.capture_frame(frame)
                
        except Exception as e:
            logger.error(f"Error publishing audio data: {e}")
            
    async def cleanup(self) -> None:
        """Cleanup resources"""
        logger.info("Starting translation worker cleanup")
        
        try:
            # Stop TTS tasks
            for queue in self.tts_queues.values():
                await queue.put(None)  # Shutdown signal
            
            # Wait for TTS tasks to complete
            if self.tts_tasks:
                await asyncio.gather(*self.tts_tasks, return_exceptions=True)
            
            # Close audio streams
            if self.audio_stream:
                await self.audio_stream.aclose()
            
            logger.info("Translation worker cleanup complete")
            
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


def _parse_outputs_from_metadata(md: Dict[str, Any]) -> Tuple[List[str], List[str], Optional[str]]:
    """Parse translation targets and source language from room metadata"""
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
    """Entry point using standard LiveKit Python SDK - much cleaner!"""
    
    # Parse room metadata for configuration
    metadata_obj: Dict[str, Any] = {}
    try:
        if isinstance(ctx.room.metadata, str) and ctx.room.metadata:
            metadata_obj = json.loads(ctx.room.metadata)
            logger.info(f"Room metadata: {metadata_obj}")
    except Exception as e:
        logger.warning(f"Failed to parse room metadata: {e}")
        metadata_obj = {}

    # Configure languages from metadata
    t_targets, a_targets, src_lang = _parse_outputs_from_metadata(metadata_obj)
    primary_lang = src_lang or "en-US"
    translation_targets = [l for l in dict.fromkeys(t_targets) if l and l != primary_lang]
    audio_targets = [l for l in dict.fromkeys(a_targets) if l and l != primary_lang]
    
    logger.info(f"Parsed metadata - src_lang: {src_lang}, t_targets: {t_targets}, a_targets: {a_targets}")
    logger.info(f"Final config - primary_lang: {primary_lang}, translation_targets: {translation_targets}, audio_targets: {audio_targets}")
    
    # Create translation worker
    worker = TranslationWorker(
        room=ctx.room,
        primary_lang=primary_lang,
        translation_targets=translation_targets,
        audio_targets=audio_targets,
    )
    
    try:
        # Connect to the job context first!
        await ctx.connect()
        logger.info(f"Connected to room: {ctx.room.name}")
        
        # Start the worker
        await worker.start()
        
        # Keep running until room disconnects
        logger.info("Translation worker is running...")
        
        # Wait for room to disconnect
        disconnect_future: asyncio.Future[None] = asyncio.Future()
        
        @ctx.room.on("disconnected")
        def on_disconnected() -> None:
            if not disconnect_future.done():
                disconnect_future.set_result(None)
        
        await disconnect_future
        
    except Exception as e:
        logger.error(f"Worker error: {e}")
        raise
    finally:
        # Cleanup
        await worker.cleanup()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))