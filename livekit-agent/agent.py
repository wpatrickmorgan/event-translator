"""
LiveKit Translation Agent for Event Translator
Simple one-language-per-agent approach using Google STT + LLM Translation + Google TTS
"""
import os
import json
import logging
from typing import Dict, Any, List
from dotenv import load_dotenv
import aiohttp

from livekit import agents, rtc
from livekit.agents import AgentSession, Agent, RoomInputOptions, RoomOutputOptions
from livekit.plugins import google, openai

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def setup_google_credentials():
    """Setup Google credentials from local file"""
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Path to the credentials file in the same directory
    credentials_file = os.path.join(script_dir, "Google cloud credentials json")
    
    # Check if file exists
    if os.path.exists(credentials_file):
        # Set the environment variable to point to our credentials file
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_file
        logger.info(f"🔐 Using Google Cloud credentials from: {credentials_file}")
        return credentials_file
    else:
        logger.error(f"❌ Google credentials file not found: {credentials_file}")
        logger.error("   Make sure 'Google cloud credentials json' file exists in livekit-agent folder")
        return None


class SimpleTranslationAgent(Agent):
    """Simple agent that translates en-US → target_language using LLM"""
    
    def __init__(self, target_language: str):
        # Create clear translation instructions for the LLM
        language_map = {
            'es-ES': 'Spanish', 'es': 'Spanish',
            'fr-FR': 'French', 'fr': 'French',
            'de-DE': 'German', 'de': 'German',
            'it-IT': 'Italian', 'it': 'Italian',
            'pt-PT': 'Portuguese', 'pt': 'Portuguese',
            'pt-BR': 'Brazilian Portuguese',
            'zh-CN': 'Chinese', 'zh': 'Chinese',
            'ja-JP': 'Japanese', 'ja': 'Japanese',
            'ko-KR': 'Korean', 'ko': 'Korean',
            'ru-RU': 'Russian', 'ru': 'Russian',
            'ar-SA': 'Arabic', 'ar': 'Arabic',
            'hi-IN': 'Hindi', 'hi': 'Hindi',
            'nl-NL': 'Dutch', 'nl': 'Dutch',
            'sv-SE': 'Swedish', 'sv': 'Swedish',
            'pl-PL': 'Polish', 'pl': 'Polish'
        }
        
        language_name = language_map.get(target_language, target_language)
        
        instructions = f"""You are a professional real-time translator for live events.

Your task: Translate everything you hear from English to {language_name}.

Guidelines:
1. Provide accurate, natural translations in {language_name}
2. Maintain the speaker's tone, emotion, and intent
3. Be concise but complete - don't add or remove meaning
4. Adapt cultural references appropriately for the target audience
5. Use appropriate formality based on the speaker's tone

CRITICAL INSTRUCTIONS:
- Output ONLY the translation in {language_name}
- Do NOT announce "translation" or any preamble
- Do NOT repeat the English text
- Translate EVERYTHING you hear

Speak naturally and fluently in {language_name} as if you were the original speaker."""

        super().__init__(instructions=instructions)
        self.target_language = target_language
        
        logger.info(f"🎯 Initialized LLM translator: English → {language_name} ({target_language})")


async def entrypoint(ctx: agents.JobContext):
    """Entry point - determines target language from environment variables"""
    room_name = ctx.room.name
    
    # Get target language and voice from environment variables
    target_language = os.getenv("TARGET_LANGUAGE")
    target_voice = os.getenv("TARGET_VOICE")
    
    if not target_language:
        logger.error("❌ TARGET_LANGUAGE environment variable is required")
        logger.error("   Example: TARGET_LANGUAGE=es-ES")
        return
    
    logger.info(f"🎪 Translation agent joining event room: {room_name}")
    logger.info(f"🎯 Target language: {target_language}")
    logger.info(f"🔊 Target voice: {target_voice or 'default'}")
    
    # Optional: Fetch event configuration for validation (you can remove this if not needed)
    app_url = os.getenv("APP_URL")
    if app_url:
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{app_url}/api/events/by-room/{room_name}"
                async with session.get(url) as response:
                    if response.status == 200:
                        event_config = await response.json()
                        logger.info(f"✅ Event configuration loaded: {event_config.get('eventName', 'Unknown')}")
                    else:
                        logger.warning(f"⚠️ Could not fetch event config: HTTP {response.status}")
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch event configuration: {e}")
            # Continue anyway - event config is optional for agent operation
    
    try:
        # Create simple translation agent with LLM instructions
        translator = SimpleTranslationAgent(target_language=target_language)
        
        # Create AgentSession with Google STT + OpenAI LLM Translation + Google TTS
        session = AgentSession(
            stt=google.STT(
                model="chirp",  # Google's latest STT model
                languages=["en-US"],  # Source language is always English
                spoken_punctuation=False
            ),
            llm=openai.LLM(
                model="gpt-4o-mini"  # LLM handles translation via instructions
            ),
            tts=google.TTS(
                language=target_language,
                voice_name=target_voice
            )
        )
        
        # Start standard session - uses agent's standard audio track
        logger.info("🔄 Starting LLM translation pipeline...")
        await session.start(
            room=ctx.room,
            agent=translator,
            room_input_options=RoomInputOptions(),
            room_output_options=RoomOutputOptions(
                transcription_enabled=True,
                sync_transcription=False,
            )
        )
        
        logger.info(f"✅ LLM Translation agent active: English → {target_language}")
        logger.info("📻 Listening for English speech...")
        logger.info("🎙️ Publishing translations via standard agent audio track")
        logger.info("🤖 Using LLM for translation (no custom track names needed)")
        
    except Exception as e:
        logger.error(f"❌ Failed to start translation agent: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


def main():
    """Main function to run the agent"""
    logger.info("🚀 Starting Simple LLM Translation Agent")
    
    # Setup Google credentials from local file
    credentials_path = setup_google_credentials()
    
    # Verify required environment variables
    required_vars = [
        "TARGET_LANGUAGE",  # Required for this agent
        "OPENAI_API_KEY",  # For LLM translation
        "LIVEKIT_API_KEY", 
        "LIVEKIT_API_SECRET"
    ]
    # Note: Google credentials loaded automatically from local file
    
    # Handle LIVEKIT_URL with fallback
    livekit_url = os.getenv("LIVEKIT_URL") or os.getenv("LIVEKIT_SERVER_URL")
    if livekit_url:
        os.environ["LIVEKIT_URL"] = livekit_url
        logger.info(f"📍 LiveKit URL: {livekit_url}")
    else:
        logger.error("❌ Missing LIVEKIT_URL environment variable")
        logger.error("   Set LIVEKIT_URL to your LiveKit Cloud URL (e.g., wss://your-project.livekit.cloud)")
        return
    
    # Check required variables
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {missing_vars}")
        logger.error("   TARGET_LANGUAGE: Target language code (e.g., es-ES, fr-FR)")
        logger.error("   OPENAI_API_KEY: OpenAI API key for LLM translation")
        return
    
    # Verify Google credentials were set up successfully
    if not credentials_path:
        logger.error("❌ Google Cloud credentials file not found")
        logger.error("   Place 'Google cloud credentials json' file in the livekit-agent folder")
        return
    
    target_language = os.getenv("TARGET_LANGUAGE")
    logger.info(f"🎯 Agent configured for: en-US → {target_language}")
    
    # Log authentication method (already logged in setup_google_credentials)
    # Google credentials are now set up and ready to use
    
    # Log that we're using LiveKit Cloud
    if "livekit.cloud" in livekit_url:
        logger.info("☁️  Using LiveKit Cloud deployment")
    
    # Create and run worker with explicit agent name
    worker_options = agents.WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name=f"translator-{target_language}"  # Explicit agent naming for dispatch
    )
    
    agents.cli.run_app(worker_options)


if __name__ == "__main__":
    main()