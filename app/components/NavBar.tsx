'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LogoutButton from './LogoutButton'

type Profile = {
  id: string
  full_name: string | null
  role: string
}

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session

      if (!session) {
        setProfile(null)
        setLoading(false)
        if (pathname !== '/login') router.push('/login')
        return
      }

      const { data: pData, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', session.user.id)
        .single()

      if (!pErr && pData) setProfile(pData as Profile)
      setLoading(false)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null)
        if (pathname !== '/login') router.push('/login')
      }
    })

    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (pathname === '/login') return null
  if (loading) return null

  const navLinkClass = (href: string) =>
    `px-3 py-2 rounded ${
      pathname === href ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-200'
    }`

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="w-full border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold">VA Portal</span>

          <nav className="ml-6 flex items-center gap-2">
            {isAdmin ? (
              <Link className={navLinkClass('/')} href="/">
                Dashboard
              </Link>
            ) : (
              <Link className={navLinkClass('/my-work')} href="/my-work">
                My Work
              </Link>
            )}

            <Link className={navLinkClass('/tickets')} href="/tickets">
              Tickets
            </Link>

            {isAdmin && (
              <Link className={navLinkClass('/tickets/new')} href="/tickets/new">
                New Ticket
              </Link>
            )}

            <Link className={navLinkClass('/board')} href="/board">
              Board
            </Link>

            {isAdmin && (
              <Link className={navLinkClass('/clients')} href="/clients">
                Clients
              </Link>
            )}

            {isAdmin && (
              <Link className={navLinkClass('/templates')} href="/templates">
                Templates
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {profile && (
            <div className="text-sm text-gray-600 text-right">
              <div className="font-medium text-gray-800">
                {profile.full_name || 'User'}
              </div>
              <div className="text-xs">{profile.role}</div>
            </div>
          )}
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}