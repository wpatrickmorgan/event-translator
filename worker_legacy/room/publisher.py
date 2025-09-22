"""
Data publishing utilities for LiveKit rooms.
"""
import json
import logging
from typing import Dict, Any
from livekit import rtc

from ..models import MessageData, TranscriptionResult, TranslationResult

logger = logging.getLogger(__name__)


class DataPublisher:
    """Publishes data messages to LiveKit room data channel"""
    
    def __init__(self, room: rtc.Room):
        self.room = room
    
    async def publish_message(self, message: MessageData) -> None:
        """Publish a message to the room data channel"""
        try:
            data = json.dumps(message.to_dict()).encode('utf-8')
            await self.room.local_participant.publish_data(data)
        except Exception as e:
            logger.error(f"Error publishing message: {e}")
    
    async def publish_transcription(self, result: TranscriptionResult) -> None:
        """Publish a transcription result"""
        # Publish caption message
        caption_msg = MessageData(
            type="caption",
            lang=result.language,
            text=result.text,
            is_final=result.is_final
        )
        await self.publish_message(caption_msg)
        
        # Publish original language text message
        original_msg = MessageData(
            type="original-language-text",
            lang=result.language,
            text=result.text,
            is_final=result.is_final
        )
        await self.publish_message(original_msg)
    
    async def publish_translation(self, result: TranslationResult) -> None:
        """Publish a translation result"""
        translation_msg = MessageData(
            type=f"translation-text-{result.target_language}",
            src_lang=result.source_language,
            lang=result.target_language,
            text=result.text,
            is_final=True
        )
        await self.publish_message(translation_msg)
    
    async def publish_custom_data(self, data: Dict[str, Any]) -> None:
        """Publish custom data to the room"""
        try:
            json_data = json.dumps(data).encode('utf-8')
            await self.room.local_participant.publish_data(json_data)
        except Exception as e:
            logger.error(f"Error publishing custom data: {e}")
    
    async def publish_status_message(self, status: str, details: str = "") -> None:
        """Publish a status message"""
        status_msg = MessageData(
            type="status",
            text=f"{status}: {details}" if details else status
        )
        await self.publish_message(status_msg)
    
    async def publish_error_message(self, error: str, context: str = "") -> None:
        """Publish an error message"""
        error_msg = MessageData(
            type="error",
            text=f"{context}: {error}" if context else error
        )
        await self.publish_message(error_msg)
