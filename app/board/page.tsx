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

const COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'ready', label: 'Ready' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' }
  // Archived intentionally omitted from board
] as const

export default function BoardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientNames, setClientNames] = useState<ClientMap>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadBoard = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/login')
      return
    }

    const { data: tData, error: tErr } = await supabase
      .from('tickets')
      .select('id,title,status,priority,due_date,client_id,created_at')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (tErr) {
      alert(`Failed to load board: ${tErr.message}`)
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
    loadBoard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grouped = useMemo(() => {
    const byStatus: Record<string, Ticket[]> = {}
    for (const col of COLUMNS) byStatus[col.key] = []
    for (const t of tickets) {
      const s = (t.status || 'backlog') as string
      if (!byStatus[s]) byStatus[s] = []
      byStatus[s].push(t)
    }
    return byStatus
  }, [tickets])

  const updateStatus = async (ticketId: string, newStatus: string) => {
    setSavingId(ticketId)
    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', ticketId)

    setSavingId(null)

    if (error) {
      alert(`Failed to update status: ${error.message}`)
      return
    }

    // Update locally (fast)
    setTickets(prev =>
      prev.map(t => (t.id === ticketId ? { ...t, status: newStatus } : t))
    )
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Board</h1>
        <Link href="/tickets/new" className="bg-black text-white px-4 py-2 rounded">
          Create Ticket
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        {COLUMNS.map(col => (
          <div key={col.key} className="bg-white rounded shadow p-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{col.label}</h2>
              <span className="text-xs text-gray-500">
                {grouped[col.key]?.length ?? 0}
              </span>
            </div>

            <div className="space-y-3">
              {(grouped[col.key] ?? []).map(t => (
                <div key={t.id} className="border rounded p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link className="font-medium underline" href={`/tickets/${t.id}`}>
                      {t.title}
                    </Link>
                    <span className="text-xs text-gray-500">
                      {t.priority ?? '—'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 mt-1">
                    Client: {t.client_id ? (clientNames[t.client_id] ?? '—') : '—'}
                  </div>

                  <div className="text-xs text-gray-600">
                    Due: {t.due_date ?? '—'}
                  </div>

                  <div className="mt-2">
                    <label className="block text-xs text-gray-600 mb-1">
                      Move to
                    </label>
                    <select
                      className="border p-1 w-full text-sm"
                      value={t.status || 'backlog'}
                      onChange={e => updateStatus(t.id, e.target.value)}
                      disabled={savingId === t.id}
                    >
                      {COLUMNS.map(c => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                      <option value="archived">Archived</option>
                    </select>
                    {savingId === t.id && (
                      <div className="text-xs text-gray-500 mt-1">Saving…</div>
                    )}
                  </div>
                </div>
              ))}

              {(grouped[col.key] ?? []).length === 0 && (
                <div className="text-sm text-gray-500">No tickets</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}