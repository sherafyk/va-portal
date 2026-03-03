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
  assigned_to: string | null
  created_at: string
}

type Client = { id: string; name: string }

type Profile = { id: string; full_name: string | null; role: string | null }

type ClientMap = Record<string, string>

type ProfileMap = Record<string, Profile>

const COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'ready', label: 'Ready' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' }
] as const

export default function BoardPage() {
  const router = useRouter()
  const toast = useToast()
  const me = useMe()

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clientNames, setClientNames] = useState<ClientMap>({})
  const [profilesMap, setProfilesMap] = useState<ProfileMap>({})

  const [savingId, setSavingId] = useState<string | null>(null)

  const [clientFilter, setClientFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

  const loadBoard = async () => {
    if (me.loading) return
    if (!me.userId) {
      router.push('/login')
      return
    }

    setLoading(true)

    const { data: tData, error: tErr } = await supabase
      .from('tickets')
      .select('id,title,status,priority,due_date,client_id,assigned_to,created_at')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (tErr) {
      toast.error(tErr.message, 'Failed to load board')
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

      if (cErr) toast.error(cErr.message, 'Failed to load client names')

      const map: ClientMap = {}
      ;(cData ?? []).forEach((c: any) => (map[c.id] = c.name))
      setClientNames(map)
    } else {
      setClientNames({})
    }

    const assignees = Array.from(new Set(list.map(t => t.assigned_to).filter(Boolean))) as string[]
    if (assignees.length > 0) {
      const { data: pData, error: pErr } = await supabase
        .from('profiles')
        .select('id,full_name,role')
        .in('id', assignees)

      if (pErr) toast.error(pErr.message, 'Failed to load assignees')

      const map: ProfileMap = {}
      ;(pData ?? []).forEach((p: any) => (map[p.id] = p))
      setProfilesMap(map)
    } else {
      setProfilesMap({})
    }

    setLoading(false)
  }

  useEffect(() => {
    loadBoard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loading, me.userId])

  const displayName = (id: string | null) => {
    if (!id) return '—'
    const p = profilesMap[id]
    return p?.full_name || id.slice(0, 8)
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (clientFilter !== 'all' && t.client_id !== clientFilter) return false
      if (me.isAdmin && assigneeFilter !== 'all' && t.assigned_to !== assigneeFilter) return false
      return true
    })
  }, [tickets, clientFilter, assigneeFilter, me.isAdmin])

  const grouped = useMemo(() => {
    const byStatus: Record<string, Ticket[]> = {}
    for (const col of COLUMNS) byStatus[col.key] = []

    for (const t of filteredTickets) {
      const s = (t.status || 'backlog') as string
      if (!byStatus[s]) byStatus[s] = []
      byStatus[s].push(t)
    }

    return byStatus
  }, [filteredTickets])

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

  const clientsForFilter = useMemo(() => {
    const ids = Array.from(new Set(tickets.map(t => t.client_id).filter(Boolean))) as string[]
    return ids
      .map(id => ({ id, name: clientNames[id] || id }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [tickets, clientNames])

  const assigneesForFilter = useMemo(() => {
    return Object.values(profilesMap)
      .map(p => ({ id: p.id, name: p.full_name || p.id.slice(0, 8), role: p.role }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [profilesMap])

  if (me.loading || loading) return <div className="text-sm text-slate-600">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Board</h1>
          <div className="mt-1 text-sm text-slate-600">Kanban view (archived hidden).</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {me.isAdmin && (
            <Link
              href="/tickets/new"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Create Ticket
            </Link>
          )}
          <button
            onClick={loadBoard}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1">Client</label>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
              <option value="all">All</option>
              {clientsForFilter.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {me.isAdmin && (
            <div>
              <label className="block mb-1">Assignee</label>
              <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
                <option value="all">All</option>
                {assigneesForFilter.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.role ? ` (${a.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 min-w-[1100px]">
          {COLUMNS.map(col => (
            <div key={col.key} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{col.label}</h2>
                <span className="text-xs text-slate-500">{grouped[col.key]?.length ?? 0}</span>
              </div>

              <div className="p-3 space-y-3">
                {(grouped[col.key] ?? []).map(t => {
                  const overdue = isOverdue(t.due_date)
                  return (
                    <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link className="font-medium text-slate-900 hover:underline" href={`/tickets/${t.id}`}>
                          {t.title}
                        </Link>
                        <span className="text-xs text-slate-500">{t.priority ?? '—'}</span>
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        Client: {t.client_id ? clientNames[t.client_id] ?? '—' : '—'}
                      </div>

                      <div className="text-xs text-slate-600">
                        Assigned: {displayName(t.assigned_to)}
                      </div>

                      <div className={"text-xs mt-1 " + (overdue ? 'text-red-700 font-medium' : 'text-slate-600')}>
                        Due: {dueLabel(t.due_date)}
                      </div>

                      <div className="mt-2">
                        <label className="block text-xs text-slate-600 mb-1">Move to</label>
                        <select
                          className="text-sm"
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
                        {savingId === t.id && <div className="text-xs text-slate-500 mt-1">Saving…</div>}
                      </div>
                    </div>
                  )
                })}

                {(grouped[col.key] ?? []).length === 0 && (
                  <div className="text-sm text-slate-500 p-2">No tickets</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
