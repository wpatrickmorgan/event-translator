"""
Configuration and metadata parsing utilities.
"""
import json
import logging
import os
from typing import Dict, Any, List, Tuple, Optional

from .models import WorkerConfig, AudioConfig

logger = logging.getLogger(__name__)


def load_worker_config_from_env() -> WorkerConfig:
    """Load worker configuration from environment variables"""
    # Google Cloud credentials
    credentials_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    credentials_info = None
    gcp_project_id = None
    
    if credentials_json:
        try:
            credentials_info = json.loads(credentials_json)
            gcp_project_id = credentials_info.get("project_id")
            logger.info("Using Google credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON")
        except Exception as e:
            logger.warning(f"Failed to parse Google credentials: {e}")
    else:
        logger.info("No GOOGLE_APPLICATION_CREDENTIALS_JSON found, using default credentials")
    
    # Provider configurations (with defaults)
    stt_provider = os.getenv("STT_PROVIDER", "google").lower()
    tts_provider = os.getenv("TTS_PROVIDER", "google").lower() 
    translate_provider = os.getenv("TRANSLATE_PROVIDER", "google").lower()
    
    return WorkerConfig(
        primary_language="en-US",  # Will be overridden by room metadata
        translation_targets=[],    # Will be overridden by room metadata
        audio_targets=[],          # Will be overridden by room metadata
        stt_provider=stt_provider,
        tts_provider=tts_provider,
        translate_provider=translate_provider,
        gcp_project_id=gcp_project_id,
        gcp_credentials_info=credentials_info
    )


def load_audio_config_from_env() -> AudioConfig:
    """Load audio configuration from environment variables"""
    sample_rate = int(os.getenv("AUDIO_SAMPLE_RATE", "48000"))
    num_channels = int(os.getenv("AUDIO_CHANNELS", "1"))
    frame_samples = int(os.getenv("AUDIO_FRAME_SAMPLES", "480"))
    
    return AudioConfig(
        sample_rate=sample_rate,
        num_channels=num_channels,
        frame_samples=frame_samples
    )


def parse_room_metadata(metadata: str) -> Tuple[List[str], List[str], Optional[str]]:
    """
    Parse translation targets and source language from room metadata.
    
    Returns:
        Tuple of (translation_targets, audio_targets, source_language)
    """
    t_targets: List[str] = []
    a_targets: List[str] = []
    src_lang: Optional[str] = None
    
    try:
        if not metadata:
            logger.warning("No room metadata provided")
            return t_targets, a_targets, src_lang
        
        metadata_obj = json.loads(metadata)
        logger.info(f"Room metadata: {metadata_obj}")
        
        # Parse source language
        src = metadata_obj.get("sourceLanguage")
        if isinstance(src, str) and src:
            src_lang = src
        
        # Parse output configurations
        outputs = metadata_obj.get("outputs")
        if isinstance(outputs, list):
            for output in outputs:
                if not isinstance(output, dict):
                    continue
                
                lang = output.get("lang")
                if not isinstance(lang, str) or not lang:
                    continue
                
                # Check if captions are enabled
                if output.get("captions") is True:
                    t_targets.append(lang)
                
                # Check if audio is enabled
                if output.get("audio") is True:
                    a_targets.append(lang)
        
        logger.info(f"Parsed metadata - src_lang: {src_lang}, translation_targets: {t_targets}, audio_targets: {a_targets}")
        
    except Exception as e:
        logger.error(f"Failed to parse room metadata: {e}")
    
    return t_targets, a_targets, src_lang


def update_config_from_metadata(
    config: WorkerConfig, 
    metadata: str
) -> WorkerConfig:
    """Update worker configuration with room metadata"""
    t_targets, a_targets, src_lang = parse_room_metadata(metadata)
    
    # Update configuration
    if src_lang:
        config.primary_language = src_lang
    
    # Remove duplicates and filter out primary language
    config.translation_targets = [
        lang for lang in dict.fromkeys(t_targets) 
        if lang and lang != config.primary_language
    ]
    config.audio_targets = [
        lang for lang in dict.fromkeys(a_targets) 
        if lang and lang != config.primary_language
    ]
    
    logger.info(
        f"Updated config - primary_language: {config.primary_language}, "
        f"translation_targets: {config.translation_targets}, "
        f"audio_targets: {config.audio_targets}"
    )
    
    return config


def get_provider_config(config: WorkerConfig) -> Dict[str, Any]:
    """Get provider configuration dictionary"""
    return {
        "gcp_project_id": config.gcp_project_id,
        "gcp_credentials_info": config.gcp_credentials_info,
        "stt_provider": config.stt_provider,
        "tts_provider": config.tts_provider,
        "translate_provider": config.translate_provider
    }


def validate_config(config: WorkerConfig) -> bool:
    """Validate worker configuration"""
    if not config.primary_language:
        logger.error("Primary language not configured")
        return False
    
    # Validate provider names
    valid_providers = ["google"]  # Can be extended as more providers are added
    
    if config.stt_provider not in valid_providers:
        logger.error(f"Invalid STT provider: {config.stt_provider}")
        return False
    
    if config.tts_provider not in valid_providers:
        logger.error(f"Invalid TTS provider: {config.tts_provider}")
        return False
    
    if config.translate_provider not in valid_providers:
        logger.error(f"Invalid translation provider: {config.translate_provider}")
        return False
    
    logger.info("Configuration validation passed")
    return True
