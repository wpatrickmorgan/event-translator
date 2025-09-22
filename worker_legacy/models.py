"""
Data models and types for the translation worker.
"""
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from enum import Enum


class TranscriptionEventType(Enum):
    """Types of transcription events"""
    INTERIM = "interim"
    FINAL = "final"


@dataclass
class TranscriptionResult:
    """Result from speech-to-text processing"""
    text: str
    language: str
    is_final: bool
    confidence: float = 0.0


@dataclass
class TranslationResult:
    """Result from translation processing"""
    text: str
    source_language: str
    target_language: str
    original_text: str


@dataclass
class TTSRequest:
    """Request for text-to-speech synthesis"""
    text: str
    language: str
    voice_name: Optional[str] = None


@dataclass
class WorkerConfig:
    """Configuration for the translation worker"""
    primary_language: str
    translation_targets: List[str]
    audio_targets: List[str]
    
    # Provider configurations
    stt_provider: str = "google"
    tts_provider: str = "google" 
    translate_provider: str = "google"
    
    # Google Cloud specific
    gcp_project_id: Optional[str] = None
    gcp_credentials_info: Optional[Dict[str, Any]] = None


@dataclass
class AudioConfig:
    """Audio processing configuration"""
    sample_rate: int = 48000
    num_channels: int = 1
    frame_samples: int = 480


@dataclass
class MessageData:
    """Data structure for room messages"""
    type: str
    lang: Optional[str] = None
    src_lang: Optional[str] = None
    text: Optional[str] = None
    is_final: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = {"type": self.type, "isFinal": self.is_final}
        if self.lang is not None:
            result["lang"] = self.lang
        if self.src_lang is not None:
            result["srcLang"] = self.src_lang
        if self.text is not None:
            result["text"] = self.text
        return result
