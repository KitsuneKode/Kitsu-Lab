import './globals.css'
import { Orbitron, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { Provider } from '@/components/provider'
import { CustomCursor } from '@/components/custom-cursor'
import { Analytics } from '@vercel/analytics/next'

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: '700',
  variable: '--font-orbitron',
  display: 'swap',
})

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const DESCRIPTION =
  'A registry of animated, accessible components and a book reader engine for shadcn/ui — by kitsunekode.'

export const metadata: Metadata = {
  metadataBase: new URL('https://lab.kitsunelabs.xyz'),
  title: 'Kitsu Lab',
  description: DESCRIPTION,

  twitter: {
    card: 'summary_large_image',
    title: 'Kitsu Lab',
    description: DESCRIPTION,
    site: '@kitsunekode',
  },
}

export const viewport: Viewport = {
  // `cover` lets content reach under device chrome — the reader's
  // env(safe-area-inset-*) padding only resolves once this is set.
  viewportFit: 'cover',
  // The on-screen keyboard shrinks the layout viewport instead of covering
  // the reader, so the search field stays visible while typing.
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#27272a' },
  ],
  colorScheme: 'dark light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${orbitron.variable} ${grotesk.variable} ${jetbrainsMono.variable} min-h-screen font-sans antialiased`}
      >
        <Provider>{children}</Provider>
        <CustomCursor />
        <Analytics />
      </body>
    </html>
  )
}
