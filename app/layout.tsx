import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/app/components/AppShell'
import { ToastProvider } from '@/app/components/ui/Toast'

export const metadata: Metadata = {
  title: 'VA Portal',
  description: 'Internal VA ticketing portal'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  )
}
