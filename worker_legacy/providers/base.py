"""
Abstract base classes for provider implementations.
"""
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional, Dict, Any, List
from livekit import rtc

from ..models import TranscriptionResult, TranslationResult, TTSRequest


class STTProvider(ABC):
    """Abstract base class for Speech-to-Text providers"""
    
    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize the STT provider with configuration"""
        pass
    
    @abstractmethod
    def create_stream(self, language: str) -> "STTStream":
        """Create a new STT stream for the specified language"""
        pass


class STTStream(ABC):
    """Abstract base class for STT streams"""
    
    @abstractmethod
    def push_frame(self, frame: rtc.AudioFrame) -> None:
        """Push an audio frame to the STT stream"""
        pass
    
    @abstractmethod
    def __aiter__(self) -> AsyncIterator[TranscriptionResult]:
        """Async iterator for transcription results"""
        return self
    
    @abstractmethod
    async def __anext__(self) -> TranscriptionResult:
        """Get next transcription result"""
        pass
    
    @abstractmethod
    async def aclose(self) -> None:
        """Close the STT stream and cleanup resources"""
        pass


class TTSProvider(ABC):
    """Abstract base class for Text-to-Speech providers"""
    
    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize the TTS provider with configuration"""
        pass
    
    @abstractmethod
    async def synthesize(self, request: TTSRequest) -> AsyncIterator[bytes]:
        """Synthesize speech from text"""
        pass
    
    @abstractmethod
    def get_available_voices(self, language: str) -> List[str]:
        """Get available voices for a language"""
        pass


class TranslateProvider(ABC):
    """Abstract base class for Translation providers"""
    
    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize the translation provider with configuration"""
        pass
    
    @abstractmethod
    async def translate(
        self, 
        text: str, 
        source_language: str, 
        target_language: str
    ) -> TranslationResult:
        """Translate text from source to target language"""
        pass
    
    @abstractmethod
    def get_supported_languages(self) -> List[str]:
        """Get list of supported language codes"""
        pass


class ProviderFactory(ABC):
    """Abstract factory for creating providers"""
    
    @abstractmethod
    def create_stt_provider(self) -> STTProvider:
        """Create STT provider instance"""
        pass
    
    @abstractmethod
    def create_tts_provider(self) -> TTSProvider:
        """Create TTS provider instance"""
        pass
    
    @abstractmethod
    def create_translate_provider(self) -> TranslateProvider:
        """Create translation provider instance"""
        pass
