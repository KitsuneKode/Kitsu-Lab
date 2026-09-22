import './globals.css'
import { Orbitron } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { Provider } from '@/components/provider'
import { Analytics } from '@vercel/analytics/next'

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://kitsulab.vercel.app'),
  title: 'Kitsu Lab',
  description:
    'The destination for all your component. This website shows all the trial components by kitsunekode',

  twitter: {
    card: 'summary_large_image',
    title: 'Kitsu Lab',
    description:
      'The destination for all your component. This website shows all the trial components by kitsunekode',
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
      <body className={`${orbitron.className} min-h-screen antialiased`}>
        <Provider>{children}</Provider>
        <Analytics />
      </body>
    </html>
  )
}
