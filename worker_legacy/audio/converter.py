"""
Audio format conversion utilities.
"""
import logging
import numpy as np
from typing import AsyncIterator, List
from livekit import rtc

from ..models import AudioConfig

logger = logging.getLogger(__name__)


class AudioConverter:
    """Converts audio data between different formats"""
    
    def __init__(self, config: AudioConfig = AudioConfig()):
        self.config = config
    
    async def bytes_to_audio_frames(
        self, 
        audio_data: bytes,
        audio_source: rtc.AudioSource
    ) -> None:
        """Convert TTS audio bytes to audio frames and publish to source"""
        try:
            # Convert bytes to numpy array (assuming 16-bit PCM)
            int16_data = np.frombuffer(audio_data, dtype=np.int16)
            float32_data = int16_data.astype(np.float32) / 32767.0
            
            # Create and publish audio frames
            await self._publish_audio_frames(float32_data, audio_source)
            
        except Exception as e:
            logger.error(f"Error converting audio bytes to frames: {e}")
    
    async def _publish_audio_frames(
        self, 
        audio_data: np.ndarray,
        audio_source: rtc.AudioSource
    ) -> None:
        """Publish audio frames to the audio source"""
        try:
            # Create frames with configured sample count
            for i in range(0, len(audio_data), self.config.frame_samples):
                frame_data = audio_data[i:i + self.config.frame_samples]
                
                # Pad frame if necessary
                if len(frame_data) < self.config.frame_samples:
                    padded = np.zeros(self.config.frame_samples, dtype=np.float32)
                    padded[:len(frame_data)] = frame_data
                    frame_data = padded
                
                # Create and capture audio frame
                frame = rtc.AudioFrame(
                    data=frame_data.tobytes(),
                    sample_rate=self.config.sample_rate,
                    num_channels=self.config.num_channels,
                    samples_per_channel=len(frame_data)
                )
                
                await audio_source.capture_frame(frame)
                
        except Exception as e:
            logger.error(f"Error publishing audio frames: {e}")
    
    def validate_audio_data(self, audio_data: bytes) -> bool:
        """Validate audio data format"""
        if not audio_data:
            return False
        
        # Check if data length is appropriate for 16-bit samples
        if len(audio_data) % 2 != 0:
            logger.warning(f"Audio data length {len(audio_data)} is not even (not 16-bit samples)")
            return False
        
        return True
    
    def get_audio_duration(self, audio_data: bytes) -> float:
        """Get duration of audio data in seconds"""
        if not self.validate_audio_data(audio_data):
            return 0.0
        
        # Calculate duration assuming 16-bit PCM
        num_samples = len(audio_data) // 2  # 2 bytes per sample
        duration = num_samples / self.config.sample_rate
        return duration
