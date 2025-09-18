import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Event Translator',
    short_name: 'Event Translator',
    description: 'Join events with real-time translation and captions',
    start_url: '/join',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Join Event',
        short_name: 'Join',
        description: 'Join an event with a code',
        url: '/join',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
          },
        ],
      },
    ],
  }
}
