"""
Provider implementations for STT, TTS, and Translation services.
"""
from .base import STTProvider, TTSProvider, TranslateProvider, ProviderFactory
from .google import GoogleProviderFactory

# Provider factory registry
PROVIDER_FACTORIES = {
    "google": GoogleProviderFactory,
}

def get_provider_factory(provider_name: str) -> ProviderFactory:
    """Get provider factory by name"""
    if provider_name not in PROVIDER_FACTORIES:
        raise ValueError(f"Unknown provider: {provider_name}")
    return PROVIDER_FACTORIES[provider_name]()

__all__ = [
    "STTProvider",
    "TTSProvider", 
    "TranslateProvider",
    "ProviderFactory",
    "GoogleProviderFactory",
    "get_provider_factory"
]
