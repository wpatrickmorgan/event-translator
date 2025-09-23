"""
LiveKit Translation Agent for Event Translator
Handles real-time translation for events with multiple language outputs
"""
import os
import json
import logging
from typing import Dict, Any, List
from dotenv import load_dotenv
import aiohttp

from livekit import agents, rtc
from livekit.agents import AgentSession, Agent, RoomInputOptions, RoomOutputOptions
from livekit.plugins import openai

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EventTranslator(Agent):
    """Translation agent for live events"""
    
    def __init__(self, target_language: str, source_language: str = "auto"):
        # Build translation instructions
        instructions = f"""You are a professional real-time translator for live events.

Your task: Translate everything you hear from {source_language} into {target_language}.

Guidelines:
1. Provide accurate, natural translations in {target_language}
2. Maintain the speaker's tone, emotion, and intent
3. Be concise but complete - don't add or remove meaning
4. Adapt cultural references appropriately for the target audience
5. Use appropriate formality based on the speaker's tone

CRITICAL INSTRUCTIONS:
- Output ONLY the translation in {target_language}
- Do NOT announce "translation" or any preamble
- Do NOT repeat in the source language
- Translate EVERYTHING you hear, including:
  - Main content and speeches
  - Questions from audience
  - Instructions and announcements
  - Side comments if audible

Speak naturally and fluently in {target_language} as if you were the original speaker."""

        super().__init__(instructions=instructions)
        self.target_language = target_language
        self.source_language = source_language


async def entrypoint(ctx: agents.JobContext):
    """
    Entry point for the translation agent.
    Called when agent joins an event room.
    """
    room_name = ctx.room.name
    logger.info(f"🎪 Translation agent joining event room: {room_name}")
    
    # Get the app URL from environment
    app_url = os.getenv("APP_URL", "https://event-translator.vercel.app")
    
    # Fetch event configuration from API
    logger.info(f"📡 Fetching event configuration from API...")
    event_config = {}
    
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{app_url}/api/events/by-room/{room_name}"
            logger.info(f"   API URL: {url}")
            
            async with session.get(url) as response:
                if response.status == 200:
                    event_config = await response.json()
                    logger.info(f"✅ Event configuration loaded from API")
                    logger.info(f"   Event ID: {event_config.get('eventId', 'not set')}")
                    logger.info(f"   Event Name: {event_config.get('eventName', 'not set')}")
                    logger.info(f"   Org ID: {event_config.get('orgId', 'not set')}")
                    logger.info(f"   Source Language: {event_config.get('sourceLanguage', 'not set')}")
                    logger.info(f"   Outputs count: {len(event_config.get('outputs', []))}")
                elif response.status == 404:
                    logger.error("❌ Event not found for this room")
                    return
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Failed to fetch event config: HTTP {response.status}")
                    logger.error(f"   Response: {error_text}")
                    return
                    
    except Exception as e:
        logger.error(f"❌ Error fetching event configuration: {e}")
        logger.error("Make sure APP_URL environment variable is set correctly")
        return
    
    # Extract configuration
    event_id = event_config.get('eventId', 'unknown')
    org_id = event_config.get('orgId', 'unknown')
    source_language = event_config.get('sourceLanguage', 'en-US')
    outputs = event_config.get('outputs', [])
    
    if not outputs:
        logger.error("❌ No translation outputs configured for this event")
        return
    
    # Filter outputs that have audio enabled
    audio_outputs = [o for o in outputs if o.get('audio', False)]
    caption_outputs = [o for o in outputs if o.get('captions', False)]
    
    if not audio_outputs and not caption_outputs:
        logger.error("❌ No audio or caption outputs configured")
        return
    
    # Get target languages from outputs
    target_languages = list(set([o['lang'] for o in outputs]))
    
    # For now, handle the first configured language
    # In production, you might spawn multiple agents for multiple languages
    primary_output = outputs[0]
    primary_target = primary_output['lang']
    
    # Convert language codes for OpenAI (es-ES -> Spanish)
    lang_map = {
        'es-ES': 'Spanish', 'es': 'Spanish',
        'fr-FR': 'French', 'fr': 'French', 
        'de-DE': 'German', 'de': 'German',
        'it-IT': 'Italian', 'it': 'Italian',
        'pt-PT': 'Portuguese', 'pt': 'Portuguese',
        'pt-BR': 'Brazilian Portuguese',
        'zh-CN': 'Mandarin Chinese', 'zh': 'Chinese',
        'ja-JP': 'Japanese', 'ja': 'Japanese',
        'ko-KR': 'Korean', 'ko': 'Korean',
        'ru-RU': 'Russian', 'ru': 'Russian',
        'ar-SA': 'Arabic', 'ar': 'Arabic',
        'hi-IN': 'Hindi', 'hi': 'Hindi',
        'nl-NL': 'Dutch', 'nl': 'Dutch',
        'sv-SE': 'Swedish', 'sv': 'Swedish',
        'pl-PL': 'Polish', 'pl': 'Polish'
    }
    
    openai_target_lang = lang_map.get(primary_target, primary_target.split('-')[0].title())
    
    logger.info(f"🎯 Event: {event_id} (Org: {org_id})")
    logger.info(f"🗣️ Translation: {source_language} → {primary_target} ({openai_target_lang})")
    logger.info(f"📡 Audio enabled: {primary_output.get('audio', False)}")
    logger.info(f"📝 Captions enabled: {primary_output.get('captions', False)}")
    
    try:
        # Create the translation agent
        translator = EventTranslator(
            target_language=openai_target_lang,
            source_language="auto"  # Auto-detect source language
        )
        
        # Configure OpenAI Realtime model
        realtime_model = openai.realtime.RealtimeModel(
            model="gpt-4o-realtime-preview",  # Explicit model specification
            voice=primary_output.get('voice', 'alloy'),  # Use configured voice or default
            temperature=0.6,  # Fixed: minimum valid temperature for consistent translations
            turn_detection=None  # Disabled for continuous translation (not conversation)
        )
        
        # Create agent session
        session = AgentSession(
            llm=realtime_model
        )
        
        # Configure how the agent receives room audio
        room_input_options = RoomInputOptions()
        
        # Configure room output options for transcription capture
        room_output_options = RoomOutputOptions(
            transcription_enabled=True,
            sync_transcription=False,
        )
        
        # Start the session
        logger.info("🔄 Starting translation session...")
        await session.start(
            room=ctx.room,
            agent=translator,
            room_input_options=room_input_options,
            room_output_options=room_output_options
        )
        
        logger.info(f"✅ Translation agent active for {openai_target_lang}")
        logger.info(f"📻 Listening for audio input from administrators...")
        logger.info(f"🔊 Publishing translations as: translation-audio-{primary_target}")
        
        # The agent will now:
        # 1. Listen to admin audio input automatically
        # 2. Translate using OpenAI Realtime
        # 3. Publish translated audio to the room
        # 4. Forward transcriptions via LiveKit's built-in text streams
        
        if primary_output.get('captions', False):
            logger.info(f"📝 Publishing captions via 'lk.transcription' text stream")
            logger.info(f"📡 Frontend should listen to 'lk.transcription' topic for captions")
        
        # Keep the agent running
        logger.info("🎙️ Translation agent is running. Waiting for speech...")
        
    except Exception as e:
        logger.error(f"❌ Failed to start translation agent: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


def main():
    """Main function to run the agent"""
    logger.info("🚀 Starting LiveKit Translation Agent for Events")
    
    # Verify required environment variables
    required_vars = ["OPENAI_API_KEY", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"]
    
    # Handle LIVEKIT_URL with fallback
    livekit_url = os.getenv("LIVEKIT_URL") or os.getenv("LIVEKIT_SERVER_URL")
    if livekit_url:
        os.environ["LIVEKIT_URL"] = livekit_url
        logger.info(f"📍 LiveKit URL: {livekit_url}")
    else:
        logger.error("❌ Missing LIVEKIT_URL environment variable")
        logger.error("   Set LIVEKIT_URL to your LiveKit Cloud URL (e.g., wss://your-project.livekit.cloud)")
        return
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {missing_vars}")
        logger.error("   Please check your .env file or environment configuration")
        return
    
    # Log that we're using LiveKit Cloud
    if "livekit.cloud" in livekit_url:
        logger.info("☁️  Using LiveKit Cloud deployment")
    
    # Create and run worker
    worker_options = agents.WorkerOptions(
        entrypoint_fnc=entrypoint,
    )
    
    agents.cli.run_app(worker_options)


if __name__ == "__main__":
    main()