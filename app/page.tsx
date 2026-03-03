'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/lib/useMe'
import { useToast } from '@/app/components/ui/Toast'

type Metric = {
  label: string
  value: number
  hint?: string
  href?: string
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function Dashboard() {
  const router = useRouter()
  const toast = useToast()
  const me = useMe()

  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metric[]>([])

  const today = useMemo(() => new Date(), [])

  useEffect(() => {
    const load = async () => {
      // Wait until me is loaded (prevents flicker + redundant queries)
      if (me.loading) return

      if (!me.userId) {
        router.push('/login')
        return
      }

      if (!me.isAdmin) {
        router.push('/my-work')
        return
      }

      setLoading(true)

      const todayStr = ymd(today)
      const in3 = new Date(today)
      in3.setDate(in3.getDate() + 3)
      const in3Str = ymd(in3)

      // Counts (Supabase can return exact counts with head:true)
      const [ticketsAll, ticketsOpen, ticketsBlocked, ticketsDueSoon, clientsAll] = await Promise.all([
        supabase.from('tickets').select('*', { count: 'exact', head: true }),
        supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .not('status', 'in', '(done,archived)'),
        supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'blocked'),
        supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .gte('due_date', todayStr)
          .lte('due_date', in3Str)
          .not('status', 'in', '(done,archived)'),
        supabase.from('clients').select('*', { count: 'exact', head: true })
      ])

      const anyErr =
        ticketsAll.error ||
        ticketsOpen.error ||
        ticketsBlocked.error ||
        ticketsDueSoon.error ||
        clientsAll.error

      if (anyErr) {
        toast.error(anyErr.message, 'Failed to load dashboard')
        setLoading(false)
        return
      }

      setMetrics([
        { label: 'Total Tickets', value: ticketsAll.count || 0, href: '/tickets' },
        {
          label: 'Open Tickets',
          value: ticketsOpen.count || 0,
          hint: 'Not done / archived',
          href: '/board'
        },
        { label: 'Blocked', value: ticketsBlocked.count || 0, href: '/board' },
        {
          label: 'Due in 3 Days',
          value: ticketsDueSoon.count || 0,
          hint: `${todayStr} → ${in3Str}`,
          href: '/tickets'
        },
        { label: 'Clients', value: clientsAll.count || 0, href: '/clients' }
      ])

      setLoading(false)
    }

    load()
  }, [me.loading, me.userId, me.isAdmin, router, toast, today])

  if (me.loading || loading) {
    return <div className="text-sm text-slate-600">Loading dashboard…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
          <div className="mt-1 text-sm text-slate-600">
            Quick overview + shortcuts.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/tickets/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create Ticket
          </Link>
          <Link
            href="/templates"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Templates
          </Link>
          <Link
            href="/clients"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Clients
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map(m => (
          <Link
            key={m.label}
            href={m.href || '#'}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow"
          >
            <div className="text-sm text-slate-600">{m.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{m.value}</div>
            {m.hint && <div className="mt-1 text-xs text-slate-500">{m.hint}</div>}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Workflow shortcuts</div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            href="/board"
            className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
          >
            <div className="font-medium">Board</div>
            <div className="text-sm text-slate-600 mt-1">Move tickets between statuses quickly.</div>
          </Link>
          <Link
            href="/tickets"
            className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
          >
            <div className="font-medium">Tickets list</div>
            <div className="text-sm text-slate-600 mt-1">Search, filter, and open details.</div>
          </Link>
          <Link
            href="/help"
            className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
          >
            <div className="font-medium">Help</div>
            <div className="text-sm text-slate-600 mt-1">Reference the portal workflow and rules.</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
