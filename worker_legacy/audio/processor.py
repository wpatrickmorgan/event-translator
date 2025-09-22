"""
Audio frame processing utilities.
"""
import asyncio
import logging
from typing import Optional, AsyncIterator, Callable, Any, Dict
from livekit import rtc

from ..models import TranscriptionResult, AudioConfig
from ..providers.base import STTProvider

logger = logging.getLogger(__name__)


class AudioProcessor:
    """Processes incoming audio tracks for speech-to-text"""
    
    def __init__(
        self, 
        stt_provider: STTProvider,
        config: AudioConfig = AudioConfig()
    ):
        self.stt_provider = stt_provider
        self.config = config
        self._active_streams: Dict[str, Any] = {}
    
    async def process_audio_track(
        self, 
        track: rtc.Track, 
        language: str,
        on_transcription: Callable[[TranscriptionResult], None]
    ) -> None:
        """Process incoming audio track for STT"""
        track_id = f"{track.sid}_{language}"
        
        try:
            # Create audio stream from track
            audio_stream = rtc.AudioStream(
                track, 
                sample_rate=self.config.sample_rate,
                num_channels=self.config.num_channels
            )
            
            # Create STT stream
            stt_stream = self.stt_provider.create_stream(language)
            
            # Store references for cleanup
            self._active_streams[track_id] = {
                'audio_stream': audio_stream,
                'stt_stream': stt_stream
            }
            
            # Process audio frames and STT results concurrently
            await asyncio.gather(
                self._process_audio_frames(audio_stream, stt_stream),
                self._process_stt_results(stt_stream, on_transcription),
                return_exceptions=True
            )
            
        except Exception as e:
            logger.error(f"Error processing audio track: {e}")
        finally:
            # Cleanup
            await self._cleanup_track(track_id)
    
    async def _process_audio_frames(self, audio_stream: rtc.AudioStream, stt_stream) -> None:
        """Process audio frames and push to STT"""
        try:
            async for audio_event in audio_stream:
                stt_stream.push_frame(audio_event.frame)
        except Exception as e:
            logger.error(f"Error processing audio frames: {e}")
    
    async def _process_stt_results(
        self, 
        stt_stream, 
        on_transcription: Callable[[TranscriptionResult], None]
    ) -> None:
        """Process STT results and call transcription handler"""
        try:
            async for result in stt_stream:
                if result.is_final:
                    on_transcription(result)
        except Exception as e:
            logger.error(f"Error processing STT results: {e}")
    
    async def _cleanup_track(self, track_id: str) -> None:
        """Cleanup resources for a track"""
        if track_id in self._active_streams:
            streams = self._active_streams.pop(track_id)
            
            try:
                if 'audio_stream' in streams:
                    await streams['audio_stream'].aclose()
            except Exception as e:
                logger.warning(f"Error closing audio stream: {e}")
            
            try:
                if 'stt_stream' in streams:
                    await streams['stt_stream'].aclose()
            except Exception as e:
                logger.warning(f"Error closing STT stream: {e}")
    
    async def cleanup_all(self) -> None:
        """Cleanup all active streams"""
        track_ids = list(self._active_streams.keys())
        for track_id in track_ids:
            await self._cleanup_track(track_id)
