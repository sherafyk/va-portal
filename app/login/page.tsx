'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [checking, setChecking] = useState(true)

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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      alert(error.message)
      return
    }

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

  if (checking) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow w-96">
        <h1 className="text-xl font-bold mb-4">Login</h1>

        <input
          className="w-full border p-2 mb-3"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          className="w-full border p-2 mb-3"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button className="w-full bg-black text-white p-2" onClick={handleLogin}>
          Login
        </button>
      </div>
    </div>
  )
}