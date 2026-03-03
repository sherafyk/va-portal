'use client'

import { usePathname } from 'next/navigation'
import NavBar from '@/app/components/NavBar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthRoute = pathname.startsWith('/login')

  if (isAuthRoute) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    )
  }

  return (
    <>
      <NavBar />
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </>
  )
}
