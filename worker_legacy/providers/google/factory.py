"""
Google Cloud provider factory implementation.
"""
from ..base import ProviderFactory, STTProvider, TTSProvider, TranslateProvider
from .stt import GoogleSTTProvider
from .tts import GoogleTTSProvider
from .translate import GoogleTranslateProvider


class GoogleProviderFactory(ProviderFactory):
    """Factory for creating Google Cloud providers"""
    
    def create_stt_provider(self) -> STTProvider:
        """Create Google STT provider instance"""
        return GoogleSTTProvider()
    
    def create_tts_provider(self) -> TTSProvider:
        """Create Google TTS provider instance"""
        return GoogleTTSProvider()
    
    def create_translate_provider(self) -> TranslateProvider:
        """Create Google Translate provider instance"""
        return GoogleTranslateProvider()
