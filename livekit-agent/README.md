# LiveKit Translation Agent for Events

A simple real-time translation agent using Google STT + OpenAI LLM Translation + Google TTS pipeline. **One agent per language pair** for maximum simplicity and reliability.

## 🎯 How It Works

1. **Admin starts event** → Creates LiveKit room
2. **Translation agent joins** (configured for specific target language)
3. **Agent listens** to English speech via Google STT
4. **Agent translates** text using OpenAI LLM with translation instructions
5. **Agent speaks** translation via Google TTS
6. **Attendees receive** translated audio via standard agent audio track
7. **Multiple agents** can run simultaneously for multiple target languages

## 🏗️ Architecture

```
Admin → LiveKit Room → Translation Agent → Translated Audio → Attendees
        (English)      ↓   ↓   ↓         (Target Language)
                    Google  LLM  Google
                     STT  Translate TTS
```

**Pipeline:**
1. **Google STT** converts English speech to text
2. **OpenAI LLM** translates text to target language via instructions  
3. **Google TTS** synthesizes target language speech
4. **LiveKit** streams translated audio to attendees

## 📋 Event Configuration

The agent fetches event configuration from the app's API using the room name:

```
GET /api/events/by-room/{roomName}
```

Returns:
```json
{
  "eventId": "unique-event-id",
  "eventName": "Event Name",
  "orgId": "organization-id",
  "roomName": "room-name",
  "status": "live",
  "sourceLanguage": "en-US",
  "outputs": [
    {
      "lang": "es-ES",
      "captions": true,
      "audio": true,
      "voice": "alloy"
    }
  ]
}
```

## 🚀 Deployment

### Prerequisites

1. **LiveKit Cloud Account** - Sign up at https://cloud.livekit.io
2. **OpenAI API Key** - Get from https://platform.openai.com
3. **LiveKit CLI** - Install via `brew install livekit-cli` or download
4. **Google Cloud Service Account** - Place credentials file in agent folder

### Google Cloud Credentials Setup

The agent automatically loads Google Cloud credentials from a local file:

1. **Download** your service account JSON from Google Cloud Console
2. **Rename** it to: `Google cloud credentials json` (no .json extension)
3. **Place** it in the `livekit-agent/` folder
4. **Done!** The agent will automatically find and use it

```
livekit-agent/
├── agent.py
├── requirements.txt
└── Google cloud credentials json  ← Place your credentials here
```

### Environment Variables

Create a `.env` file:

```bash
# Required - Target language for this agent instance
TARGET_LANGUAGE=es-ES  # Examples: es-ES, fr-FR, de-DE, it-IT, etc.

# Optional - Specific voice for target language  
TARGET_VOICE=es-ES-Standard-A  # See Google Cloud TTS docs for available voices

# Google Cloud credentials are loaded automatically from:
# 'Google cloud credentials json' file in livekit-agent folder
# No environment variable needed - file is detected automatically

# Required - OpenAI API for LLM translation
OPENAI_API_KEY=your_openai_api_key

# Required - LiveKit Connection
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_secret
LIVEKIT_URL=wss://your-project.livekit.cloud

# Optional - App URL for event validation
APP_URL=https://your-app.vercel.app
```

### Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Run tests
python test_local.py

# Test locally with dev mode
python agent.py dev
```

### Deploy to LiveKit Cloud

Deploy one agent per target language:

```bash
# Authenticate with LiveKit Cloud
lk cloud auth

# Deploy Spanish translator (Google credentials loaded from local file)
TARGET_LANGUAGE=es-ES TARGET_VOICE=es-ES-Standard-A lk agent deploy --name spanish-translator

# Deploy French translator  
TARGET_LANGUAGE=fr-FR TARGET_VOICE=fr-FR-Standard-A lk agent deploy --name french-translator

# Deploy German translator
TARGET_LANGUAGE=de-DE TARGET_VOICE=de-DE-Standard-A lk agent deploy --name german-translator

# Check deployment status
lk agent status

# View logs for specific agent
lk agent logs spanish-translator
```

## 📡 Published Tracks

Each agent publishes **standard LiveKit agent tracks**:

- **Audio Track**: Standard agent audio track (no custom naming)
- **Agent Identity**: `translator-{lang}` (e.g., `translator-es-ES`)
- **Transcriptions**: Available via `lk.transcription` text stream

## 🔧 Configuration

### Supported Languages

The agent supports all languages available in Google Cloud services:

**Popular Languages:**
- `es-ES` → Spanish (Spain)
- `fr-FR` → French (France) 
- `de-DE` → German
- `it-IT` → Italian
- `pt-PT` → Portuguese
- `pt-BR` → Portuguese (Brazil)
- `zh-CN` → Chinese (Mandarin)
- `ja-JP` → Japanese
- `ko-KR` → Korean
- `ru-RU` → Russian
- `ar-SA` → Arabic
- `hi-IN` → Hindi

See [Google Cloud TTS Languages](https://cloud.google.com/text-to-speech/docs/voices) for complete list.

### Voice Options

Use Google Cloud TTS voice names in `TARGET_VOICE`:
- `es-ES-Standard-A` (Spanish female)
- `fr-FR-Standard-A` (French female)
- `de-DE-Standard-A` (German female)
- Or leave empty for default voice

See [Google Cloud TTS Voices](https://cloud.google.com/text-to-speech/docs/voices) for all available voices.

## 🐛 Troubleshooting

### Agent not joining rooms

1. Check room metadata is properly set:
   ```bash
   lk room list
   lk room info <room-name>
   ```

2. Verify agent deployment:
   ```bash
   lk agent status
   lk agent logs --tail 100
   ```

### No translation output

1. Ensure admin is publishing audio
2. Check agent logs for errors
3. Verify language configuration in room metadata

### Common Issues

- **"Event not found for this room"** - This happens if:
  - Room name doesn't match an event in the database
  - API endpoint is not accessible
  - APP_URL environment variable is incorrect
- **"Failed to fetch event config"** - Check:
  - APP_URL is set correctly in agent environment
  - API endpoint `/api/events/by-room/{roomName}` is deployed
  - Network connectivity between agent and app
- **"No translation outputs configured"** - Event has no languages configured. Add languages to event.
- **Agent joining immediately after event creation** - Room is being created too early. Ensure room is ONLY created when event is started, not when created.
- **OpenAI errors** - Check API key and quota limits.

## 📊 Monitoring

View agent performance in LiveKit Cloud dashboard:
- Real-time session monitoring
- Audio quality metrics
- Error tracking
- Usage statistics

## 🔄 Updates

To update the agent:

```bash
# Make changes to agent.py
# Test locally
python test_local.py

# Deploy update
lk agent deploy

# Verify deployment
lk agent status
```

## 🚀 Quick Start (MVP)

To get started, deploy just a **Spanish translator** for testing:

```bash
# Prerequisites:
# 1. Place 'Google cloud credentials json' file in livekit-agent folder ✅
# 2. Set your OpenAI API key in environment
export OPENAI_API_KEY=sk-your-key

# Deploy Spanish translator
TARGET_LANGUAGE=es-ES TARGET_VOICE=es-ES-Standard-A lk agent deploy --name spanish-translator

# Test: Admin speaks English → Agent outputs Spanish
```

**Google credentials are automatically loaded from the local file - no environment variables needed!**

Once working, add more languages by deploying additional agents with different `TARGET_LANGUAGE` values.

## 🚨 Important Notes

1. **One language per agent instance** - Maximum simplicity and reliability
2. **Standard LiveKit patterns** - Uses agent audio tracks, not custom naming
3. **Google Cloud required** - Needs valid Google authentication
4. **Environment driven** - All configuration via environment variables

## 📝 Future Enhancements

- [ ] Multiple language support (spawn multiple agents)
- [ ] Custom voice per language
- [ ] Translation confidence scores
- [ ] Session recording and transcripts
- [ ] Real-time quality monitoring