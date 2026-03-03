'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/useMe'

/**
 * Home route: redirect only.
 *
 * We intentionally removed the "Admin Dashboard" that did multiple count queries
 * (HEAD requests) in parallel. During any transient Supabase issue, this created
 * lots of noisy 503s and made the admin panel feel unreliable.
 */
export default function Home() {
  const router = useRouter()
  const me = useMe()

  useEffect(() => {
    if (me.loading) return
    if (!me.userId) {
      router.replace('/login')
      return
    }
    router.replace(me.isAdmin ? '/tickets' : '/my-work')
  }, [me.loading, me.userId, me.isAdmin, router])

  return <div className="text-sm text-slate-600">Loading…</div>
}