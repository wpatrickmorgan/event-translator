#!/usr/bin/env python3
"""
LiveKit Translation Worker (Standard SDK)

Polls Supabase for active events and connects directly to LiveKit rooms.
Pure standard SDK implementation for real-time translation.
"""

import asyncio
import os
import logging
import json
from typing import Optional, Dict, Any
from supabase import create_client, Client
from livekit import rtc, api

from worker import ModularTranslationWorker
from config import (
    load_worker_config_from_env,
    load_audio_config_from_env, 
    update_config_from_metadata,
    validate_config
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WorkerManager:
    """Manages worker lifecycle by polling Supabase for active events"""
    
    def __init__(self):
        # LiveKit configuration
        self.livekit_url = os.getenv("LIVEKIT_URL") or os.getenv("LIVEKIT_SERVER_URL")
        self.api_key = os.getenv("LIVEKIT_API_KEY")
        self.api_secret = os.getenv("LIVEKIT_API_SECRET")
        
        # Supabase configuration
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_anon_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") 
        
        if not all([self.livekit_url, self.api_key, self.api_secret]):
            raise ValueError("Missing LiveKit environment variables")
        
        if not all([supabase_url, supabase_anon_key]):
            raise ValueError("Missing Supabase environment variables")
        
        # Initialize Supabase client
        self.supabase: Client = create_client(supabase_url, supabase_anon_key)
        
        # Current processing state
        self.current_worker: Optional[ModularTranslationWorker] = None
        self.current_room: Optional[rtc.Room] = None
        self.processing_event_id: Optional[str] = None
    
    async def start(self) -> None:
        """Start the worker manager main loop"""
        logger.info("Starting LiveKit translation worker...")
        logger.info(f"LiveKit URL: {self.livekit_url}")
        
        while True:
            try:
                # Check for active events
                await self._check_for_work()
                
                # Sleep before next check
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                await asyncio.sleep(10)  # Longer wait on error
    
    async def _check_for_work(self) -> None:
        """Check Supabase for active events that need processing"""
        try:
            # Query for live events
            response = self.supabase.table('events').select(
                'id, room_name, org_id, status, created_at'
            ).eq('status', 'live').execute()
            
            active_events = response.data if response.data else []
            
            if not active_events:
                # No active events - cleanup if we're processing something
                if self.current_worker:
                    logger.info("No active events found - stopping current worker")
                    await self._stop_current_worker()
                return
            
            # Check if we're already processing the right event
            if len(active_events) == 1:
                event = active_events[0]
                if self.processing_event_id == event['id']:
                    # Already processing this event
                    return
                
                # Stop current worker if processing different event
                if self.current_worker:
                    logger.info(f"Switching from event {self.processing_event_id} to {event['id']}")
                    await self._stop_current_worker()
                
                # Start processing new event
                await self._start_processing_event(event)
            
            elif len(active_events) > 1:
                logger.warning(f"Multiple active events found ({len(active_events)}), processing first one")
                event = active_events[0]
                if self.processing_event_id != event['id']:
                    if self.current_worker:
                        await self._stop_current_worker()
                    await self._start_processing_event(event)
        
        except Exception as e:
            logger.error(f"Error checking for work: {e}")
    
    async def _start_processing_event(self, event: Dict[str, Any]) -> None:
        """Start processing a specific event"""
        event_id = event['id']
        room_name = event['room_name']
        
        logger.info(f"Starting to process event {event_id} in room {room_name}")
        
        try:
            # Create access token for the room
            token = api.AccessToken(self.api_key, self.api_secret) \
                .with_identity(f"translation-bot-{event_id}") \
                .with_name("Translation Bot") \
                .with_grants(api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True
                ))
            
            # Connect to LiveKit room
            room = rtc.Room()
            await room.connect(self.livekit_url, token.to_jwt())
            logger.info(f"Connected to LiveKit room: {room_name}")
            
            # Load worker configuration
            worker_config = load_worker_config_from_env()
            audio_config = load_audio_config_from_env()
            
            # Update configuration with room metadata
            if room.metadata:
                worker_config = update_config_from_metadata(worker_config, room.metadata)
                logger.info(f"Updated config from room metadata")
            else:
                logger.warning("No room metadata found")
            
            # Validate configuration
            if not validate_config(worker_config):
                raise ValueError("Invalid worker configuration")
            
            # Create and initialize worker
            worker = ModularTranslationWorker(room, worker_config, audio_config)
            await worker.initialize()
            await worker.start()
            
            # Store current state
            self.current_worker = worker
            self.current_room = room
            self.processing_event_id = event_id
            
            # Set up room disconnect handler
            @room.on("disconnected")
            def on_disconnected():
                logger.info(f"Room {room_name} disconnected")
                asyncio.create_task(self._stop_current_worker())
            
            logger.info(f"Successfully started processing event {event_id}")
            
        except Exception as e:
            logger.error(f"Error starting event processing: {e}")
            # Cleanup on error
            if self.current_room:
                try:
                    await self.current_room.disconnect()
                except:
                    pass
            self.current_worker = None
            self.current_room = None
            self.processing_event_id = None
    
    async def _stop_current_worker(self) -> None:
        """Stop the current worker and cleanup"""
        if not self.current_worker:
            return
        
        logger.info(f"Stopping worker for event {self.processing_event_id}")
        
        try:
            # Cleanup worker
            await self.current_worker.cleanup()
            
            # Disconnect from room
            if self.current_room:
                await self.current_room.disconnect()
        
        except Exception as e:
            logger.error(f"Error during worker cleanup: {e}")
        
        finally:
            # Reset state
            self.current_worker = None
            self.current_room = None
            self.processing_event_id = None
            logger.info("Worker stopped and cleaned up")


async def main():
    """Main entry point"""
    try:
        manager = WorkerManager()
        await manager.start()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
