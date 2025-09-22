"""
Google Cloud Text-to-Speech provider implementation (Direct API).
"""
import asyncio
import logging
from typing import AsyncIterator, Dict, Any, List, Optional

from google.cloud import texttospeech
from google.oauth2 import service_account

from ...models import TTSRequest
from ..base import TTSProvider

logger = logging.getLogger(__name__)


class GoogleTTSProvider(TTSProvider):
    """Google Cloud Text-to-Speech provider (Direct API)"""
    
    def __init__(self):
        self._client: Optional[texttospeech.TextToSpeechAsyncClient] = None
        self._credentials_info: Optional[Dict[str, Any]] = None
        self._voice_cache: Dict[str, List[str]] = {}  # Cache for available voices
    
    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize the Google TTS provider"""
        self._credentials_info = config.get("gcp_credentials_info")
        
        # Initialize Google Cloud TTS client
        if self._credentials_info:
            credentials = service_account.Credentials.from_service_account_info(
                self._credentials_info
            )
            self._client = texttospeech.TextToSpeechAsyncClient(credentials=credentials)
        else:
            # Use default credentials
            self._client = texttospeech.TextToSpeechAsyncClient()
        
        logger.info("Google Cloud Text-to-Speech client initialized")
    
    def _get_voice_for_language(self, language: str, voice_name: Optional[str] = None) -> str:
        """Get appropriate voice for language"""
        if voice_name:
            return voice_name
        
        # Special handling for Spanish (hardcoded for now)
        if language.startswith("es"):
            return "es-ES-Chirp-HD-D"
        elif language.startswith("en"):
            return "en-US-Standard-A"
        elif language.startswith("fr"):
            return "fr-FR-Standard-A"
        elif language.startswith("de"):
            return "de-DE-Standard-A"
        else:
            # Default fallback
            return "en-US-Standard-A"
    
    def _normalize_language_code(self, language: str) -> str:
        """Normalize language code for Google TTS"""
        # Map common variants to full locale codes
        language_map = {
            "es": "es-ES",
            "en": "en-US", 
            "fr": "fr-FR",
            "de": "de-DE",
        }
        
        return language_map.get(language, language)
    
    async def synthesize(self, request: TTSRequest) -> AsyncIterator[bytes]:
        """Synthesize speech from text"""
        if not self._client:
            logger.error("TTS client not initialized")
            return
            
        try:
            # Prepare TTS request
            voice_name = self._get_voice_for_language(request.language, request.voice_name)
            language_code = self._normalize_language_code(request.language)
            
            # Create synthesis input
            synthesis_input = texttospeech.SynthesisInput(text=request.text)
            
            # Configure voice
            voice = texttospeech.VoiceSelectionParams(
                language_code=language_code,
                name=voice_name
            )
            
            # Configure audio
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                sample_rate_hertz=48000  # Match LiveKit sample rate
            )
            
            # Perform synthesis
            response = await self._client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config,
                timeout=30.0
            )
            
            # Yield the entire audio content
            # Note: Google TTS returns complete audio, not streaming chunks
            if response.audio_content:
                yield response.audio_content
            
        except Exception as e:
            logger.error(f"TTS synthesis error for {request.language}: {e}")
            # Don't yield anything on error
            return
    
    def get_available_voices(self, language: str) -> List[str]:
        """Get available voices for a language"""
        # This is a simplified implementation with common voices
        # In production, you'd query the Google TTS API for available voices
        
        if language in self._voice_cache:
            return self._voice_cache[language]
        
        # Define common voices by language
        voices_by_language = {
            "es-ES": ["es-ES-Chirp-HD-D", "es-ES-Standard-A", "es-ES-Wavenet-B", "es-ES-Wavenet-C"],
            "es": ["es-ES-Chirp-HD-D", "es-ES-Standard-A", "es-ES-Wavenet-B"],
            "en-US": ["en-US-Standard-A", "en-US-Wavenet-A", "en-US-Wavenet-D", "en-US-Neural2-A"],
            "en": ["en-US-Standard-A", "en-US-Wavenet-A", "en-US-Neural2-A"],
            "fr-FR": ["fr-FR-Standard-A", "fr-FR-Wavenet-A", "fr-FR-Wavenet-B"],
            "fr": ["fr-FR-Standard-A", "fr-FR-Wavenet-A"],
            "de-DE": ["de-DE-Standard-A", "de-DE-Wavenet-A", "de-DE-Wavenet-B"],
            "de": ["de-DE-Standard-A", "de-DE-Wavenet-A"],
        }
        
        voices = voices_by_language.get(language, ["en-US-Standard-A"])
        self._voice_cache[language] = voices
        return voices
