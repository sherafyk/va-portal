'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function NavBar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const loadRole = async () => {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile) setRole(profile.role)
    }

    loadRole()
  }, [])

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition ${
      pathname.startsWith(path)
        ? 'bg-blue-100 text-blue-700'
        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-slate-900">
            VA Portal
          </span>

          <Link href="/my-work" className={linkClass('/my-work')}>
            My Work
          </Link>

          <Link href="/tickets" className={linkClass('/tickets')}>
            Tickets
          </Link>

          <Link href="/board" className={linkClass('/board')}>
            Board
          </Link>

          <Link href="/help" className={linkClass('/help')}>
            Help
          </Link>

          {role === 'admin' && (
            <>
              <Link href="/clients" className={linkClass('/clients')}>
                Clients
              </Link>

              <Link href="/templates" className={linkClass('/templates')}>
                Templates
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}