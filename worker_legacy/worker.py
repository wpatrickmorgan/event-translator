"""
Modular translation worker implementation.
"""
import asyncio
import logging
from typing import Optional, List

from livekit import rtc

from .models import WorkerConfig, AudioConfig, TranscriptionResult, TranslationResult, TTSRequest
from .providers import get_provider_factory
from .providers.base import STTProvider, TTSProvider, TranslateProvider
from .audio import AudioProcessor
from .room import RoomManager, DataPublisher
from .config import get_provider_config

logger = logging.getLogger(__name__)


class ModularTranslationWorker:
    """
    Modular translation worker using pluggable providers.
    
    This worker can be configured to use different STT, TTS, and translation 
    providers through configuration, making it easy to add new providers.
    """
    
    def __init__(
        self,
        room: rtc.Room,
        worker_config: WorkerConfig,
        audio_config: AudioConfig = AudioConfig()
    ):
        self.room = room
        self.worker_config = worker_config
        self.audio_config = audio_config
        
        # Provider instances
        self.stt_provider: Optional[STTProvider] = None
        self.tts_provider: Optional[TTSProvider] = None
        self.translate_provider: Optional[TranslateProvider] = None
        
        # Core components
        self.room_manager: Optional[RoomManager] = None
        self.data_publisher: Optional[DataPublisher] = None
        self.audio_processor: Optional[AudioProcessor] = None
        
        # State tracking
        self._initialized = False
        self._running = False
    
    async def initialize(self) -> None:
        """Initialize all worker components"""
        if self._initialized:
            logger.warning("Worker already initialized")
            return
        
        logger.info(
            f"Initializing modular translation worker: "
            f"src={self.worker_config.primary_language} "
            f"translations={self.worker_config.translation_targets} "
            f"audio={self.worker_config.audio_targets}"
        )
        
        # Initialize providers
        await self._initialize_providers()
        
        # Initialize core components
        self._initialize_components()
        
        # Set up room event handlers
        self._setup_event_handlers()
        
        # Set up audio tracks for target languages
        await self._setup_audio_tracks()
        
        self._initialized = True
        logger.info("Modular translation worker initialized successfully")
    
    async def _initialize_providers(self) -> None:
        """Initialize STT, TTS, and translation providers"""
        provider_config = get_provider_config(self.worker_config)
        
        # Get provider factories
        stt_factory = get_provider_factory(self.worker_config.stt_provider)
        tts_factory = get_provider_factory(self.worker_config.tts_provider)  
        translate_factory = get_provider_factory(self.worker_config.translate_provider)
        
        # Create provider instances
        self.stt_provider = stt_factory.create_stt_provider()
        self.tts_provider = tts_factory.create_tts_provider()
        self.translate_provider = translate_factory.create_translate_provider()
        
        # Initialize providers
        await self.stt_provider.initialize(provider_config)
        await self.tts_provider.initialize(provider_config)
        await self.translate_provider.initialize(provider_config)
        
        logger.info(
            f"Providers initialized: STT={self.worker_config.stt_provider}, "
            f"TTS={self.worker_config.tts_provider}, "
            f"Translate={self.worker_config.translate_provider}"
        )
    
    def _initialize_components(self) -> None:
        """Initialize core worker components"""
        # Room management
        self.room_manager = RoomManager(self.room, self.audio_config)
        self.data_publisher = DataPublisher(self.room)
        
        # Audio processing
        self.audio_processor = AudioProcessor(self.stt_provider, self.audio_config)
        
        logger.info("Core components initialized")
    
    def _setup_event_handlers(self) -> None:
        """Set up room event handlers"""
        if not self.room_manager:
            raise RuntimeError("Room manager not initialized")
        
        # Set up room event handlers
        self.room_manager.setup_event_handlers()
        
        # Add custom event handlers
        self.room_manager.add_event_handler(
            "audio_track_added", 
            self._handle_audio_track_added
        )
        self.room_manager.add_event_handler(
            "audio_track_removed",
            self._handle_audio_track_removed
        )
    
    async def _setup_audio_tracks(self) -> None:
        """Set up audio tracks for target languages"""
        if not self.room_manager or not self.tts_provider:
            raise RuntimeError("Components not initialized")
        
        for language in self.worker_config.audio_targets:
            try:
                await self.room_manager.setup_audio_track(language, self.tts_provider)
                logger.info(f"Audio track set up for language: {language}")
            except Exception as e:
                logger.error(f"Failed to set up audio track for {language}: {e}")
    
    async def _handle_audio_track_added(self, track: rtc.Track, participant: rtc.RemoteParticipant) -> None:
        """Handle new audio track subscription"""
        if not self.audio_processor:
            logger.error("Audio processor not initialized")
            return
        
        # Start processing the audio track
        asyncio.create_task(
            self.audio_processor.process_audio_track(
                track,
                self.worker_config.primary_language,
                self._handle_transcription
            )
        )
    
    async def _handle_audio_track_removed(self, track: rtc.Track, participant: rtc.RemoteParticipant) -> None:
        """Handle audio track unsubscription"""
        # Audio processor handles cleanup automatically
        logger.info(f"Audio track removed: {track.sid}")
    
    def _handle_transcription(self, result: TranscriptionResult) -> None:
        """Handle transcription results from STT"""
        if not result.is_final:
            return
        
        logger.info(f"Transcribed: {result.text}")
        
        # Publish transcription
        asyncio.create_task(self._publish_transcription(result))
        
        # Process translations
        asyncio.create_task(self._process_translations(result))
    
    async def _publish_transcription(self, result: TranscriptionResult) -> None:
        """Publish transcription result"""
        if not self.data_publisher:
            logger.error("Data publisher not initialized")
            return
        
        try:
            await self.data_publisher.publish_transcription(result)
        except Exception as e:
            logger.error(f"Error publishing transcription: {e}")
    
    async def _process_translations(self, result: TranscriptionResult) -> None:
        """Process translations for all target languages"""
        if not self.translate_provider or not self.room_manager:
            return
        
        # Create translation tasks
        translation_tasks = []
        for target_lang in self.worker_config.translation_targets:
            translation_tasks.append(
                self._handle_translation(result, target_lang)
            )
        
        if translation_tasks:
            await asyncio.gather(*translation_tasks, return_exceptions=True)
    
    async def _handle_translation(self, result: TranscriptionResult, target_language: str) -> None:
        """Handle translation for a single target language"""
        try:
            # Translate text
            translation_result = await self.translate_provider.translate(
                result.text,
                result.language,
                target_language
            )
            
            # Publish translation
            if self.data_publisher:
                await self.data_publisher.publish_translation(translation_result)
            
            # Queue TTS if audio output is enabled for this language
            if (target_language in self.worker_config.audio_targets and 
                self.room_manager):
                tts_request = TTSRequest(
                    text=translation_result.text,
                    language=target_language
                )
                await self.room_manager.queue_tts_request(target_language, tts_request)
        
        except Exception as e:
            logger.error(f"Translation handling error for {target_language}: {e}")
    
    async def start(self) -> None:
        """Start the translation worker"""
        if not self._initialized:
            await self.initialize()
        
        if self._running:
            logger.warning("Worker already running")
            return
        
        self._running = True
        logger.info("Translation worker started and running...")
    
    async def stop(self) -> None:
        """Stop the translation worker"""
        if not self._running:
            return
        
        self._running = False
        await self.cleanup()
        logger.info("Translation worker stopped")
    
    async def cleanup(self) -> None:
        """Cleanup all worker resources"""
        logger.info("Starting translation worker cleanup")
        
        try:
            # Cleanup components
            if self.room_manager:
                await self.room_manager.cleanup()
            
            if self.audio_processor:
                await self.audio_processor.cleanup_all()
            
            logger.info("Translation worker cleanup complete")
            
        except Exception as e:
            logger.error(f"Cleanup error: {e}")
    
    @property
    def is_initialized(self) -> bool:
        """Check if worker is initialized"""
        return self._initialized
    
    @property
    def is_running(self) -> bool:
        """Check if worker is running"""
        return self._running
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages for translation"""
        if self.translate_provider:
            return self.translate_provider.get_supported_languages()
        return []
