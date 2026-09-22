import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import { DEFAULT_THEME, THEME_KEY } from '@/lib/view/theme'
import { ThemeSync } from '@/components/ThemeSync'

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

// The server cannot read browser storage, so it renders the default theme.
// This runs before the first paint and corrects the attribute when the reader
// has chosen the other one. Without it, a reader who chose light sees a dark
// page flash on every load. It is inline for the same reason: a fetched file
// would arrive after the paint it exists to prevent.
const noFlash = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      // The script above changes this attribute before React hydrates, so
      // React must not report the difference from the server's HTML.
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable}`}
    >
      <body className="bg-page font-sans text-ink antialiased">
        {/* First in the body, not in a <head> element. The App Router hoists a
            manual <head>, and a hoisted copy runs too late to beat the paint
            on some routes. */}
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
        <ThemeSync />
        {children}
      </body>
    </html>
  )
}
