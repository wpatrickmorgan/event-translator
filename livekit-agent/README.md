# LiveKit Translation Agent

A real-time translation agent built with LiveKit Agents framework and OpenAI's Realtime API.

## 🚀 What This Replaces

This simple agent replaces the entire complex `worker/` directory (1000+ lines of code) with a streamlined ~200 line implementation that provides better performance and maintainability.

### Before (Complex Worker):
- Multiple provider abstractions
- Manual audio processing
- Complex room management  
- Custom event handling
- 10+ Python packages
- 284-line main worker file + supporting modules

### After (LiveKit Agent):
- Single OpenAI Realtime API call
- Automatic audio processing
- Built-in room management
- Automatic event handling
- 3 Python packages
- 200-line agent file

## 🏗️ Architecture

```
User Browser ←→ Next.js (Vercel) ←→ LiveKit Cloud ←→ Translation Agent
                     ↓
                 Supabase (optional logging)
```

## 🛠️ Setup

### 1. Environment Variables

Create a `.env` file with:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key
LIVEKIT_API_KEY=your_livekit_api_key  
LIVEKIT_API_SECRET=your_livekit_secret
LIVEKIT_URL=wss://your-project.livekit.cloud

# Optional (for session logging)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### 2. Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Test locally
python agent.py dev

# Test in console mode (Python only)
python agent.py console
```

### 3. Deploy to LiveKit Cloud

```bash
# Authenticate with LiveKit Cloud
lk cloud auth

# Create and deploy agent
lk agent create

# Deploy updates
lk agent deploy

# Monitor status
lk agent status
lk agent logs
```

## 🔧 Configuration

The agent automatically detects configuration from room participant metadata:

```json
{
  "sourceLanguage": "en",
  "targetLanguage": "spanish",
  "organizationId": "org_123"
}
```

## 🌟 Features

- **Auto Language Detection**: Automatically detects source language
- **Real-time Translation**: Instant speech-to-speech translation
- **Emotion Preservation**: Maintains speaker tone and context
- **Multi-participant Support**: Handles multiple speakers
- **Session Logging**: Optional Supabase integration
- **Production Ready**: Built-in scaling and reliability

## 📊 Monitoring

- **LiveKit Cloud Dashboard**: Monitor sessions and performance
- **Agent Logs**: `lk agent logs` for debugging
- **Supabase Analytics**: Session data and translation events

## 🔄 Migration Benefits

1. **95% Less Code**: Simplified from 1000+ lines to ~200 lines
2. **Better Performance**: Direct speech-to-speech processing
3. **Auto Scaling**: LiveKit Cloud handles infrastructure
4. **Easier Debugging**: Centralized logging and monitoring
5. **Global Deployment**: Built-in edge distribution
6. **Zero Maintenance**: No more container management

## 🚨 Rollback Plan

If needed, the old worker system is preserved in `worker_legacy/` and can be reactivated quickly while issues are resolved.
