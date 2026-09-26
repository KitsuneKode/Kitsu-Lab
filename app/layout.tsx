import './globals.css'
import { Orbitron, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import { Provider } from '@/components/provider'
import { Analytics } from '@vercel/analytics/next'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

const orbitron = Orbitron({
  subsets: ['latin'],
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — shadcn components you install and own`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'shadcn',
    'shadcn registry',
    'react components',
    'next.js components',
    'announcement bar',
    'promotion popup',
    'discount banner',
    'pdf reader',
    'book reader',
    'tailwind',
  ],
  authors: [{ name: 'kitsunekode', url: 'https://x.com/kitsunekode' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    site: '@kitsunekode',
    creator: '@kitsunekode',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
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
        <Analytics />
      </body>
    </html>
  )
}
