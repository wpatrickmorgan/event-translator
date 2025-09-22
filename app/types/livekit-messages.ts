// LiveKit message types for the event translator
// Updated to support both legacy worker messages and new LiveKit Agents

// Legacy worker messages (maintain backward compatibility for events)
export interface CaptionMessage {
  type: 'caption'
  lang: string
  text: string
  isFinal: boolean
}

export interface OriginalLanguageTextMessage {
  type: 'original-language-text'
  lang: string
  text: string
  isFinal: boolean
  seq: number
  ts: number
}

export interface TranslationTextMessage {
  type: `translation-text-${string}`
  srcLang: string
  lang: string
  text: string
  isFinal: boolean
  seq: number
  ts: number
}

export interface TranslationAudioMessage {
  type: `translation-audio-${string}`
  status: 'start' | 'end' | 'error'
  seq: number
  ts: number
}

// New LiveKit Agents messages
export interface AgentTranslationTextMessage {
  type: 'translation_text'
  text: string
  language: string
  sourceLanguage?: string
  timestamp: number
  confidence?: number
}

export interface AgentTranscriptionMessage {
  type: 'transcription'
  text: string
  language: string
  timestamp: number
  confidence?: number
  isFinal?: boolean
}

export interface AgentConfigUpdateMessage {
  type: 'config_update'
  sourceLanguage?: string
  targetLanguages?: string[]
  timestamp: number
}

export interface AgentStateMessage {
  type: 'agent_state'
  state: 'initializing' | 'listening' | 'thinking' | 'speaking'
  timestamp: number
}

// Union of all message types
export type LiveKitMessage = 
  | CaptionMessage 
  | OriginalLanguageTextMessage 
  | TranslationTextMessage 
  | TranslationAudioMessage
  | AgentTranslationTextMessage
  | AgentTranscriptionMessage
  | AgentConfigUpdateMessage
  | AgentStateMessage

// Type guard functions to safely check message types
export function isCaptionMessage(msg: unknown): msg is CaptionMessage {
  return typeof msg === 'object' && msg !== null && 
    'type' in msg && msg.type === 'caption' &&
    'lang' in msg && typeof msg.lang === 'string' &&
    'text' in msg && typeof msg.text === 'string' &&
    'isFinal' in msg && typeof msg.isFinal === 'boolean'
}

export function isOriginalLanguageTextMessage(msg: unknown): msg is OriginalLanguageTextMessage {
  return typeof msg === 'object' && msg !== null &&
    'type' in msg && msg.type === 'original-language-text' &&
    'lang' in msg && typeof msg.lang === 'string' &&
    'text' in msg && typeof msg.text === 'string' &&
    'isFinal' in msg && typeof msg.isFinal === 'boolean' &&
    'seq' in msg && typeof msg.seq === 'number' &&
    'ts' in msg && typeof msg.ts === 'number'
}

export function isTranslationTextMessage(msg: unknown): msg is TranslationTextMessage {
  return typeof msg === 'object' && msg !== null &&
    'type' in msg && typeof msg.type === 'string' && msg.type.startsWith('translation-text-') &&
    'srcLang' in msg && typeof msg.srcLang === 'string' &&
    'lang' in msg && typeof msg.lang === 'string' &&
    'text' in msg && typeof msg.text === 'string' &&
    'isFinal' in msg && typeof msg.isFinal === 'boolean' &&
    'seq' in msg && typeof msg.seq === 'number' &&
    'ts' in msg && typeof msg.ts === 'number'
}

export function isTranslationAudioMessage(msg: unknown): msg is TranslationAudioMessage {
  return typeof msg === 'object' && msg !== null &&
    'type' in msg && typeof msg.type === 'string' && msg.type.startsWith('translation-audio-') &&
    'status' in msg && typeof msg.status === 'string' && 
    ['start', 'end', 'error'].includes(msg.status) &&
    'seq' in msg && typeof msg.seq === 'number' &&
    'ts' in msg && typeof msg.ts === 'number'
}

// New type guards for agent messages
export function isAgentTranslationTextMessage(msg: unknown): msg is AgentTranslationTextMessage {
  return typeof msg === 'object' && msg !== null &&
    'type' in msg && msg.type === 'translation_text' &&
    'text' in msg && typeof msg.text === 'string' &&
    'language' in msg && typeof msg.language === 'string' &&
    'timestamp' in msg && typeof msg.timestamp === 'number'
}

export function isAgentTranscriptionMessage(msg: unknown): msg is AgentTranscriptionMessage {
  return typeof msg === 'object' && msg !== null &&
    'type' in msg && msg.type === 'transcription' &&
    'text' in msg && typeof msg.text === 'string' &&
    'language' in msg && typeof msg.language === 'string' &&
    'timestamp' in msg && typeof msg.timestamp === 'number'
}

export function isAgentConfigUpdateMessage(msg: unknown): msg is AgentConfigUpdateMessage {
  return typeof msg === 'object' && msg !== null &&
    'type' in msg && msg.type === 'config_update' &&
    'timestamp' in msg && typeof msg.timestamp === 'number'
}

export function isAgentStateMessage(msg: unknown): msg is AgentStateMessage {
  return typeof msg === 'object' && msg !== null &&
    'type' in msg && msg.type === 'agent_state' &&
    'state' in msg && typeof msg.state === 'string' &&
    ['initializing', 'listening', 'thinking', 'speaking'].includes(msg.state as string) &&
    'timestamp' in msg && typeof msg.timestamp === 'number'
}

export function isLiveKitMessage(msg: unknown): msg is LiveKitMessage {
  return isCaptionMessage(msg) || 
    isOriginalLanguageTextMessage(msg) || 
    isTranslationTextMessage(msg) || 
    isTranslationAudioMessage(msg) ||
    isAgentTranslationTextMessage(msg) ||
    isAgentTranscriptionMessage(msg) ||
    isAgentConfigUpdateMessage(msg) ||
    isAgentStateMessage(msg)
}
