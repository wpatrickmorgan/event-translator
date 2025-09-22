# LiveKit Translation Agent for Events

A real-time translation agent that joins event rooms and provides live translations using OpenAI's Realtime API.

## 🎯 How It Works

1. **Admin creates event** with language settings (room NOT created yet)
2. **Admin starts event** → Creates LiveKit room
3. **Agent automatically joins** and fetches config from app API
4. **Agent translates** admin speech to configured target languages
5. **Attendees receive** translated audio and captions in their selected language
6. **Admin ends event** → Room closed, agent automatically leaves

## 🏗️ Architecture

```
Admin → Event Room → Translation Agent → Translated Audio/Text → Attendees
                    ↓                    
                  API Call              
                    ↓                    
              Event Config             
           (from database)
```

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

### Environment Variables

Create a `.env` file:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_secret
LIVEKIT_URL=wss://your-project.livekit.cloud

# Required - Your app URL for fetching event config
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

```bash
# Authenticate with LiveKit Cloud
lk cloud auth

# Deploy the agent
lk agent deploy

# Check deployment status
lk agent status

# View logs
lk agent logs
```

## 📡 Published Tracks

The agent publishes translation tracks with specific naming conventions:

- **Audio**: `translation-audio-{lang}` (e.g., `translation-audio-es-ES`)
- **Text**: `translation-text-{lang}` data messages

## 🔧 Configuration

### Supported Languages

The agent maps language codes to OpenAI language names:

- `es-ES` → Spanish
- `fr-FR` → French
- `de-DE` → German
- `it-IT` → Italian
- `pt-PT` → Portuguese
- `pt-BR` → Brazilian Portuguese
- `zh-CN` → Mandarin Chinese
- `ja-JP` → Japanese
- `ko-KR` → Korean
- `ru-RU` → Russian
- `ar-SA` → Arabic
- `hi-IN` → Hindi

### Voice Options

Available OpenAI voices:
- `alloy` (default)
- `echo`
- `fable`
- `onyx`
- `nova`
- `shimmer`

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

## 🚨 Important Notes

1. **One language per agent instance** - Currently handles primary target language only
2. **Room metadata required** - Agent will exit if no valid metadata found
3. **Auto-dispatch** - Agent automatically joins when event room is created
4. **Persistent connection** - Agent stays connected until event ends

## 📝 Future Enhancements

- [ ] Multiple language support (spawn multiple agents)
- [ ] Custom voice per language
- [ ] Translation confidence scores
- [ ] Session recording and transcripts
- [ ] Real-time quality monitoring