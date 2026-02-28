import type { Metadata } from 'next'
import './globals.css'
import NavBar from './components/NavBar'

export const metadata: Metadata = {
  title: 'VA Portal',
  description: 'Internal VA ticketing portal'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  )
}