// LiveKit message types for the event translator
// Based on the worker's message schema documented in worker/README.md

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

export type LiveKitMessage = 
  | CaptionMessage 
  | OriginalLanguageTextMessage 
  | TranslationTextMessage 
  | TranslationAudioMessage

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

export function isLiveKitMessage(msg: unknown): msg is LiveKitMessage {
  return isCaptionMessage(msg) || 
    isOriginalLanguageTextMessage(msg) || 
    isTranslationTextMessage(msg) || 
    isTranslationAudioMessage(msg)
}
