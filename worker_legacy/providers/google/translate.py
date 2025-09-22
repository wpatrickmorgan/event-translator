"""
Google Cloud Translation provider implementation.
"""
import asyncio
import logging
from typing import Dict, Any, List, Optional

from google.cloud import translate_v3 as translate
from google.oauth2 import service_account

from ...models import TranslationResult
from ..base import TranslateProvider

logger = logging.getLogger(__name__)


class GoogleTranslateProvider(TranslateProvider):
    """Google Cloud Translation provider"""
    
    def __init__(self):
        self._client: Optional[translate.TranslationServiceClient] = None
        self._project_id: Optional[str] = None
    
    async def initialize(self, config: Dict[str, Any]) -> None:
        """Initialize the Google Translate provider"""
        credentials_info = config.get("gcp_credentials_info")
        self._project_id = config.get("gcp_project_id")
        
        try:
            if credentials_info:
                credentials = service_account.Credentials.from_service_account_info(credentials_info)
                self._client = translate.TranslationServiceClient(credentials=credentials)
                # Extract project_id from credentials if not provided
                if not self._project_id:
                    self._project_id = credentials_info.get("project_id")
                logger.info("Google Translate client initialized with provided credentials")
            else:
                self._client = translate.TranslationServiceClient()
                logger.info("Google Translate client initialized with default credentials")
        except Exception as e:
            logger.error(f"Failed to initialize Google Translate client: {e}")
            raise
    
    async def translate(
        self, 
        text: str, 
        source_language: str, 
        target_language: str
    ) -> TranslationResult:
        """Translate text from source to target language"""
        if not self._client or not self._project_id:
            logger.warning("Google Translate not available, returning original text")
            return TranslationResult(
                text=text,
                source_language=source_language,
                target_language=target_language,
                original_text=text
            )
        
        parent = f"projects/{self._project_id}/locations/global"
        
        def _translate() -> str:
            request = translate.TranslateTextRequest(
                parent=parent,
                contents=[text],
                mime_type="text/plain",
                source_language_code=source_language,
                target_language_code=target_language,
            )
            response = self._client.translate_text(request=request)
            return response.translations[0].translated_text if response.translations else text
        
        try:
            translated_text = await asyncio.to_thread(_translate)
            return TranslationResult(
                text=translated_text,
                source_language=source_language,
                target_language=target_language,
                original_text=text
            )
        except Exception as e:
            logger.error(f"Translation error ({source_language} -> {target_language}): {e}")
            return TranslationResult(
                text=text,
                source_language=source_language,
                target_language=target_language,
                original_text=text
            )
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported language codes"""
        # This is a simplified list of commonly supported languages
        # In practice, you'd query the Google Translate API for the full list
        return [
            "en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh",
            "ar", "hi", "th", "vi", "tr", "pl", "nl", "sv", "da", "no"
        ]
