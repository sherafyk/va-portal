'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/lib/useMe'
import { useToast } from '@/app/components/ui/Toast'

type NavItem = {
  href: string
  label: string
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { href: '/my-work', label: 'My Work' },
  { href: '/tickets', label: 'Tickets' },
  { href: '/board', label: 'Board' },
  { href: '/help', label: 'Help' },
  { href: '/clients', label: 'Clients', adminOnly: true },
  { href: '/templates', label: 'Templates', adminOnly: true }
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const me = useMe()

  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const canSee = useMemo(() => {
    return (item: NavItem) => {
      if (item.adminOnly && !me.isAdmin) return false
      return true
    }
  }, [me.isAdmin])

  const linkClass = (href: string) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition ' +
      (active
        ? 'bg-blue-100 text-blue-800'
        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900')
    )
  }

  const homeHref = me.isAdmin ? '/' : '/my-work'

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message, 'Logout failed')
      return
    }
    toast.success('Signed out')
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Link href={homeHref} className="text-base font-semibold text-slate-900">
            VA Portal
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {NAV.filter(canSee).map(item => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {me.loading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : me.userId ? (
            <>
              <div className="hidden sm:block text-right mr-2">
                <div className="text-sm font-medium text-slate-900 truncate max-w-[220px]">
                  {me.fullName || me.email || 'Signed in'}
                </div>
                <div className="text-xs text-slate-500">
                  {me.isAdmin ? 'Admin' : 'VA'}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              Login
            </Link>
          )}

          <button
            className="md:hidden rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-1">
            {NAV.filter(canSee).map(item => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
