"""
Google Cloud Speech-to-Text provider implementation (Direct API).
"""
import asyncio
import logging
import json
import io
from typing import AsyncIterator, Dict, Any, Optional
from enum import Enum

from livekit import rtc
from google.cloud import speech
from google.oauth2 import service_account
import numpy as np

from ...models import TranscriptionResult
from ..base import STTProvider, STTStream

logger = logging.getLogger(__name__)


class SpeechEventType(Enum):
    """Speech event types (replaces agents framework enum)"""
    INTERIM_TRANSCRIPT = "interim_transcript"
    FINAL_TRANSCRIPT = "final_transcript"


class GoogleSTTStream(STTStream):
    """Google Cloud Speech-to-Text streaming implementation"""
    
    def __init__(self, language: str, client: speech.SpeechAsyncClient, config: speech.RecognitionConfig):
        self.language = language
        self.client = client
        self.config = config
        self._closed = False
        self._audio_queue = asyncio.Queue()
        self._stream_task: Optional[asyncio.Task] = None
        self._result_queue = asyncio.Queue()
        
    def push_frame(self, frame: rtc.AudioFrame) -> None:
        """Push an audio frame to the STT stream"""
        if not self._closed:
            # Convert LiveKit audio frame to bytes for Google Speech
            # LiveKit frame data is already in the right format for streaming
            audio_data = self._convert_frame_to_bytes(frame)
            try:
                self._audio_queue.put_nowait(audio_data)
            except asyncio.QueueFull:
                logger.warning("Audio queue full, dropping frame")
    
    def _convert_frame_to_bytes(self, frame: rtc.AudioFrame) -> bytes:
        """Convert LiveKit AudioFrame to bytes suitable for Google Speech"""
        # LiveKit audio frames contain float32 PCM data
        # Google Speech expects LINEAR16 (16-bit PCM)
        
        # Convert frame data bytes back to numpy array
        float_data = np.frombuffer(frame.data, dtype=np.float32)
        
        # Convert to 16-bit integers
        int16_data = (float_data * 32767).astype(np.int16)
        
        return int16_data.tobytes()
    
    async def _start_streaming(self):
        """Start the Google Speech streaming recognition"""
        if self._stream_task:
            return
            
        self._stream_task = asyncio.create_task(self._stream_audio())
    
    async def _stream_audio(self):
        """Stream audio to Google Speech and process results"""
        try:
            # Create streaming request generator
            async def request_generator():
                # First request with config
                yield speech.StreamingRecognizeRequest(
                    streaming_config=speech.StreamingRecognitionConfig(
                        config=self.config,
                        interim_results=True,
                    )
                )
                
                # Subsequent requests with audio data
                while not self._closed:
                    try:
                        # Wait for audio data with timeout
                        audio_data = await asyncio.wait_for(
                            self._audio_queue.get(), 
                            timeout=1.0
                        )
                        yield speech.StreamingRecognizeRequest(audio_content=audio_data)
                    except asyncio.TimeoutError:
                        # Send keepalive or continue
                        continue
                    except Exception as e:
                        logger.error(f"Error getting audio data: {e}")
                        break
            
            # Start streaming recognition
            streaming_recognize = self.client.streaming_recognize(
                requests=request_generator(),
                timeout=60.0
            )
            
            # Process responses
            async for response in streaming_recognize:
                if not response.results:
                    continue
                    
                result = response.results[0]
                if result.alternatives:
                    alt = result.alternatives[0]
                    
                    transcript_result = TranscriptionResult(
                        text=alt.transcript,
                        language=self.language,
                        is_final=result.is_final,
                        confidence=alt.confidence if result.is_final else 0.0
                    )
                    
                    # Only queue final results for now (can add interim later)
                    if result.is_final:
                        await self._result_queue.put(transcript_result)
        
        except Exception as e:
            logger.error(f"Error in Google Speech streaming: {e}")
        finally:
            logger.debug("Google Speech streaming ended")
    
    async def __anext__(self) -> TranscriptionResult:
        """Get next transcription result"""
        if self._closed:
            raise StopAsyncIteration
        
        # Start streaming if not already started
        if not self._stream_task:
            await self._start_streaming()
        
        try:
            # Wait for results with timeout
            result = await asyncio.wait_for(
                self._result_queue.get(),
                timeout=30.0  # 30 second timeout
            )
            return result
        except asyncio.TimeoutError:
            # No results - continue waiting
            if not self._closed:
                return await self.__anext__()
            else:
                raise StopAsyncIteration
    
    async def aclose(self) -> None:
        """Close the STT stream and cleanup resources"""
        if not self._closed:
            self._closed = True
            
            # Cancel streaming task
            if self._stream_task and not self._stream_task.done():
                self._stream_task.cancel()
                try:
                    await self._stream_task
                except asyncio.CancelledError:
                    pass
            
            logger.debug("Google STT stream closed")


class GoogleSTTProvider(STTProvider):
    """Google Cloud Speech-to-Text provider (Direct API)"""
    
    def __init__(self):
        self._client: Optional[speech.SpeechAsyncClient] = None
        self._credentials_info: Optional[Dict[str, Any]] = None
    
    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize the Google Speech client"""
        self._credentials_info = config.get("gcp_credentials_info")
        
        # Initialize Google Cloud Speech client
        if self._credentials_info:
            credentials = service_account.Credentials.from_service_account_info(
                self._credentials_info
            )
            self._client = speech.SpeechAsyncClient(credentials=credentials)
        else:
            # Use default credentials (from environment)
            self._client = speech.SpeechAsyncClient()
        
        logger.info("Google Cloud Speech-to-Text client initialized")
    
    def create_stream(self, language: str) -> GoogleSTTStream:
        """Create a new STT stream for the specified language"""
        if not self._client:
            raise RuntimeError("Google STT provider not initialized")
        
        # Create recognition config
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=48000,  # LiveKit default
            language_code=language,
            enable_automatic_punctuation=True,
            use_enhanced=True,  # Use enhanced model if available
            model="latest_long",  # Use latest long-form model
        )
        
        return GoogleSTTStream(language, self._client, config)
