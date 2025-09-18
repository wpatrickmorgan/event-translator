'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-4">Settings Coming Soon</h2>
              <p className="text-gray-600">
                User preferences and organization settings will be available here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
