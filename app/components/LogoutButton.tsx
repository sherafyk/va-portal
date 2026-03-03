'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/components/ui/Toast'

export default function LogoutButton() {
  const router = useRouter()
  const toast = useToast()

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
    <button
      onClick={handleLogout}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      Logout
    </button>
  )
}
