import './globals.css'
import type { Metadata } from 'next'
import { Orbitron } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
})

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${orbitron.className} overflow-hidden antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
