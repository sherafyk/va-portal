'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Ticket = {
  id: string
  title: string
  status: string | null
  priority: string | null
  due_date: string | null
  client_id: string | null
  created_at: string
}

type ClientMap = Record<string, string>

const priorityRank: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3
}

export default function MyWorkPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientNames, setClientNames] = useState<ClientMap>({})

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    if (!session) {
      router.push('/login')
      return
    }

    // tickets RLS already ensures VA sees only assigned_to = auth.uid()
    const { data: tData, error: tErr } = await supabase
      .from('tickets')
      .select('id,title,status,priority,due_date,client_id,created_at')
      .order('created_at', { ascending: false })

    if (tErr) {
      alert(`Failed to load My Work: ${tErr.message}`)
      setLoading(false)
      return
    }

    const list = (tData ?? []) as Ticket[]
    setTickets(list)

    const clientIds = Array.from(
      new Set(list.map(t => t.client_id).filter(Boolean))
    ) as string[]

    if (clientIds.length > 0) {
      const { data: cData } = await supabase
        .from('clients')
        .select('id,name')
        .in('id', clientIds)

      const map: ClientMap = {}
      ;(cData ?? []).forEach((c: any) => (map[c.id] = c.name))
      setClientNames(map)
    } else {
      setClientNames({})
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = useMemo(() => {
    return [...tickets].sort((a, b) => {
      const pa = priorityRank[a.priority ?? 'normal'] ?? 2
      const pb = priorityRank[b.priority ?? 'normal'] ?? 2
      if (pa !== pb) return pa - pb

      const da = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
      const db = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
      if (da !== db) return da - db

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [tickets])

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Work</h1>
        <Link className="underline" href="/board">
          Board View
        </Link>
      </div>

      <div className="bg-white rounded shadow p-6">
        {sorted.length === 0 ? (
          <p className="text-gray-600">No tickets assigned to you yet.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map(t => (
              <div key={t.id} className="border rounded p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link className="font-semibold underline" href={`/tickets/${t.id}`}>
                      {t.title}
                    </Link>
                    <div className="text-sm text-gray-600 mt-1">
                      Client: {t.client_id ? (clientNames[t.client_id] ?? '—') : '—'}
                    </div>
                  </div>
                  <div className="text-sm text-right">
                    <div className="text-gray-700">{t.status ?? 'backlog'}</div>
                    <div className="text-gray-500 text-xs">
                      Priority: {t.priority ?? 'normal'}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Due: {t.due_date ?? '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}