# LiveKit Translation Bot Worker

A Python worker that provides real-time speech-to-text, translation, and per-language TTS audio for LiveKit events.

## Purpose

This worker:
1. Joins a LiveKit room as a bot participant
2. Subscribes to the main remote audio track
3. Streams audio to Google Cloud Speech-to-Text (streaming)
4. Publishes original-language text and legacy caption messages via data channel
5. Translates text to configured target languages and publishes translation text messages
6. Synthesizes TTS for final translations and publishes per-language audio tracks

## Data Message Schema

Messages are published as JSON on the LiveKit reliable data channel:

```
{ "type": "caption", "lang": "en-US", "text": "hello world", "isFinal": false }
```

- `type`: Always "caption" (backward compatibility)
- `lang`: Source language code
- `text`: Transcribed text
- `isFinal`: `true` for final results, `false` for interim results

Original-language text (new):

```
{ "type": "original-language-text", "lang": "en-US", "text": "hello", "isFinal": false, "seq": 12, "ts": 1737352000123 }
```

Translation text per language:

```
{ "type": "translation-text-es-ES", "srcLang": "en-US", "lang": "es-ES", "text": "hola", "isFinal": false, "seq": 12, "ts": 1737352000123 }
```

Optional TTS audio markers:

```
{ "type": "translation-audio-es-ES", "status": "start|end|error", "seq": 12, "ts": 1737352000456 }
```

## Environment Variables

### Service-level (Railway service secrets)

- `LIVEKIT_URL`: LiveKit server URL
- `LIVEKIT_API_KEY`: LiveKit API key
- `LIVEKIT_API_SECRET`: LiveKit API secret

### Google Cloud Credentials (choose one)

**Preferred method:**
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`: Full JSON content of service account key

**Alternative method:**
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account key file

### Event-scoped (injected by app when starting event)

- `EVENT_ID`: Unique event identifier
- `ROOM_NAME`: LiveKit room name
- `LANG_CODES`: Comma-separated language codes (first is source, rest are targets; e.g., "en-US,es-ES,fr-FR")
- `MODE`: Operation mode (ignored in this MVP)
- `VOICE_CODES` (optional): Map target voices, e.g., `es-ES:es-ES-Standard-A,fr-FR:fr-FR-Standard-A`

## Local Development

### Prerequisites

- Python 3.11+
- Google Cloud service account with Speech-to-Text API enabled

### Setup

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set environment variables:
```bash
export LIVEKIT_URL="wss://your-livekit-server.com"
export LIVEKIT_API_KEY="your-api-key"
export LIVEKIT_API_SECRET="your-api-secret"
export EVENT_ID="test-event"
export ROOM_NAME="test-room"
export LANG_CODES="en-US"
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
```

4. Run the worker:
```bash
python main.py
```

## Docker

### Build

```bash
docker build -t translation-bot .
```

### Run

```bash
docker run -e LIVEKIT_URL="wss://your-livekit-server.com" \
           -e LIVEKIT_API_KEY="your-api-key" \
           -e LIVEKIT_API_SECRET="your-api-secret" \
           -e EVENT_ID="test-event" \
           -e ROOM_NAME="test-room" \
           -e LANG_CODES="en-US" \
           -e GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}' \
           translation-bot
```

### With credentials file

```bash
docker run -e LIVEKIT_URL="wss://your-livekit-server.com" \
           -e LIVEKIT_API_KEY="your-api-key" \
           -e LIVEKIT_API_SECRET="your-api-secret" \
           -e EVENT_ID="test-event" \
           -e ROOM_NAME="test-room" \
           -e LANG_CODES="en-US" \
           -e GOOGLE_APPLICATION_CREDENTIALS="/app/credentials.json" \
           -v /path/to/credentials.json:/app/credentials.json \
           translation-bot
```

## Railway Deployment

### Service Setup

1. Create a new Railway service
2. Set service-level secrets:
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON`

3. The app automatically injects per-event variables when starting events:
   - `EVENT_ID`
   - `ROOM_NAME`
   - `LANG_CODES`
   - `MODE`

### Railway Configuration

The worker is designed to be scaled by the main app per event. Each worker instance handles one event and automatically connects to the specified room.

## Behavior

### Connection Flow

1. Worker starts and reads environment variables
2. Sets up Google Cloud credentials (writes JSON to `/app/gcp-key.json` if needed)
3. Creates LiveKit JWT token with identity `translation-bot:{EVENT_ID}` (with canPublish)
4. Connects to the specified room with appropriate grants

### Audio Processing

1. Waits for a remote audio track from non-bot participants
2. Subscribes to the first available audio track
3. Converts incoming float32 PCM audio to LINEAR16 format (48kHz mono)
4. Streams audio continuously to Google Cloud STT

### Caption/Translation Publishing

1. Receives STT results (both interim and final)
2. Publishes original-language and legacy caption messages
3. Publishes translation messages for configured target languages
4. Uses reliable data channel for guaranteed delivery

### Cleanup

- Gracefully handles disconnections
- Closes STT streaming session
- Disconnects from LiveKit room
- Exits cleanly

## Error Handling

- Retries STT client creation with exponential backoff
- Handles missing audio tracks (waits up to 30 seconds)
- Continues processing despite individual frame errors
- Logs errors without crashing the process

## Dependencies

- `livekit-agents`: LiveKit Python SDK
- `google-cloud-speech`: Google Cloud Speech-to-Text
- `google-cloud-translate`: Google Cloud Translation v3
- `google-cloud-texttospeech`: Google Cloud Text-to-Speech
- `numpy`: Audio processing
- `tenacity`: Retry logic
- `websockets`: WebSocket support
- `httpx`: HTTP client
- `fastapi` & `uvicorn`: Optional health endpoint

## Limitations (MVP)

This MVP implementation does NOT include:
- Supabase logging
- Audio track switching during runtime
