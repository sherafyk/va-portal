'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/lib/useMe'
import { formatDate, formatDateTime } from '@/lib/format'
import { useToast } from '@/app/components/ui/Toast'

type TimeEntry = {
  id: string
  ticket_id: string
  user_id: string
  work_date: string
  minutes: number | null
  started_at: string | null
  ended_at: string | null
  note: string | null
  created_at: string
}

type Profile = {
  id: string
  full_name: string | null
  role: string | null
}

type Ticket = {
  id: string
  title: string
  client_id: string | null
}

type Client = {
  id: string
  name: string
}

function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function minutesFromEntry(e: TimeEntry): number {
  if (typeof e.minutes === 'number' && Number.isFinite(e.minutes)) return Math.max(0, e.minutes)
  if (e.started_at && e.ended_at) {
    const a = new Date(e.started_at).getTime()
    const b = new Date(e.ended_at).getTime()
    const mins = Math.round((b - a) / 60000)
    return Math.max(0, mins)
  }
  return 0
}

export default function TimesheetPage() {
  const router = useRouter()
  const toast = useToast()
  const me = useMe()

  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [ticketsMap, setTicketsMap] = useState<Record<string, Ticket>>({})
  const [clientsMap, setClientsMap] = useState<Record<string, Client>>({})
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({})

  // default: last 7 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return toISODate(d)
  })
  const [endDate, setEndDate] = useState(() => toISODate(new Date()))

  const [selectedUser, setSelectedUser] = useState<string>('')

  const load = async () => {
    if (me.loading) return
    if (!me.userId) {
      router.push('/login')
      return
    }

    setLoading(true)

    // Admin can pick a VA; otherwise it is always "me".
    const userFilter = me.isAdmin ? (selectedUser || null) : me.userId

    let q = supabase
      .from('time_entries')
      .select('id,ticket_id,user_id,work_date,minutes,started_at,ended_at,note,created_at')
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (userFilter) q = q.eq('user_id', userFilter)

    const { data, error } = await q
    if (error) {
      toast.error(error.message, 'Failed to load timesheet')
      setEntries([])
      setLoading(false)
      return
    }

    const rows = (data ?? []) as TimeEntry[]
    setEntries(rows)

    // Load lookup maps (tickets, clients, profiles)
    const ticketIds = Array.from(new Set(rows.map(r => r.ticket_id).filter(Boolean)))
    const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)))

    if (ticketIds.length > 0) {
      const { data: tData } = await supabase
        .from('tickets')
        .select('id,title,client_id')
        .in('id', ticketIds)

      const tMap: Record<string, Ticket> = {}
      ;(tData ?? []).forEach((t: any) => (tMap[t.id] = t))
      setTicketsMap(tMap)

      const clientIds = Array.from(
        new Set(Object.values(tMap).map(t => t.client_id).filter(Boolean) as string[])
      )

      if (clientIds.length > 0) {
        const { data: cData } = await supabase.from('clients').select('id,name').in('id', clientIds)
        const cMap: Record<string, Client> = {}
        ;(cData ?? []).forEach((c: any) => (cMap[c.id] = c))
        setClientsMap(cMap)
      } else {
        setClientsMap({})
      }
    } else {
      setTicketsMap({})
      setClientsMap({})
    }

    if (userIds.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id,full_name,role').in('id', userIds)
      const pMap: Record<string, Profile> = {}
      ;(pData ?? []).forEach((p: any) => (pMap[p.id] = p))
      setProfilesMap(pMap)
    } else {
      setProfilesMap({})
    }

    // Admin: VA dropdown
    if (me.isAdmin) {
      const { data: allP } = await supabase.from('profiles').select('id,full_name,role').order('full_name', { ascending: true })
      setProfiles((allP ?? []) as Profile[])
    } else {
      setProfiles([])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loading, me.userId, me.isAdmin, startDate, endDate, selectedUser])

  const totalMinutes = useMemo(() => entries.reduce((sum, e) => sum + minutesFromEntry(e), 0), [entries])
  const totalHours = useMemo(() => (totalMinutes / 60).toFixed(2), [totalMinutes])

  const grouped = useMemo(() => {
    // Group by ticket for subtotals
    const map: Record<string, TimeEntry[]> = {}
    entries.forEach(e => {
      map[e.ticket_id] = map[e.ticket_id] || []
      map[e.ticket_id].push(e)
    })
    return Object.entries(map).map(([ticketId, rows]) => {
      const mins = rows.reduce((s, r) => s + minutesFromEntry(r), 0)
      return { ticketId, rows, minutes: mins }
    })
  }, [entries])

  const nameOf = (id: string) => profilesMap[id]?.full_name || id.slice(0, 8)

  if (me.loading) return <div className="text-sm text-slate-600">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Timesheet</h1>
          <div className="text-sm text-slate-600">Logged time entries grouped by ticket.</div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {me.isAdmin && (
            <div>
              <label className="block mb-1">VA</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                <option value="">All</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.id.slice(0, 8)}{p.role ? ` (${p.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block mb-1">Start</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block mb-1">End</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-700">
          <div className="font-medium text-slate-900">Total</div>
          <div>
            {totalMinutes} minutes ({totalHours} hours)
          </div>
        </div>

        <div className="text-sm text-slate-600">
          Tip: VAs can log time from inside each ticket.
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-600">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-600">No time entries in this range.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(g => {
            const t = ticketsMap[g.ticketId]
            const clientName = t?.client_id ? clientsMap[t.client_id]?.name : null
            return (
              <div key={g.ticketId} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-500">Ticket</div>
                    <div className="font-semibold text-slate-900 truncate">
                      <Link className="text-blue-700 hover:underline" href={`/tickets/${g.ticketId}`}>
                        {t?.title || g.ticketId}
                      </Link>
                    </div>
                    <div className="text-sm text-slate-600">{clientName ? `Client: ${clientName}` : 'Client: —'}</div>
                  </div>
                  <div className="text-sm text-slate-700">
                    <div className="text-slate-500">Subtotal</div>
                    <div className="font-medium">{g.minutes} min ({(g.minutes / 60).toFixed(2)} hr)</div>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">VA</th>
                        <th className="py-2 pr-4">Time</th>
                        <th className="py-2 pr-4">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map(r => {
                        const mins = minutesFromEntry(r)
                        const timeStr = r.started_at
                          ? r.ended_at
                            ? `${formatDateTime(r.started_at)} → ${formatDateTime(r.ended_at)} (${(mins / 60).toFixed(2)} hr)`
                            : `${formatDateTime(r.started_at)} → Running…`
                          : `${mins} min (${(mins / 60).toFixed(2)} hr)`

                        return (
                          <tr key={r.id} className="border-t border-slate-100">
                            <td className="py-2 pr-4 whitespace-nowrap">{formatDate(r.work_date)}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{nameOf(r.user_id)}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{timeStr}</td>
                            <td className="py-2 pr-4">{r.note || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
