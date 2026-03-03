'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMe } from '@/lib/useMe'
import { dueLabel, isOverdue } from '@/lib/format'
import { useToast } from '@/app/components/ui/Toast'
import ConfirmDialog from '@/app/components/ui/ConfirmDialog'

type Ticket = {
  id: string
  title: string
  status: string | null
  priority: string | null
  due_date: string | null
  client_id: string | null
  assigned_to: string | null
  updated_at: string
  created_at: string
}

type Client = { id: string; name: string }

type Profile = { id: string; full_name: string | null; role: string | null }

type ClientMap = Record<string, string>

type ProfileMap = Record<string, Profile>

const STATUSES = ['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'archived'] as const
const PRIORITIES = ['critical', 'high', 'normal', 'low'] as const

export default function TicketsPage() {
  const router = useRouter()
  const toast = useToast()
  const me = useMe()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [clientNames, setClientNames] = useState<ClientMap>({})
  const [profilesMap, setProfilesMap] = useState<ProfileMap>({})

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('active')
  const [priority, setPriority] = useState<string>('all')
  const [clientId, setClientId] = useState<string>('all')
  const [assigneeId, setAssigneeId] = useState<string>('all')

  const [confirm, setConfirm] = useState<
    | { type: 'archive' | 'delete'; ticketId: string; title: string }
    | null
  >(null)

  const loadTickets = async () => {
    if (me.loading) return
    if (!me.userId) {
      router.push('/login')
      return
    }

    setLoading(true)

    const { data: tData, error: tErr } = await supabase
      .from('tickets')
      .select('id,title,status,priority,due_date,client_id,assigned_to,updated_at,created_at')
      .order('created_at', { ascending: false })

    if (tErr) {
      toast.error(tErr.message, 'Failed to load tickets')
      setLoading(false)
      return
    }

    const list = (tData ?? []) as Ticket[]
    setTickets(list)

    // Load clients used by these tickets
    const ids = Array.from(new Set(list.map(t => t.client_id).filter(Boolean))) as string[]
    if (ids.length) {
      const { data: cData, error: cErr } = await supabase
        .from('clients')
        .select('id,name')
        .in('id', ids)

      if (cErr) toast.error(cErr.message, 'Failed to load clients')

      const map: ClientMap = {}
      ;(cData ?? []).forEach((c: any) => (map[c.id] = c.name))
      setClientNames(map)
    } else {
      setClientNames({})
    }

    // For filters (admin convenience), load all clients by name
    if (me.isAdmin) {
      const { data: allClients, error: allClientsErr } = await supabase
        .from('clients')
        .select('id,name')
        .order('name', { ascending: true })

      if (allClientsErr) toast.error(allClientsErr.message, 'Failed to load client list')
      setClients((allClients ?? []) as Client[])
    } else {
      setClients([])
    }

    // Load assignee profiles referenced
    const assignees = Array.from(new Set(list.map(t => t.assigned_to).filter(Boolean))) as string[]
    if (assignees.length) {
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
    loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loading, me.userId])

  const displayName = (id: string | null) => {
    if (!id) return '—'
    const p = profilesMap[id]
    return p?.full_name || id.slice(0, 8)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return tickets.filter(t => {
      const s = (t.status || 'backlog').toLowerCase()

      if (status === 'active') {
        if (s === 'done' || s === 'archived') return false
      } else if (status !== 'all') {
        if (s !== status) return false
      }

      if (priority !== 'all' && (t.priority || 'normal') !== priority) return false
      if (clientId !== 'all' && t.client_id !== clientId) return false
      if (me.isAdmin && assigneeId !== 'all' && t.assigned_to !== assigneeId) return false

      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        (t.client_id ? (clientNames[t.client_id] || '').toLowerCase().includes(q) : false)
      )
    })
  }, [tickets, query, status, priority, clientId, assigneeId, me.isAdmin, clientNames])

  const updateStatus = async (ticketId: string, newStatus: string) => {
    setSavingId(ticketId)
    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', ticketId)

    setSavingId(null)

    if (error) {
      toast.error(error.message, 'Status update failed')
      return
    }

    setTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, status: newStatus } : t)))
  }

  const archiveTicket = async (ticketId: string) => {
    setSavingId(ticketId)
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', ticketId)
    setSavingId(null)

    if (error) {
      toast.error(error.message, 'Archive failed')
      return
    }

    toast.success('Ticket archived')
    setTickets(prev => prev.map(t => (t.id === ticketId ? { ...t, status: 'archived' } : t)))
  }

  const deleteTicket = async (ticketId: string) => {
    setSavingId(ticketId)
    const { error } = await supabase.from('tickets').delete().eq('id', ticketId)
    setSavingId(null)

    if (error) {
      toast.error(
        error.message,
        'Delete failed'
      )
      return
    }

    toast.success('Ticket deleted')
    setTickets(prev => prev.filter(t => t.id !== ticketId))
  }

  if (me.loading || loading) return <div className="text-sm text-slate-600">Loading…</div>

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === 'delete'
            ? 'Delete ticket permanently?'
            : 'Archive this ticket?'
        }
        description={
          confirm
            ? `${confirm.title}\n\n${confirm.type === 'delete'
                ? 'This will permanently delete the ticket. If you have comments, ensure your database cascades deletes or remove comments first.'
                : 'Archiving hides the ticket from the board and most default views.'
              }`
            : undefined
        }
        confirmText={confirm?.type === 'delete' ? 'Delete' : 'Archive'}
        danger={confirm?.type === 'delete'}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return
          const id = confirm.ticketId
          const type = confirm.type
          setConfirm(null)
          if (type === 'archive') await archiveTicket(id)
          else await deleteTicket(id)
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tickets</h1>
          <div className="mt-1 text-sm text-slate-600">
            Search and filter tickets you have access to.
          </div>
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
            onClick={loadTickets}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="block mb-1">Search</label>
            <input placeholder="Title or client…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="all">All</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="all">All</option>
              {PRIORITIES.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1">Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="all">All</option>
              {(me.isAdmin ? clients : Object.keys(clientNames).map(id => ({ id, name: clientNames[id] })))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          {me.isAdmin && (
            <div>
              <label className="block mb-1">Assignee</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="all">All</option>
                {Object.values(profilesMap)
                  .sort((a, b) => (a.full_name || a.id).localeCompare(b.full_name || b.id))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.id.slice(0, 8)}{p.role ? ` (${p.role})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-3 text-sm text-slate-600">
          Showing <span className="font-medium text-slate-900">{filtered.length}</span> / {tickets.length}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No tickets match your filters.</div>
        ) : (
          <table className="min-w-[900px] w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Title</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Client</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Assigned</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Priority</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Due</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600">Updated</th>
                {me.isAdmin && <th className="px-4 py-3 text-xs font-semibold text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(t => {
                const overdue = isOverdue(t.due_date)
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link className="font-medium text-slate-900 hover:underline" href={`/tickets/${t.id}`}>
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {t.client_id ? clientNames[t.client_id] ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{displayName(t.assigned_to)}</td>
                    <td className="px-4 py-3">
                      <select
                        className="w-40"
                        value={t.status || 'backlog'}
                        disabled={savingId === t.id}
                        onChange={e => updateStatus(t.id, e.target.value)}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{t.priority ?? '—'}</td>
                    <td className={"px-4 py-3 text-sm " + (overdue ? 'text-red-700 font-medium' : 'text-slate-700')}>
                      {dueLabel(t.due_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(t.updated_at).toLocaleString()}</td>
                    {me.isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                            onClick={() => setConfirm({ type: 'archive', ticketId: t.id, title: t.title })}
                            disabled={savingId === t.id}
                          >
                            Archive
                          </button>
                          <button
                            className="rounded-md border border-red-300 bg-white px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                            onClick={() => setConfirm({ type: 'delete', ticketId: t.id, title: t.title })}
                            disabled={savingId === t.id}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
