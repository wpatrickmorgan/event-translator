# LiveKit Translation Worker

A modular Python worker that provides real-time speech-to-text, translation, and text-to-speech for LiveKit events using the standard LiveKit SDK.

## Features

- **Real-time Speech-to-Text**: Google Cloud Speech streaming recognition
- **Multi-language Translation**: Google Cloud Translation API
- **Text-to-Speech**: Per-language audio tracks with Google Cloud TTS
- **Modular Architecture**: Pluggable providers for easy extension
- **Standard LiveKit SDK**: Clean, modern implementation

## How It Works

1. **Event Detection**: Polls Supabase for active events (status = 'live')
2. **Room Connection**: Connects directly to LiveKit rooms using access tokens
3. **Audio Processing**: Streams incoming audio to Google Cloud Speech-to-Text
4. **Translation**: Translates transcripts to configured target languages
5. **TTS Output**: Synthesizes translated text and publishes as audio tracks
6. **Data Publishing**: Publishes captions and translations via LiveKit data channel

## Architecture

```
worker/
├── main.py                     # Entry point and worker management
├── worker.py                   # Core translation worker
├── config.py                   # Configuration management
├── models.py                   # Data models
├── providers/                  # Provider implementations
│   ├── base.py                # Abstract interfaces
│   └── google/                # Google Cloud providers
└── audio/                     # Audio processing
└── room/                      # LiveKit room management
```

## Environment Variables

### Required - LiveKit
- `LIVEKIT_URL` or `LIVEKIT_SERVER_URL`: LiveKit server URL
- `LIVEKIT_API_KEY`: LiveKit API key  
- `LIVEKIT_API_SECRET`: LiveKit API secret

### Required - Supabase  
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

### Required - Google Cloud
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`: Service account JSON (as string)

### Optional - Provider Selection
- `STT_PROVIDER`: Speech-to-text provider (default: "google")
- `TTS_PROVIDER`: Text-to-speech provider (default: "google")  
- `TRANSLATE_PROVIDER`: Translation provider (default: "google")

### Optional - Audio Configuration
- `AUDIO_SAMPLE_RATE`: Sample rate in Hz (default: 48000)
- `AUDIO_CHANNELS`: Number of channels (default: 1)
- `AUDIO_FRAME_SAMPLES`: Samples per frame (default: 480)

## Data Message Schema

The worker publishes JSON messages via LiveKit's reliable data channel:

### Original Language Captions
```json
{
  "type": "caption",
  "lang": "en-US", 
  "text": "hello world",
  "isFinal": true
}
```

### Translation Text
```json
{
  "type": "translation-text-es-ES",
  "srcLang": "en-US",
  "lang": "es-ES", 
  "text": "hola mundo",
  "isFinal": true
}
```

### Audio Tracks
Published as LiveKit audio tracks named: `translation-audio-{language}`

## Room Metadata

The worker reads room metadata to configure languages:

```json
{
  "sourceLanguage": "en-US",
  "outputs": [
    {"lang": "es-ES", "captions": true, "audio": true},
    {"lang": "fr-FR", "captions": true, "audio": false}
  ]
}
```

## Development

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export LIVEKIT_URL=wss://your-server.livekit.cloud
export LIVEKIT_API_KEY=your-api-key
export LIVEKIT_API_SECRET=your-api-secret
export NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'

# Run worker
python main.py
```

### Docker
```bash
# Build
docker build -t translation-worker .

# Run
docker run --env-file .env translation-worker
```

### Testing
```bash
# Type checking
mypy --config-file mypy.ini .

# Run specific modules
python -m pytest tests/
```

## Extending with New Providers

The modular architecture makes it easy to add new providers:

### 1. Implement Provider Interface
```python
# providers/openai/stt.py
class OpenAISTTProvider(STTProvider):
    async def initialize(self, config):
        # OpenAI Whisper setup
        pass
    
    def create_stream(self, language):
        # Create OpenAI STT stream
        pass
```

### 2. Register Provider
```python
# providers/__init__.py
PROVIDER_FACTORIES = {
    "google": GoogleProviderFactory,
    "openai": OpenAIProviderFactory,  # Add new provider
}
```

### 3. Use via Environment
```bash
STT_PROVIDER=openai
```

## Deployment

### Railway
1. Create Railway service
2. Set environment variables  
3. Deploy from GitHub
4. Worker automatically starts and polls for events

### Scaling
- One worker instance handles all active events
- Automatically switches between events as needed
- Graceful cleanup when events end

## Error Handling

- Automatic retry on connection failures
- Graceful degradation when services are unavailable
- Comprehensive logging for debugging
- Health monitoring via worker status logs

## Performance

- Optimized for real-time processing
- Minimal memory footprint
- Efficient audio streaming
- Connection pooling for external APIs

## Troubleshooting

### Worker Not Starting
- Check all required environment variables are set
- Verify Supabase connection and table permissions
- Check LiveKit server connectivity

### No Audio Processing  
- Verify room metadata is correctly set
- Check that audio tracks are being published to the room
- Ensure Google Cloud credentials have proper permissions

### Translation Issues
- Verify Google Cloud Translation API is enabled
- Check language codes are supported
- Monitor API quotas and usage limits

For additional support, check the application logs for detailed error messages.