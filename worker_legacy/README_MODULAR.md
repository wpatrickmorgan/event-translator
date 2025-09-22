# Modular Architecture Guide

This document describes the modular architecture of the LiveKit translation worker, designed for easy extensibility and provider flexibility.

## Architecture Overview

The worker has been refactored from a monolithic 523-line `main.py` into a clean modular architecture:

```
worker/
├── main.py                      # Entry point and worker management
├── worker.py                    # Core translation worker
├── models.py                    # Data models and types
├── config.py                    # Configuration management
├── providers/                   # Provider implementations
│   ├── __init__.py             # Provider factory registry
│   ├── base.py                 # Abstract base classes
│   └── google/                 # Google Cloud providers
│       ├── factory.py          # Google provider factory
│       ├── stt.py              # Google STT implementation
│       ├── tts.py              # Google TTS implementation
│       └── translate.py        # Google Translate implementation
├── audio/                       # Audio processing
│   ├── processor.py            # Audio track processing
│   └── converter.py            # Audio format conversion
└── room/                        # Room management
    ├── manager.py              # Room event management
    └── publisher.py            # Data publishing utilities
```

## Key Benefits

### 1. Provider Flexibility
Switch providers via environment variables:
```bash
STT_PROVIDER=google          # or future: openai, azure
TTS_PROVIDER=google          # or future: elevenlabs, aws_polly  
TRANSLATE_PROVIDER=google    # or future: deepl, azure
```

### 2. Clean Interfaces
All providers implement standard interfaces ensuring consistency:
- `STTProvider` - Speech-to-text functionality
- `TTSProvider` - Text-to-speech synthesis  
- `TranslateProvider` - Text translation

### 3. Easy Extension
Adding a new provider is simple:

```python
# providers/openai/stt.py
class OpenAISTTProvider(STTProvider):
    async def initialize(self, config: Dict[str, Any]) -> None:
        # OpenAI-specific initialization
        pass
    
    def create_stream(self, language: str) -> STTStream:
        # Create OpenAI Whisper stream
        pass

# Register in providers/__init__.py
PROVIDER_FACTORIES["openai"] = OpenAIProviderFactory
```

### 4. Better Testing
Each component can be tested in isolation:
- Mock providers for unit tests
- Test audio processing separately
- Test room management independently

### 5. Improved Error Handling
Provider-specific error handling and graceful degradation.

## Configuration

### Environment Variables

#### Provider Selection
- `STT_PROVIDER` - Speech-to-text provider (default: "google")
- `TTS_PROVIDER` - Text-to-speech provider (default: "google") 
- `TRANSLATE_PROVIDER` - Translation provider (default: "google")

#### Audio Configuration  
- `AUDIO_SAMPLE_RATE` - Sample rate in Hz (default: 48000)
- `AUDIO_CHANNELS` - Number of channels (default: 1)
- `AUDIO_FRAME_SAMPLES` - Samples per frame (default: 480)

#### Google Cloud (existing)
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` - Google service account JSON

### Room Metadata
The worker still supports the same room metadata format for language configuration:

```json
{
  "sourceLanguage": "en-US",
  "outputs": [
    {"lang": "es", "captions": true, "audio": true},
    {"lang": "fr", "captions": true, "audio": false}
  ]
}
```

## Core Components

### ModularTranslationWorker
The main worker class that orchestrates all components:
- Initializes providers based on configuration
- Manages component lifecycle
- Handles transcription and translation workflow

### Provider System
- **Base classes** define standard interfaces
- **Factory pattern** creates provider instances
- **Registry system** manages available providers

### Audio System
- **AudioProcessor** handles incoming audio streams
- **AudioConverter** converts between audio formats
- Clean separation of audio processing logic

### Room System  
- **RoomManager** handles LiveKit room events and audio tracks
- **DataPublisher** publishes messages to room data channel
- Centralized room interaction management

## Implementation Details

The clean modular structure provides:
- **Focused modules** - Each module has a single responsibility
- **Provider abstraction** - Easy to add new STT/TTS/Translation providers
- **Better error handling** - Granular error management per component
- **Testable components** - Each module can be unit tested independently

### Key Features
- Standard LiveKit SDK throughout
- Direct Google Cloud API integration
- Supabase-based event polling
- Clean provider interfaces
- Comprehensive logging and monitoring

## Adding New Providers

### 1. Create Provider Directory
```
providers/newprovider/
├── __init__.py
├── factory.py
├── stt.py
├── tts.py
└── translate.py
```

### 2. Implement Provider Classes
Each provider must implement the base abstract classes:

```python
# providers/newprovider/stt.py
class NewProviderSTT(STTProvider):
    async def initialize(self, config: Dict[str, Any]) -> None:
        # Provider-specific initialization
        pass
    
    def create_stream(self, language: str) -> STTStream:
        # Create provider-specific STT stream
        pass
```

### 3. Create Factory
```python
# providers/newprovider/factory.py  
class NewProviderFactory(ProviderFactory):
    def create_stt_provider(self) -> STTProvider:
        return NewProviderSTT()
    
    def create_tts_provider(self) -> TTSProvider:
        return NewProviderTTS()
        
    def create_translate_provider(self) -> TranslateProvider:
        return NewProviderTranslate()
```

### 4. Register Factory
```python
# providers/__init__.py
from .newprovider import NewProviderFactory

PROVIDER_FACTORIES = {
    "google": GoogleProviderFactory,
    "newprovider": NewProviderFactory,  # Add here
}
```

### 5. Use New Provider
```bash
STT_PROVIDER=newprovider
TTS_PROVIDER=newprovider
TRANSLATE_PROVIDER=newprovider
```

## Development Workflow

1. **Local development** - Test individual components
2. **Provider development** - Create and test new providers  
3. **Integration testing** - Test complete workflow
4. **Production deployment** - Configure providers via environment

## Future Enhancements

The modular architecture enables easy addition of:

- **OpenAI Whisper** - For STT
- **ElevenLabs** - For TTS  
- **DeepL** - For translation
- **Azure Cognitive Services** - Full suite
- **AWS Polly/Transcribe** - AWS providers
- **Custom providers** - Domain-specific implementations

## Production Ready

The modular worker is designed for production use:
- Standard LiveKit SDK for reliability
- Direct Google Cloud APIs for performance
- Comprehensive error handling and logging
- Scalable architecture for future enhancements
- Clean codebase for easy maintenance

This provides a solid foundation for real-time translation services.
