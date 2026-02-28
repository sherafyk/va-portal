'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [ticketCount, setTicketCount] = useState(0)
  const [clientCount, setClientCount] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const { count: tickets } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })

      const { count: clients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })

      setTicketCount(tickets || 0)
      setClientCount(clients || 0)
    }

    loadData()
  }, [router])

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold">Total Tickets</h2>
          <p className="text-3xl mt-2">{ticketCount}</p>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold">Total Clients</h2>
          <p className="text-3xl mt-2">{clientCount}</p>
        </div>
      </div>
    </main>
  )
}