'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/ui/Toast'

export default function LoginPage() {
  const router = useRouter()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If already logged in, route correctly
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setChecking(false)
        return
      }

      const { data: pData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single()

      if (pData?.role === 'admin') router.push('/')
      else router.push('/my-work')
    }

    check()
  }, [router])

  const handleLogin = async () => {
    setError(null)

    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }

    setSubmitting(true)
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })
    setSubmitting(false)

    if (signInErr) {
      setError(signInErr.message)
      return
    }

    toast.success('Signed in')

    // Route by role
    const { data } = await supabase.auth.getSession()
    const { data: pData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.session?.user.id)
      .single()

    if (pData?.role === 'admin') router.push('/')
    else router.push('/my-work')
  }

  if (checking) {
    return <div className="text-sm text-slate-600">Checking session…</div>
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use your VA Portal credentials.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block mb-1">Email</label>
          <input
            placeholder="name@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleLogin()
            }}
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block mb-1">Password</label>
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleLogin()
            }}
            autoComplete="current-password"
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showPw}
              onChange={e => setShowPw(e.target.checked)}
              className="h-4 w-4"
            />
            Show password
          </label>
        </div>

        <button
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={handleLogin}
          disabled={submitting}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="text-xs text-slate-500">
          If you can’t sign in, ask an admin to verify your Supabase user and profile role.
        </div>
      </div>
    </div>
  )
}
