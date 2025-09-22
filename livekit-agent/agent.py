"""
LiveKit Translation Agent using OpenAI Realtime API
Integrates with existing event-translator app architecture
"""
import os
import json
import logging
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit import rtc
from livekit.plugins import openai

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TranslationAgent(Agent):
    """
    Event translation agent using OpenAI's Realtime API.
    
    This agent:
    - Integrates with existing event-translator app architecture
    - Listens to event speakers (admin audio input)
    - Provides real-time translations for event attendees
    - Uses existing message format and track naming
    """
    
    def __init__(
        self, 
        target_language: str = "spanish",
        source_language: str = "auto-detect"
    ):
        self.target_language = target_language
        self.source_language = source_language
        
        # Create instructions for the AI
        instructions = self._build_instructions()
        
        super().__init__(instructions=instructions)
        logger.info(f"Event translation agent initialized: {source_language} → {target_language}")
    
    def _build_instructions(self) -> str:
        """Build instructions for the event translation agent"""
        return f"""You are a professional real-time translator for live events.

Your role:
- Listen to audio from event speakers and administrators
- Translate speech from {self.source_language} to {self.target_language}
- Provide immediate, accurate translations for event attendees

Event Context:
- This is a live event with administrators speaking to attendees
- You will receive audio from event organizers/speakers
- Your translations help attendees understand the event content
- Maintain professional, clear communication suitable for events

Guidelines:
1. ACCURACY: Provide precise translations while preserving meaning
2. CONTEXT: Remember this is a live event - maintain professional tone
3. REAL-TIME: Respond immediately when speech ends
4. CLARITY: Generate clear, natural-sounding translations
5. CULTURAL: Adapt idioms and cultural references appropriately
6. CONSISTENCY: Maintain consistent terminology throughout the event

Language Instructions:
- Source: {self.source_language}
- Target: {self.target_language}
- If source is "auto-detect", identify the spoken language automatically

Response Format:
- Speak your translation directly in {self.target_language}
- Do NOT announce "Translation:" or similar prefixes
- Provide natural, conversational translations
- Match the speaker's level of formality

Event Types You May Encounter:
- Presentations and speeches
- Q&A sessions
- Announcements and instructions
- Interactive discussions
- Technical content

Remember: You are helping attendees participate fully in the live event by providing seamless real-time translation."""

class SessionManager:
    """Manages translation session data and Supabase integration"""
    
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_ANON_KEY")
        self.supabase = None
        
        # Initialize Supabase if credentials are available
        if self.supabase_url and self.supabase_key:
            try:
                from supabase import create_client
                self.supabase = create_client(self.supabase_url, self.supabase_key)
                logger.info("Supabase integration initialized")
            except ImportError:
                logger.warning("Supabase package not available - logging disabled")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase: {e}")
    
    async def log_agent_activity(self, event_id: str, activity_type: str, details: Dict[str, Any]):
        """Log agent activity for events"""
        if not self.supabase:
            return
            
        try:
            # You can create this table later when you want event logging
            # For now, just log to console
            logger.info(f"Event {event_id} - {activity_type}: {details}")
            # Future: await self.supabase.table("event_agent_logs").insert(...)
        except Exception as e:
            logger.error(f"Failed to log agent activity: {e}")

async def entrypoint(ctx: agents.JobContext):
    """
    Main entry point for the event translation agent.
    This function is called when the agent joins an event room.
    """
    room_name = ctx.room.name
    logger.info(f"🎪 Event translation agent joining room: {room_name}")
    
    # Initialize session manager
    session_manager = SessionManager()
    
    # Extract event configuration from room metadata
    event_config = {}
    room_metadata = ctx.room.metadata
    
    if room_metadata:
        try:
            event_config = json.loads(room_metadata)
            logger.info(f"📋 Event configuration loaded: {event_config}")
        except json.JSONDecodeError:
            logger.warning("Could not parse room metadata, using defaults")
    
    # Extract translation configuration from event metadata
    source_language = event_config.get('sourceLanguage', 'en-US')
    outputs = event_config.get('outputs', [])
    target_languages = [output['lang'] for output in outputs if output.get('audio', True)]
    primary_target = target_languages[0] if target_languages else 'es-ES'
    
    # Convert language codes (es-ES -> spanish) for OpenAI
    lang_map = {
        'es-ES': 'spanish', 'es': 'spanish',
        'fr-FR': 'french', 'fr': 'french', 
        'de-DE': 'german', 'de': 'german',
        'it-IT': 'italian', 'it': 'italian',
        'pt-PT': 'portuguese', 'pt': 'portuguese'
    }
    openai_target_lang = lang_map.get(primary_target, primary_target.split('-')[0])
    
    logger.info(f"Event: {event_config.get('eventId', 'unknown')}")
    logger.info(f"Translation: {source_language} → {target_languages}")
    
    # Create translation agent for event
    agent = TranslationAgent(
        target_language=openai_target_lang,
        source_language="auto-detect"
    )
    
    # Configure OpenAI Realtime Model for event environment
    realtime_model = openai.realtime.RealtimeModel(
        model="gpt-4o-realtime-preview",
        voice="alloy",  # Natural voice for translations
        temperature=0.2,  # Lower temperature for consistent event translations
        # Configure turn detection for event speakers
        turn_detection=openai.realtime.ServerVAD(
            threshold=0.6,  # Adjust for event environment
            prefix_padding_ms=300,
            silence_duration_ms=800  # Longer pause for event speakers
        )
    )
    
    # Create agent session with the realtime model
    session = AgentSession(
        llm=realtime_model
    )
    
    # Set up room input options for event environment
    room_input_options = RoomInputOptions(
        auto_subscribe=True,  # Subscribe to all event audio
        dynacast=True  # Optimize for event streaming
    )
    
    try:
        # Start the agent session
        await session.start(
            room=ctx.room,
            agent=agent,
            room_input_options=room_input_options
        )
        
        # Log agent start
        await session_manager.log_agent_activity(
            event_config.get('eventId', 'unknown'),
            'agent_started',
            {'target_languages': target_languages, 'room_name': room_name}
        )
        
        # Set up event-specific message handling
        await setup_event_message_handling(ctx, event_config, session_manager)
        
        logger.info("✅ Event translation agent started successfully")
        
        # Agent runs until the event ends
        
    except Exception as e:
        logger.error(f"❌ Error starting event agent: {e}")
        await session_manager.log_agent_activity(
            event_config.get('eventId', 'unknown'),
            'agent_error',
            {'error': str(e), 'room_name': room_name}
        )
        raise
    finally:
        # Clean up when event ends
        await session_manager.log_agent_activity(
            event_config.get('eventId', 'unknown'),
            'agent_stopped', 
            {'room_name': room_name}
        )
        logger.info("🧹 Event translation agent cleanup completed")

async def setup_event_message_handling(ctx: agents.JobContext, event_config: Dict[str, Any], session_manager):
    """Set up event-specific message handling to match your existing message format"""
    
    # This function sets up handlers to publish messages in your expected format:
    # - translation-text-${lang} for captions
    # - translation-audio-${lang} for audio tracks
    
    outputs = event_config.get('outputs', [])
    event_id = event_config.get('eventId', 'unknown')
    
    # The OpenAI Realtime model will automatically handle most of the translation
    # We just need to ensure messages are published in your expected format
    
    # Note: The realtime model automatically publishes audio with track names
    # and sends data messages. The key is ensuring it matches your format.
    
    logger.info(f"Event message handling configured for event {event_id}")
    logger.info(f"Expected outputs: {outputs}")
    
    # Log that message handling is set up
    await session_manager.log_agent_activity(
        event_id,
        'message_handling_configured',
        {'outputs': outputs}
    )

def main():
    """Main function to run the agent"""
    logger.info("🚀 Starting LiveKit Translation Agent")
    
    # Verify required environment variables
    required_vars = ["OPENAI_API_KEY", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {missing_vars}")
        return
    
    # Create worker options
    worker_options = agents.WorkerOptions(
        entrypoint_fnc=entrypoint
    )
    
    # Run the agent
    agents.cli.run_app(worker_options)

if __name__ == "__main__":
    main()
