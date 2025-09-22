"""
Room event management utilities.
"""
import asyncio
import logging
from typing import Dict, List, Callable, Optional, Any
from livekit import rtc

from ..models import TranscriptionResult, TTSRequest, AudioConfig
from ..providers.base import TTSProvider
from ..audio.converter import AudioConverter

logger = logging.getLogger(__name__)


class RoomManager:
    """Manages LiveKit room events and interactions"""
    
    def __init__(
        self, 
        room: rtc.Room,
        audio_config: AudioConfig = AudioConfig()
    ):
        self.room = room
        self.audio_config = audio_config
        self._event_handlers: Dict[str, List[Callable]] = {}
        self._audio_tracks: Dict[str, Dict[str, Any]] = {}
        self._tts_queues: Dict[str, asyncio.Queue] = {}
        self._tts_tasks: List[asyncio.Task] = []
        self.audio_converter = AudioConverter(audio_config)
    
    def setup_event_handlers(self) -> None:
        """Set up room event handlers"""
        
        @self.room.on("track_subscribed")
        def on_track_subscribed(
            track: rtc.Track,
            publication: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant,
        ) -> None:
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                logger.info(f"Subscribed to audio track from {participant.identity}")
                self._notify_handlers("audio_track_added", track, participant)
        
        @self.room.on("track_unsubscribed")
        def on_track_unsubscribed(
            track: rtc.Track,
            publication: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant,
        ) -> None:
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                logger.info(f"Unsubscribed from audio track from {participant.identity}")
                self._notify_handlers("audio_track_removed", track, participant)
        
        @self.room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
            logger.info(f"Participant connected: {participant.identity}")
            self._notify_handlers("participant_connected", participant)
        
        @self.room.on("participant_disconnected")
        def on_participant_disconnected(participant: rtc.RemoteParticipant) -> None:
            logger.info(f"Participant disconnected: {participant.identity}")
            self._notify_handlers("participant_disconnected", participant)
        
        @self.room.on("disconnected")
        def on_disconnected() -> None:
            logger.info("Room disconnected")
            self._notify_handlers("room_disconnected")
    
    def add_event_handler(self, event_name: str, handler: Callable) -> None:
        """Add an event handler for a specific event"""
        if event_name not in self._event_handlers:
            self._event_handlers[event_name] = []
        self._event_handlers[event_name].append(handler)
    
    def _notify_handlers(self, event_name: str, *args) -> None:
        """Notify all handlers for a specific event"""
        if event_name in self._event_handlers:
            for handler in self._event_handlers[event_name]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        asyncio.create_task(handler(*args))
                    else:
                        handler(*args)
                except Exception as e:
                    logger.error(f"Error in event handler for {event_name}: {e}")
    
    async def setup_audio_track(
        self, 
        language: str, 
        tts_provider: TTSProvider,
        track_name: Optional[str] = None
    ) -> rtc.LocalAudioTrack:
        """Set up an audio track for a specific language"""
        track_name = track_name or f"translation-audio-{language}"
        
        try:
            # Create audio source and track
            audio_source = rtc.AudioSource(
                sample_rate=self.audio_config.sample_rate,
                num_channels=self.audio_config.num_channels
            )
            track = rtc.LocalAudioTrack.create_audio_track(track_name, audio_source)
            
            # Publish track
            options = rtc.TrackPublishOptions()
            options.source = rtc.TrackSource.SOURCE_UNKNOWN
            await self.room.local_participant.publish_track(track, options)
            
            # Set up TTS queue and task
            tts_queue = asyncio.Queue()
            tts_task = asyncio.create_task(
                self._process_tts_queue(language, tts_provider, audio_source, tts_queue)
            )
            
            # Store references
            self._audio_tracks[language] = {
                'track': track,
                'audio_source': audio_source,
                'tts_provider': tts_provider
            }
            self._tts_queues[language] = tts_queue
            self._tts_tasks.append(tts_task)
            
            logger.info(f"Audio track set up for language: {language}")
            return track
            
        except Exception as e:
            logger.error(f"Failed to set up audio track for {language}: {e}")
            raise
    
    async def queue_tts_request(self, language: str, request: TTSRequest) -> None:
        """Queue a TTS request for processing"""
        if language in self._tts_queues:
            await self._tts_queues[language].put(request)
        else:
            logger.warning(f"No TTS queue available for language: {language}")
    
    async def _process_tts_queue(
        self, 
        language: str, 
        tts_provider: TTSProvider,
        audio_source: rtc.AudioSource,
        queue: asyncio.Queue
    ) -> None:
        """Process TTS requests for a specific language"""
        while True:
            try:
                request = await queue.get()
                if request is None:  # Shutdown signal
                    break
                
                # Synthesize audio
                audio_data = b""
                async for chunk in tts_provider.synthesize(request):
                    audio_data += chunk
                
                # Convert and publish audio frames
                if audio_data:
                    await self.audio_converter.bytes_to_audio_frames(audio_data, audio_source)
                
            except Exception as e:
                logger.error(f"TTS processing error for {language}: {e}")
    
    def get_audio_track(self, language: str) -> Optional[rtc.LocalAudioTrack]:
        """Get the audio track for a specific language"""
        track_info = self._audio_tracks.get(language)
        return track_info['track'] if track_info else None
    
    def get_available_languages(self) -> List[str]:
        """Get list of languages with set up audio tracks"""
        return list(self._audio_tracks.keys())
    
    async def cleanup(self) -> None:
        """Cleanup all room resources"""
        logger.info("Starting room manager cleanup")
        
        try:
            # Stop TTS tasks
            for queue in self._tts_queues.values():
                await queue.put(None)  # Shutdown signal
            
            # Wait for TTS tasks to complete
            if self._tts_tasks:
                await asyncio.gather(*self._tts_tasks, return_exceptions=True)
            
            # Clear references
            self._audio_tracks.clear()
            self._tts_queues.clear()
            self._tts_tasks.clear()
            
            logger.info("Room manager cleanup complete")
            
        except Exception as e:
            logger.error(f"Room manager cleanup error: {e}")
