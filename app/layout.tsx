import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'

// Next.js downloads these at build time and serves them from this app, so
// the pages still render on a kitchen tablet with no network.
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans-face',
  display: 'swap',
})

const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif-face',
  display: 'swap',
  axes: ['opsz'],
})

export const metadata: Metadata = { title: 'Larder' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="bg-stone-50 font-sans text-stone-900 antialiased">{children}</body>
    </html>
  )
}
