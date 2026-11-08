import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Providers } from '@/components/common/providers';

export const metadata: Metadata = {
  title: {
    default: 'Recap Studio — AI Video Recap Engine',
    template: '%s · Recap Studio',
  },
  description:
    'Turn long-form video into cinematic 3-minute recaps. BYOK AI pipeline, client-side FFmpeg rendering, and a studio-grade dark console.',
  applicationName: 'Recap Studio',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Recap Studio',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/assets/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/assets/icons/icon-192.png', sizes: '192x192' }],
  },
  openGraph: {
    title: 'Recap Studio — AI Video Recap Engine',
    description: 'BYOK AI pipeline, SRT timeline, multi-provider TTS and client-side FFmpeg rendering.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-void font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
