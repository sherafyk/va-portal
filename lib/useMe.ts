'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type MeProfile = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
}

type UseMeState = {
  loading: boolean
  profile: MeProfile | null
}

/**
 * Small client-side hook that keeps the current session + profile in sync.
 *
 * Why:
 * - Nav should update immediately after login/logout (RootLayout persists).
 * - Pages can make role-based UI decisions without copy/pasting auth code.
 */
export function useMe() {
  const [state, setState] = useState<UseMeState>({ loading: true, profile: null })
  const inFlight = useRef(false)

  const load = async () => {
    if (inFlight.current) return
    inFlight.current = true

    try {
      const { data } = await supabase.auth.getSession()
      const session = data.session

      if (!session) {
        setState({ loading: false, profile: null })
        return
      }

      const user = session.user
      const { data: pData, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single()

      if (pErr) {
        // If profile row doesn't exist yet, still return the session basics.
        setState({
          loading: false,
          profile: {
            id: user.id,
            email: user.email ?? null,
            full_name: null,
            role: null
          }
        })
        return
      }

      setState({
        loading: false,
        profile: {
          id: pData.id,
          email: user.email ?? null,
          full_name: pData.full_name ?? null,
          role: pData.role ?? null
        }
      })
    } finally {
      inFlight.current = false
    }
  }

  useEffect(() => {
    load()

    const { data } = supabase.auth.onAuthStateChange(() => {
      // Re-load profile on login/logout or token refresh.
      load()
    })

    return () => {
      data.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const api = useMemo(() => {
    return {
      loading: state.loading,
      profile: state.profile,
      userId: state.profile?.id ?? null,
      email: state.profile?.email ?? null,
      fullName: state.profile?.full_name ?? null,
      role: state.profile?.role ?? null,
      isAdmin: state.profile?.role === 'admin'
    }
  }, [state.loading, state.profile])

  return api
}
