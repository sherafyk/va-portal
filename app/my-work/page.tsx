'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/lib/useMe'
import { dueLabel, isOverdue } from '@/lib/format'
import { useToast } from '@/app/components/ui/Toast'

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

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active (not done/archived)' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'ready', label: 'Ready' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' }
]

export default function MyWorkPage() {
  const router = useRouter()
  const toast = useToast()
  const me = useMe()

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientNames, setClientNames] = useState<ClientMap>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | string>('active')

  const load = async () => {
    if (me.loading) return
    if (!me.userId) {
      router.push('/login')
      return
    }

    setLoading(true)

    const { data: tData, error: tErr } = await supabase
      .from('tickets')
      .select('id,title,status,priority,due_date,client_id,created_at')
      .order('created_at', { ascending: false })

    if (tErr) {
      toast.error(tErr.message, 'Failed to load My Work')
      setLoading(false)
      return
    }

    const list = (tData ?? []) as Ticket[]
    setTickets(list)

    const clientIds = Array.from(new Set(list.map(t => t.client_id).filter(Boolean))) as string[]

    if (clientIds.length > 0) {
      const { data: cData, error: cErr } = await supabase
        .from('clients')
        .select('id,name')
        .in('id', clientIds)

      if (cErr) {
        toast.error(cErr.message, 'Failed to load client names')
      }

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
  }, [me.loading, me.userId])

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return sorted.filter(t => {
      if (statusFilter === 'active') {
        const s = (t.status || 'backlog').toLowerCase()
        if (s === 'done' || s === 'archived') return false
      } else if (statusFilter !== 'all') {
        if ((t.status || 'backlog') !== statusFilter) return false
      }

      if (!q) return true
      return t.title.toLowerCase().includes(q)
    })
  }, [sorted, query, statusFilter])

  const updateStatus = async (ticketId: string, newStatus: string) => {
    setSavingId(ticketId)
    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', ticketId)

    setSavingId(null)

    if (error) {
      toast.error(error.message, 'Failed to update status')
      return
    }

    setTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, status: newStatus } : t)))
  }

  if (me.loading || loading) return <div className="text-sm text-slate-600">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Work</h1>
          <div className="mt-1 text-sm text-slate-600">Tickets assigned to you (via RLS).</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            href="/board"
          >
            Board view
          </Link>
          <button
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={load}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block mb-1">Search</label>
            <input placeholder="Search by title…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-slate-600">
              Showing <span className="font-medium text-slate-900">{filtered.length}</span> / {tickets.length}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No tickets match your filters.</div>
        ) : (
          <div className="divide-y">
            {filtered.map(t => {
              const overdue = isOverdue(t.due_date)
              return (
                <div key={t.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link className="font-semibold text-slate-900 hover:underline" href={`/tickets/${t.id}`}>
                      {t.title}
                    </Link>
                    <div className="mt-1 text-sm text-slate-600">
                      Client: {t.client_id ? (clientNames[t.client_id] ?? '—') : '—'}
                      <span className="mx-2">•</span>
                      Priority: <span className="font-medium text-slate-900">{t.priority ?? 'normal'}</span>
                      <span className="mx-2">•</span>
                      Due:{' '}
                      <span className={overdue ? 'font-medium text-red-700' : 'text-slate-700'}>
                        {dueLabel(t.due_date)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="w-44"
                      value={t.status || 'backlog'}
                      onChange={e => updateStatus(t.id, e.target.value)}
                      disabled={savingId === t.id}
                    >
                      {STATUS_OPTIONS.filter(o => !['all', 'active'].includes(o.value)).map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>

                    {savingId === t.id && <div className="text-xs text-slate-500">Saving…</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
