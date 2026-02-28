'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Ticket = {
  id: string
  title: string
  status: string | null
  priority: string | null
  due_date: string | null
  client_id: string | null
}

type ClientMap = Record<string, string>

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientNames, setClientNames] = useState<ClientMap>({})
  const [loading, setLoading] = useState(true)

  const loadTickets = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login')
      return
    }

    const { data: tData, error: tErr } = await supabase
      .from('tickets')
      .select('id,title,status,priority,due_date,client_id')
      .order('created_at', { ascending: false })

    if (tErr) {
      alert(`Failed to load tickets: ${tErr.message}`)
      setLoading(false)
      return
    }

    const ticketsList = (tData ?? []) as Ticket[]
    setTickets(ticketsList)

    // Build a map of client_id -> client_name for display
    const clientIds = Array.from(
      new Set(ticketsList.map(t => t.client_id).filter(Boolean))
    ) as string[]

    if (clientIds.length > 0) {
      const { data: cData } = await supabase
        .from('clients')
        .select('id,name')
        .in('id', clientIds)

      const map: ClientMap = {}
      ;(cData ?? []).forEach((c: any) => (map[c.id] = c.name))
      setClientNames(map)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tickets</h1>
        <Link
          href="/tickets/new"
          className="bg-black text-white px-4 py-2 rounded"
        >
          Create Ticket
        </Link>
      </div>

      <div className="bg-white rounded shadow p-6">
        {tickets.length === 0 ? (
          <p>No tickets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Title</th>
                  <th className="py-2">Client</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Priority</th>
                  <th className="py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-b">
                    <td className="py-2 font-medium">
                        <Link className="underline" href={`/tickets/${t.id}`}>
                            {t.title}
                        </Link>
                    </td>
                    <td className="py-2">
                      {t.client_id ? clientNames[t.client_id] ?? '—' : '—'}
                    </td>
                    <td className="py-2">{t.status ?? '—'}</td>
                    <td className="py-2">{t.priority ?? '—'}</td>
                    <td className="py-2">{t.due_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}