# Testing Event Flow with LiveKit Agent

## Correct Event Flow

### 1. Create Event (Room NOT Created)
- Go to your app's events page
- Click "New Event"
- Add event details and languages
- Save the event

**Expected:** 
- Event saved in database
- NO room created yet
- NO agent dispatch yet

### 2. Start Event (Room Created with Metadata)
- Go to the event details page
- Click "Start Event" button

**Expected:**
- Room created with metadata
- Agent immediately joins
- Agent logs show:
  ```
  🎪 Translation agent joining event room: [room-name]
  📋 Event configuration loaded from metadata
  🎯 Event: [event-id] (Org: [org-id])
  🗣️ Translation: en-US → [languages]
  ✅ Translation agent active for [language]
  ```

### 3. Admin Joins Event
- Admin clicks "Join as Admin"
- Admin publishes audio

**Expected:**
- Agent receives audio
- Agent translates speech
- Translation tracks published

### 4. Attendee Joins Event
- Attendee enters join code
- Selects language
- Joins event

**Expected:**
- Attendee receives translated audio on `translation-audio-{lang}` track
- Attendee receives captions on `translation-text-{lang}` messages

### 5. End Event (Room Closed)
- Admin clicks "End Event"

**Expected:**
- Room closed
- Agent automatically leaves
- All participants disconnected

## Testing Commands

### Monitor Agent Logs
```bash
# Watch agent logs in real-time
lk agent logs --tail 100 --follow

# Check for errors
lk agent logs | grep ERROR
```

### Check Room Status
```bash
# List all rooms
lk room list

# Check specific room
lk room info [room-name]
```

### Debug Metadata
```bash
# Get room metadata
lk room info [room-name] | grep metadata
```

## Common Issues After Fix

### ✅ FIXED: Agent joining on event creation
Previously the room was created when the event was created. Now it's only created when started.

### ✅ FIXED: No room metadata found
Room now always has metadata when created since it's only created during the start process.

## Verification Checklist

- [ ] Create event - verify NO agent dispatch
- [ ] Start event - verify agent joins with metadata
- [ ] Admin audio - verify agent receives and translates
- [ ] Attendee join - verify translation received
- [ ] End event - verify agent leaves cleanly
