#!/usr/bin/env python3
"""
LiveKit Translation Bot Worker

A minimal worker that:
1. Joins a LiveKit room as a bot
2. Subscribes to the main remote audio
3. Streams audio to Google Cloud Speech-to-Text
4. Publishes captions back via LiveKit data channel
"""

import asyncio
import json
import logging
import os
import time
from typing import Optional, Dict, Any, List, Tuple
import numpy as np
from tenacity import retry, stop_after_attempt, wait_exponential
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from livekit import rtc, api as lk_api
from livekit.rtc import DataPacketKind
from google.cloud import speech
from google.cloud import texttospeech
from google.cloud import translate_v3 as translate

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TranslationBot:
    def __init__(self, *, event_id: Optional[str] = None, room_name: Optional[str] = None, lang_codes_csv: Optional[str] = None, voice_codes_csv: Optional[str] = None):
        self.event_id = event_id or os.getenv("EVENT_ID", "")
        self.room_name = room_name or os.getenv("ROOM_NAME", "")
        env_langs = lang_codes_csv if lang_codes_csv is not None else os.getenv("LANG_CODES", "en")
        self.lang_codes = [c.strip() for c in env_langs.split(",") if c.strip()]
        self.primary_lang = self.lang_codes[0] if self.lang_codes else "en"
        self.target_langs: List[str] = self.lang_codes[1:] if len(self.lang_codes) > 1 else []
        self.translation_targets: List[str] = list(self.target_langs)
        self.audio_targets: List[str] = list(self.target_langs)
        # Optional VOICE_CODES format: "es-ES:es-ES-Standard-A,fr-FR:fr-FR-Standard-A"
        self.voice_codes_env = voice_codes_csv if voice_codes_csv is not None else os.getenv("VOICE_CODES", "")
        self.voice_by_lang: Dict[str, str] = self._parse_voice_codes(self.voice_codes_env)
        
        # LiveKit configuration
        self.livekit_url = os.getenv("LIVEKIT_URL", "")
        self.livekit_api_key = os.getenv("LIVEKIT_API_KEY", "")
        self.livekit_api_secret = os.getenv("LIVEKIT_API_SECRET", "")
        
        # Google Cloud configuration
        self.google_credentials_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON", "")
        self.google_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
        self.gcp_project_id: Optional[str] = None
        
        # Audio processing
        self.sample_rate = 48000
        self.channels = 1  # mono
        self.audio_buffer = []
        self.stt_client = None
        self.streaming_config = None
        self.translate_client: Optional[translate.TranslationServiceClient] = None
        self.tts_client: Optional[texttospeech.TextToSpeechClient] = None
        self.room = None
        self.selected_audio_track = None
        self.seq_counter = 0
        
        # TTS streaming state per language
        self.tts_audio_queues: Dict[str, asyncio.Queue] = {}
        self.audio_sources: Dict[str, rtc.AudioSource] = {}
        self.local_audio_tracks: Dict[str, rtc.LocalAudioTrack] = {}
        self.audio_pump_tasks: Dict[str, asyncio.Task] = {}
        
        # State
        self.is_connected = False
        self.audio_timeout = 30  # seconds to wait for audio
        
    def setup_google_credentials(self):
        """Setup Google Cloud credentials from JSON or file"""
        if self.google_credentials_json:
            # Write JSON credentials to file
            credentials_path = "/app/gcp-key.json"
            with open(credentials_path, "w") as f:
                f.write(self.google_credentials_json)
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            logger.info("Google credentials written to /app/gcp-key.json")
            # Try to read project_id from provided JSON
            try:
                creds = json.loads(self.google_credentials_json)
                self.gcp_project_id = creds.get("project_id")
            except Exception:
                pass
        elif self.google_credentials_path and os.path.exists(self.google_credentials_path):
            logger.info(f"Using Google credentials from {self.google_credentials_path}")
            try:
                with open(self.google_credentials_path, "r") as f:
                    creds = json.load(f)
                    self.gcp_project_id = creds.get("project_id")
            except Exception:
                pass
        else:
            logger.warning("No Google credentials found - STT will not work")
            
    def _parse_voice_codes(self, voice_codes: str) -> Dict[str, str]:
        mapping: Dict[str, str] = {}
        if not voice_codes:
            return mapping
        pairs = [p.strip() for p in voice_codes.split(",") if p.strip()]
        for p in pairs:
            if ":" in p:
                lang, voice = p.split(":", 1)
                mapping[lang.strip()] = voice.strip()
        return mapping
    
    def _admin_base_url(self) -> str:
        url = self.livekit_url or ""
        # Convert ws(s) URL to http(s) admin base
        if url.startswith("wss://"):
            return "https://" + url[6:]
        if url.startswith("ws://"):
            return "http://" + url[5:]
        return url
    
    async def load_room_metadata(self):
        """Attempt to load room metadata and derive languages/voices. Fallback to env if unavailable."""
        base_url = self._admin_base_url()
        try:
            client = lk_api.RoomServiceClient(base_url, self.livekit_api_key, self.livekit_api_secret)
            def _load():
                rooms = client.list_rooms()
                for r in rooms:
                    if r.name == self.room_name:
                        return getattr(r, 'metadata', None)
                return None
            metadata_str = await asyncio.to_thread(_load)
            if not metadata_str:
                logger.info("No room metadata found; using LANG_CODES fallback")
                return
            try:
                md = json.loads(metadata_str)
            except Exception:
                logger.warning("Room metadata is not valid JSON; ignoring")
                return
            src = md.get("sourceLanguage")
            if isinstance(src, str) and src:
                self.primary_lang = src
            outputs = md.get("outputs")
            if isinstance(outputs, list) and outputs:
                t_targets: List[str] = []
                a_targets: List[str] = []
                for o in outputs:
                    try:
                        lang = o.get("lang")
                        if not isinstance(lang, str) or not lang:
                            continue
                        if o.get("captions") is True:
                            t_targets.append(lang)
                        if o.get("audio") is True:
                            a_targets.append(lang)
                        voice = o.get("voice")
                        if isinstance(voice, str) and voice:
                            self.voice_by_lang[lang] = voice
                    except Exception:
                        continue
                # Ensure no duplicates and remove source language from targets
                t_targets = [l for l in dict.fromkeys(t_targets) if l != self.primary_lang]
                a_targets = [l for l in dict.fromkeys(a_targets) if l != self.primary_lang]
                if t_targets or a_targets:
                    self.translation_targets = t_targets
                    self.audio_targets = a_targets
                    logger.info(f"Using outputs from metadata. captions={self.translation_targets} audio={self.audio_targets}")
        except Exception as e:
            logger.info(f"Failed to load room metadata, using LANG_CODES fallback: {e}")
        
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    def create_stt_client(self):
        """Create Google Cloud Speech-to-Text client with retry"""
        try:
            self.stt_client = speech.SpeechClient()
            logger.info("Google Cloud STT client created successfully")
        except Exception as e:
            logger.error(f"Failed to create STT client: {e}")
            raise
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    def create_translate_client(self):
        try:
            self.translate_client = translate.TranslationServiceClient()
            logger.info("Google Cloud Translate client created successfully")
        except Exception as e:
            logger.error(f"Failed to create Translate client: {e}")
            raise
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    def create_tts_client(self):
        try:
            self.tts_client = texttospeech.TextToSpeechClient()
            logger.info("Google Cloud TTS client created successfully")
        except Exception as e:
            logger.error(f"Failed to create TTS client: {e}")
            raise
            
    def create_stt_streaming_config(self):
        """Create streaming STT configuration"""
        self.streaming_config = speech.StreamingRecognitionConfig(
            config=speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=self.sample_rate,
                language_code=self.primary_lang,
                enable_automatic_punctuation=True,
            ),
            interim_results=True,
        )
        logger.info(f"STT streaming config prepared for language: {self.primary_lang}")
        
    def convert_audio_to_linear16(self, audio_data: np.ndarray) -> bytes:
        """Convert float32 PCM audio to LINEAR16 format"""
        # Ensure mono
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
            
        # Convert from float32 [-1, 1] to int16 [-32768, 32767]
        audio_int16 = (audio_data * 32767).astype(np.int16)
        
        # Convert to little-endian bytes
        return audio_int16.tobytes()
        
    async def process_stt(self, audio_q: asyncio.Queue):
        """Run Google streaming_recognize consuming chunks from an async queue and publish captions."""
        loop = asyncio.get_running_loop()

        def requests_iter():
            while True:
                # Bridge async queue to sync iterator
                chunk = asyncio.run_coroutine_threadsafe(audio_q.get(), loop).result()
                if chunk is None:
                    break
                yield speech.StreamingRecognizeRequest(audio_content=chunk)

        def run_stream():
            try:
                for response in self.stt_client.streaming_recognize(self.streaming_config, requests_iter()):
                    if not response.results:
                        continue
                    for result in response.results:
                        if not result.alternatives:
                            continue
                        transcript = result.alternatives[0].transcript.strip()
                        if not transcript:
                            continue
                        is_final = result.is_final
                        self.seq_counter += 1
                        seq = self.seq_counter
                        # Back-compat caption message
                        caption_msg = {
                            "type": "caption",
                            "lang": self.primary_lang,
                            "text": transcript,
                            "isFinal": is_final,
                        }
                        asyncio.run_coroutine_threadsafe(self.publish_data(caption_msg), loop)
                        # New original-language-text message
                        original_msg = {
                            "type": "original-language-text",
                            "lang": self.primary_lang,
                            "text": transcript,
                            "isFinal": is_final,
                            "seq": seq,
                            "ts": int(time.time() * 1000),
                        }
                        asyncio.run_coroutine_threadsafe(self.publish_data(original_msg), loop)
                        # Fan-out to translations
                        if self.translation_targets and self.translate_client:
                            for tgt in self.translation_targets:
                                asyncio.run_coroutine_threadsafe(
                                    self.handle_translation_and_tts(transcript, self.primary_lang, tgt, is_final, seq),
                                    loop,
                                )
                        logger.info(f"Caption: {transcript} (final: {is_final})")
            except Exception as e:
                logger.error(f"Error in streaming_recognize: {e}")

        # Run the blocking stream in a worker thread
        await asyncio.to_thread(run_stream)
            
    async def publish_data(self, data_obj: Dict[str, Any]):
        """Publish JSON to LiveKit data channel (reliable)."""
        if not self.room or not self.is_connected:
            return
            
        try:
            data = json.dumps(data_obj).encode('utf-8')
            await self.room.local_participant.publish_data(
                data,
                kind=DataPacketKind.RELIABLE,
            )
        except Exception as e:
            logger.error(f"Error publishing data: {e}")

    async def handle_translation_and_tts(self, text: str, src_lang: str, tgt_lang: str, is_final: bool, seq: int):
        """Translate text and optionally synthesize TTS for final results."""
        try:
            translated = await self.translate_text(text, src_lang, tgt_lang)
            tr_msg = {
                "type": f"translation-text-{tgt_lang}",
                "srcLang": src_lang,
                "lang": tgt_lang,
                "text": translated,
                "isFinal": is_final,
                "seq": seq,
                "ts": int(time.time() * 1000),
            }
            await self.publish_data(tr_msg)
            if is_final and self.tts_client and tgt_lang in self.tts_audio_queues:
                await self.enqueue_tts_audio(translated, tgt_lang, seq)
        except Exception as e:
            logger.error(f"Translation/TTS error for {tgt_lang}: {e}")
            try:
                await self.publish_data({
                    "type": f"translation-audio-{tgt_lang}",
                    "status": "error",
                    "seq": seq,
                    "ts": int(time.time() * 1000),
                })
            except Exception:
                pass

    async def translate_text(self, text: str, src_lang: str, tgt_lang: str) -> str:
        if not self.translate_client or not self.gcp_project_id:
            return text
        parent = f"projects/{self.gcp_project_id}/locations/global"
        def _translate():
            request = translate.TranslateTextRequest(
                parent=parent,
                contents=[text],
                mime_type="text/plain",
                source_language_code=src_lang,
                target_language_code=tgt_lang,
            )
            resp = self.translate_client.translate_text(request=request)
            return resp.translations[0].translated_text if resp.translations else text
        return await asyncio.to_thread(_translate)

    async def enqueue_tts_audio(self, text: str, tgt_lang: str, seq: int):
        """Synthesize TTS with Google TTS and enqueue raw LINEAR16 bytes."""
        if not self.tts_client:
            return
        voice_name = self.voice_by_lang.get(tgt_lang)
        def _synthesize() -> bytes:
            voice_params = texttospeech.VoiceSelectionParams(
                language_code=tgt_lang,
                name=voice_name if voice_name else None,
            )
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                sample_rate_hertz=self.sample_rate,
                speaking_rate=1.0,
            )
            synthesis_input = texttospeech.SynthesisInput(text=text)
            response = self.tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice_params,
                audio_config=audio_config,
            )
            return response.audio_content
        audio_bytes = await asyncio.to_thread(_synthesize)
        q = self.tts_audio_queues.get(tgt_lang)
        if q:
            # Inform clients that audio for this seq is starting
            await self.publish_data({
                "type": f"translation-audio-{tgt_lang}",
                "status": "start",
                "seq": seq,
                "ts": int(time.time() * 1000),
            })
            # Enqueue the bytes; pump task will stream to track
            try:
                await q.put(audio_bytes)
            except asyncio.QueueFull:
                # Drop oldest and enqueue
                try:
                    _ = q.get_nowait()
                except Exception:
                    pass
                await q.put(audio_bytes)
            await self.publish_data({
                "type": f"translation-audio-{tgt_lang}",
                "status": "end",
                "seq": seq,
                "ts": int(time.time() * 1000),
            })
            
    async def find_main_audio_track(self) -> Optional[rtc.RemoteTrackPublication]:
        """Find the first non-bot remote audio track"""
        if not self.room:
            return None
            
        for participant in self.room.remote_participants.values():
            # Skip bot participants
            if participant.identity.startswith("translation-bot:"):
                continue
            for pub in participant.track_publications.values():
                if pub.kind == rtc.TrackKind.KIND_AUDIO:
                    logger.info(f"Found main audio track from {participant.identity}")
                    return pub
                    
        return None
        
    async def wait_for_audio_track(self) -> Optional[rtc.RemoteTrackPublication]:
        """Wait for a main audio track to become available"""
        start_time = time.time()
        
        while time.time() - start_time < self.audio_timeout:
            track = await self.find_main_audio_track()
            if track:
                return track
                
            logger.info("Waiting for main audio track...")
            await asyncio.sleep(2)
            
        logger.warning(f"No audio track found within {self.audio_timeout} seconds")
        return None
        
    async def on_track_subscribed(self, track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        """Handle track subscription"""
        if track.kind == rtc.TrackKind.KIND_AUDIO and not participant.identity.startswith("translation-bot:"):
            logger.info(f"Audio track subscribed from {participant.identity}")
            if not self.selected_audio_track:
                self.selected_audio_track = publication
                
    async def on_track_unsubscribed(self, track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        """Handle track unsubscription"""
        if publication == self.selected_audio_track:
            logger.info("Main audio track unsubscribed")
            self.selected_audio_track = None
            
    async def on_participant_connected(self, participant: rtc.RemoteParticipant):
        """Handle participant connection"""
        logger.info(f"Participant connected: {participant.identity}")
        
        # Check for existing audio tracks
        if not self.selected_audio_track:
            track = await self.find_main_audio_track()
            if track:
                self.selected_audio_track = track
                
    async def on_participant_disconnected(self, participant: rtc.RemoteParticipant):
        """Handle participant disconnection"""
        logger.info(f"Participant disconnected: {participant.identity}")
        
    async def connect_to_room(self):
        """Connect to LiveKit room"""
        try:
            # Create JWT token using server credentials with room grants
            jwt_token = (
                lk_api.AccessToken(self.livekit_api_key, self.livekit_api_secret)
                .with_identity(f"translation-bot:{self.event_id}")
                .with_grants(lk_api.VideoGrants(
                    room=self.room_name,
                    room_join=True,
                    can_subscribe=True,
                    can_publish=True,
                    can_publish_data=True,
                ))
                .to_jwt()
            )

            # Connect to room
            self.room = rtc.Room()

            # Set up event handlers
            self.room.on("track_subscribed", self.on_track_subscribed)
            self.room.on("track_unsubscribed", self.on_track_unsubscribed)
            self.room.on("participant_connected", self.on_participant_connected)
            self.room.on("participant_disconnected", self.on_participant_disconnected)

            await self.room.connect(self.livekit_url, jwt_token)
            self.is_connected = True

            logger.info(f"Connected to room: {self.room_name} as translation-bot:{self.event_id}")

        except Exception as e:
            logger.error(f"Failed to connect to room: {e}")
            raise
    
    async def run(self):
        """Main worker loop"""
        try:
            # Setup
            self.setup_google_credentials()
            self.create_stt_client()
            self.create_stt_streaming_config()
            # Optional services
            self.create_translate_client()
            self.create_tts_client()
            
            # Connect to room
            await self.connect_to_room()
            # Try to load room metadata for outputs
            await self.load_room_metadata()
            
            # Prepare TTS publishing per target language
            for lang in self.audio_targets:
                # Create audio source and track
                try:
                    source = rtc.AudioSource(self.sample_rate, self.channels)
                    track = rtc.LocalAudioTrack.create_audio_track(f"translation-audio-{lang}", source)
                    await self.room.local_participant.publish_track(track)
                    self.audio_sources[lang] = source
                    self.local_audio_tracks[lang] = track
                    # Bounded queue for up to ~3s of audio (assuming avg 48kB/s mono LINEAR16)
                    self.tts_audio_queues[lang] = asyncio.Queue(maxsize=64)
                except Exception as e:
                    logger.error(f"Failed creating/publishing audio track for {lang}: {e}")

            # Wait for audio track
            audio_track = await self.wait_for_audio_track()
            if not audio_track:
                logger.error("No audio track available, exiting")
                return
            
            # Open audio stream and feed frames into queue
            stream = await audio_track.audio_stream()
            audio_q: asyncio.Queue = asyncio.Queue(maxsize=100)

            async def feed_audio():
                try:
                    async for frame in stream:
                        # frame.data might be ndarray or bytes; normalize to float32 ndarray
                        pcm = frame.data
                        if isinstance(pcm, (bytes, bytearray)):
                            pcm = np.frombuffer(pcm, dtype=np.float32)
                        # Downmix to mono
                        if getattr(pcm, 'ndim', 1) == 2 and pcm.shape[1] > 1:
                            pcm = np.mean(pcm, axis=1)
                        pcm = np.clip(pcm, -1.0, 1.0).astype(np.float32)
                        linear16 = (pcm * 32767.0).astype(np.int16).tobytes()
                        await audio_q.put(linear16)
                except asyncio.CancelledError:
                    return

            feed_task = asyncio.create_task(feed_audio())
            stt_task = asyncio.create_task(self.process_stt(audio_q))
            # Start audio pumps properly (workaround for inline coroutine def)
            # Define pumps here to capture local scope
            pump_tasks: List[asyncio.Task] = []
            for lang in self.audio_targets:
                if lang in self.tts_audio_queues and lang in self.audio_sources:
                    async def _pump(l=lang):
                        q = self.tts_audio_queues[l]
                        source = self.audio_sources[l]
                        frame_samples = int(self.sample_rate * 0.02)
                        try:
                            while self.is_connected:
                                audio_bytes = await q.get()
                                if audio_bytes is None:
                                    break
                                int16 = np.frombuffer(audio_bytes, dtype=np.int16)
                                pcm = (int16.astype(np.float32)) / 32767.0
                                idx = 0
                                total = pcm.shape[0]
                                while idx < total:
                                    end = min(idx + frame_samples, total)
                                    frame_data = pcm[idx:end]
                                    samples = frame_data.shape[0]
                                    if samples == 0:
                                        break
                                    if samples < frame_samples:
                                        frame_pad = np.zeros((frame_samples,), dtype=np.float32)
                                        frame_pad[:samples] = frame_data
                                        frame_data = frame_pad
                                        samples = frame_samples
                                    frame = rtc.AudioFrame(
                                        data=frame_data,
                                        sample_rate=self.sample_rate,
                                        num_channels=self.channels,
                                        samples_per_channel=samples,
                                    )
                                    source.capture_frame(frame)
                                    idx += frame_samples
                        except asyncio.CancelledError:
                            return
                        except Exception as e:
                            logger.error(f"Audio pump error for {l}: {e}")
                    pump_tasks.append(asyncio.create_task(_pump()))

            # Wait for audio feeding to complete, then signal STT to finish and await it
            try:
                await feed_task
            except asyncio.CancelledError:
                logger.info("Audio feed task cancelled")
            finally:
                try:
                    await audio_q.put(None)
                except Exception:
                    pass
                try:
                    await stt_task
                except asyncio.CancelledError:
                    logger.info("STT task cancelled")
                # Stop pumps
                for lang, q in self.tts_audio_queues.items():
                    try:
                        await q.put(None)
                    except Exception:
                        pass
                for t in pump_tasks:
                    try:
                        await t
                    except Exception:
                        pass
                
        except Exception as e:
            logger.error(f"Worker error: {e}")
        finally:
            await self.cleanup()
            
    async def cleanup(self):
        """Clean up resources"""
        logger.info("Cleaning up...")
        
        # No explicit STT stream handle; processing finishes when queue is drained
                
        if self.room and self.is_connected:
            try:
                await self.room.disconnect()
            except:
                pass
                
        logger.info("Cleanup complete")

class StartSessionBody(BaseModel):
    eventId: str
    roomName: str
    langCodesCsv: str | None = None
    voiceCodesCsv: str | None = None

class StopSessionBody(BaseModel):
    roomName: str

class SessionSupervisor:
    def __init__(self) -> None:
        self.sessions: Dict[str, asyncio.Task] = {}
        self.bots: Dict[str, TranslationBot] = {}

    async def start(self, body: StartSessionBody):
        key = body.roomName
        if key in self.sessions and not self.sessions[key].done():
            return {"status": "already_running"}
        bot = TranslationBot(event_id=body.eventId, room_name=body.roomName, lang_codes_csv=body.langCodesCsv, voice_codes_csv=body.voiceCodesCsv)
        task = asyncio.create_task(bot.run())
        self.sessions[key] = task
        self.bots[key] = bot
        return {"status": "started"}

    async def stop(self, room_name: str):
        key = room_name
        task = self.sessions.get(key)
        bot = self.bots.get(key)
        if not task:
            return {"status": "not_found"}
        try:
            if bot:
                await bot.cleanup()
        except Exception:
            pass
        try:
            task.cancel()
        except Exception:
            pass
        self.sessions.pop(key, None)
        self.bots.pop(key, None)
        return {"status": "stopped"}

    def list(self):
        out = []
        for k, t in self.sessions.items():
            out.append({"roomName": k, "running": not t.done()})
        return out

app = FastAPI()
supervisor = SessionSupervisor()

@app.get("/health")
async def health():
    return {"ok": True}

@app.get("/sessions")
async def sessions():
    return supervisor.list()

@app.post("/start")
async def start_session(body: StartSessionBody):
    return await supervisor.start(body)

@app.post("/stop")
async def stop_session(body: StopSessionBody):
    return await supervisor.stop(body.roomName)

def main():
    """If launched directly, run as a supervisor HTTP server."""
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))

if __name__ == "__main__":
    main()
