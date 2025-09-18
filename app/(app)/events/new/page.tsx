'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/lib/stores/authStore'
import { EventService } from '@/lib/services/eventService'
import { LanguageService } from '@/lib/services/languageService'
import { UserService } from '@/lib/services/userService'
import { Loader2, Plus, X, Calendar } from 'lucide-react'
import { createEventSchema, type CreateEventFormData, type ResolvedLanguage } from '@/lib/schemas/event'
import toast from 'react-hot-toast'

export default function CreateEventPage() {
  const router = useRouter()
  const user = useAuthStore(state => state.user)
  const loading = useAuthStore(state => state.loading)
  const userOrganizations = useAuthStore(state => state.userOrganizations)
  
  const [selectedLanguages, setSelectedLanguages] = useState<ResolvedLanguage[]>([])
  const [isLanguageDialogOpen, setIsLanguageDialogOpen] = useState(false)
  const [languageSearch, setLanguageSearch] = useState('')

  const form = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      name: '',
      start_time_local: '',
      is_public: false,
      record_transcript: true,
      languages: [],
    },
    mode: 'onBlur',
  })

  const { handleSubmit, formState: { isSubmitting }, register, formState: { errors }, watch, setValue } = form

  // Get user's organization ID
  const orgId = UserService.getUserOrganization(userOrganizations)

  // Fetch available languages
  const { data: languages = [], isLoading: languagesLoading } = useQuery({
    queryKey: ['languages'],
    queryFn: async () => {
      const { data, error } = await LanguageService.listLanguages()
      if (error) throw new Error(error)
      return data
    },
  })

  // Filter languages based on search
  const filteredLanguages = languages.filter(lang => 
    lang.name_en.toLowerCase().includes(languageSearch.toLowerCase()) ||
    lang.name_native.toLowerCase().includes(languageSearch.toLowerCase())
  )


  // Update form languages when selectedLanguages changes
  useEffect(() => {
    const formLanguages = selectedLanguages.map(lang => ({
      language_id: lang.language_id,
      text: lang.text,
      audio: lang.audio,
      voice_id: lang.voice_id,
    }))
    setValue('languages', formLanguages)
  }, [selectedLanguages, setValue])

  const addLanguage = (language: typeof languages[0]) => {
    // Check if language is already selected
    if (selectedLanguages.some(lang => lang.language_id === language.id)) {
      return
    }

    const newLanguage: ResolvedLanguage = {
      language_id: language.id,
      text: true, // Default to text enabled
      audio: false,
      language: {
        id: language.id,
        name_en: language.name_en,
        name_native: language.name_native,
        code: language.code,
      }
    }

    setSelectedLanguages(prev => [...prev, newLanguage])
    setIsLanguageDialogOpen(false)
    setLanguageSearch('')
  }

  const removeLanguage = (languageId: string) => {
    setSelectedLanguages(prev => prev.filter(lang => lang.language_id !== languageId))
  }

  const updateLanguageMode = (languageId: string, field: 'text' | 'audio', value: boolean) => {
    setSelectedLanguages(prev => prev.map(lang => {
      if (lang.language_id === languageId) {
        // Ensure at least one mode is enabled
        if (field === 'text' && !value && !lang.audio) {
          return { ...lang, audio: true, text: false }
        }
        if (field === 'audio' && !value && !lang.text) {
          return { ...lang, text: true, audio: false }
        }
        return { ...lang, [field]: value }
      }
      return lang
    }))
  }

  const onSubmit = async (data: CreateEventFormData) => {
    if (!user?.id || !orgId) {
      toast.error('User not authenticated or no organization found')
      return
    }

    try {
      const { data: eventData, error } = await EventService.createEvent(orgId, user.id, data)

      if (error) {
        toast.error(error)
      } else if (eventData) {
        toast.success('Event created successfully!')
        router.push(`/events/${eventData.id}`)
      }
    } catch {
      toast.error('An unexpected error occurred')
    }
  }

  if (loading || !orgId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Calendar className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Create New Event</h1>
          <p className="mt-2 text-sm text-gray-600">
            Set up your event with translation and audio capabilities
          </p>
        </div>
        
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Event Details</CardTitle>
            <CardDescription>
              Enter your event information below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Event Name */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Event Name *
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter event name"
                  {...register('name')}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <label htmlFor="start_time_local" className="text-sm font-medium">
                  Start Time *
                </label>
                <Input
                  id="start_time_local"
                  type="datetime-local"
                  {...register('start_time_local')}
                  disabled={isSubmitting}
                />
                {errors.start_time_local && (
                  <p className="text-sm text-red-600">{errors.start_time_local.message}</p>
                )}
              </div>

              {/* Event Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Event Settings</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Public Event</label>
                    <p className="text-sm text-gray-500">Allow others to join with a code</p>
                  </div>
                  <Switch
                    checked={watch('is_public')}
                    onCheckedChange={(checked) => setValue('is_public', checked)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Record Transcript</label>
                    <p className="text-sm text-gray-500">Save event transcript for later review</p>
                  </div>
                  <Switch
                    checked={watch('record_transcript')}
                    onCheckedChange={(checked) => setValue('record_transcript', checked)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <Separator />

              {/* Languages */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Output Languages</h3>
                  <Dialog open={isLanguageDialogOpen} onOpenChange={setIsLanguageDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Language
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Select Language</DialogTitle>
                        <DialogDescription>
                          Choose a language to add to your event
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Search languages..."
                          value={languageSearch}
                          onChange={(e) => setLanguageSearch(e.target.value)}
                        />
                        <ScrollArea className="h-64">
                          <div className="space-y-2">
                            {languagesLoading ? (
                              <div className="text-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                              </div>
                            ) : (
                              filteredLanguages.map((language) => (
                                <Button
                                  key={language.id}
                                  type="button"
                                  variant="ghost"
                                  className="w-full justify-start h-auto p-3"
                                  onClick={() => addLanguage(language)}
                                  disabled={selectedLanguages.some(lang => lang.language_id === language.id)}
                                >
                                  <div className="text-left">
                                    <div className="font-medium">{language.name_en}</div>
                                    <div className="text-sm text-gray-500">{language.name_native}</div>
                                  </div>
                                </Button>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {selectedLanguages.length === 0 ? (
                  <p className="text-sm text-gray-500">No languages selected. Add at least one language.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedLanguages.map((lang) => (
                      <div key={lang.language_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{lang.language.name_en}</div>
                          <div className="text-sm text-gray-500">{lang.language.name_native}</div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <label className="text-sm">Text</label>
                            <Switch
                              checked={lang.text}
                              onCheckedChange={(checked) => updateLanguageMode(lang.language_id, 'text', checked)}
                              disabled={isSubmitting}
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <label className="text-sm">Audio</label>
                            <Switch
                              checked={lang.audio}
                              onCheckedChange={(checked) => updateLanguageMode(lang.language_id, 'audio', checked)}
                              disabled={isSubmitting}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLanguage(lang.language_id)}
                            disabled={isSubmitting}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {errors.languages && (
                  <p className="text-sm text-red-600">{errors.languages.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || selectedLanguages.length === 0}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Event
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
