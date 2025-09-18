import { z } from 'zod'

export const createEventSchema = z.object({
  name: z.string()
    .min(2, 'Event name must be at least 2 characters')
    .max(100, 'Event name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s&.,-]+$/, 'Event name contains invalid characters'),
  start_time_local: z.string()
    .min(1, 'Start time is required'),
  is_public: z.boolean(),
  record_transcript: z.boolean(),
  languages: z.array(z.object({
    language_id: z.string()
      .min(1, 'Language ID is required'),
    text: z.boolean(),
    audio: z.boolean(),
    voice_id: z.string()
      .nullable()
      .optional(),
  }))
    .min(1, 'At least one language must be selected')
    .refine(
      (languages) => languages.every(lang => lang.text || lang.audio),
      {
        message: 'Each language must have at least Text or Audio enabled',
        path: ['languages'],
      }
    ),
}).refine(
  (data) => {
    const startTime = new Date(data.start_time_local)
    const now = new Date()
    return startTime > now
  },
  {
    message: 'Start time must be in the future',
    path: ['start_time_local'],
  }
)

export type CreateEventFormData = z.infer<typeof createEventSchema>

// Helper type for resolved language with full language data
export type ResolvedLanguage = {
  language_id: string
  text: boolean
  audio: boolean
  voice_id?: string | null
  language: {
    id: string
    name_en: string
    name_native: string
    code: string
  }
}
