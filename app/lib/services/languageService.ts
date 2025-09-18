import { supabase } from '@/lib/supabase'
import type { Language } from '@/lib/types/event'

export class LanguageService {
  /**
   * List all available languages ordered by priority DESC, name_en ASC
   */
  static async listLanguages(): Promise<{ data: Language[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('languages')
        .select('*')
        .order('priority', { ascending: false })
        .order('name_en', { ascending: true })

      if (error) {
        console.error('Error fetching languages:', error)
        return { data: [], error: error.message }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error in listLanguages:', error)
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Failed to fetch languages' 
      }
    }
  }
}
