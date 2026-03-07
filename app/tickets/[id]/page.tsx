'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/lib/useMe'
import { formatDateTime, dueLabel, isOverdue } from '@/lib/format'
import { useToast } from '@/app/components/ui/Toast'
import ConfirmDialog from '@/app/components/ui/ConfirmDialog'

type Ticket = {
  id: string
  client_id: string | null
  title: string
  description: string | null
  task_type: string | null
  priority: string | null
  status: string | null
  due_date: string | null
  estimated_effort: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type Client = {
  id: string
  name: string
  website_url: string | null
  wp_admin_url: string | null
  drive_folder_url: string | null
}

type Comment = {
  id: string
  ticket_id: string
  author_id: string | null
  body: string
  created_at: string
}

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

const STATUSES = ['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'archived']
const PRIORITIES = ['critical', 'high', 'normal', 'low']

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

function getSection(md: string, heading: string): string {
  // Extract content under `## Heading` until next `## `
  const re = new RegExp(`(^|\\n)##\\s+${heading}\\s*\\n([\\s\\S]*?)(\\n##\\s+|$)`, 'i')
  const m = md.match(re)
  if (!m) return ''
  return (m[2] || '').trim()
}

type TicketSections = {
  context: string
  checklist: string
  links: string
  dod: string
  notes: string
}

function parseTicketMarkdown(md: string): TicketSections {
  const context = getSection(md, 'Context')
  const checklist = getSection(md, 'Checklist')
  const links = getSection(md, 'Links & Access')
  const dod = getSection(md, 'Definition of Done')
  const notes = getSection(md, 'Notes')

  const any = [context, checklist, links, dod, notes].some(s => (s || '').trim().length > 0)

  // If the ticket isn't structured yet, keep the entire body as context.
  if (!any && md.trim()) {
    return { context: md.trim(), checklist: '', links: '', dod: '', notes: '' }
  }

  return { context, checklist, links, dod, notes }
}

function buildTicketMarkdown(s: TicketSections): string {
  return [
    '## Context',
    (s.context || '').trim() || '—',
    '',
    '## Checklist',
    (s.checklist || '').trim() || '—',
    '',
    '## Links & Access',
    (s.links || '').trim() || '—',
    '',
    '## Definition of Done',
    (s.dod || '').trim() || '—',
    '',
    '## Notes',
    (s.notes || '').trim() || '—'
  ].join('\n')
}

function normalizeMarkdown(md: string): string {
  // Normalize markdown to avoid "unsaved" flicker caused by whitespace.
  return buildTicketMarkdown(parseTicketMarkdown(md || ''))
}

function parseChecklist(text: string): string[] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const items = lines
    .filter(l => l.startsWith('- ') || l.startsWith('* '))
    .map(l => l.replace(/^[-*]\\s+/, '').trim())
    .filter(Boolean)

  if (items.length === 0) return lines
  return items
}

function MarkdownBlock({ content, placeholder = '—' }: { content: string; placeholder?: string }) {
  const text = content.trim()

  if (!text) {
    return <div className="text-sm text-slate-600">{placeholder}</div>
  }

  return (
    <ReactMarkdown
      className="ticket-markdown"
      components={{
        a: props => <a {...props} target="_blank" rel="noreferrer" />
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>()
  const ticketId = params.id
  const router = useRouter()
  const toast = useToast()
  const me = useMe()

  const [loading, setLoading] = useState(true)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [comments, setComments] = useState<Comment[]>([])

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null)
  const [startNote, setStartNote] = useState('')
  const [manualHours, setManualHours] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [timeSaving, setTimeSaving] = useState(false)

  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({})
  const [assignees, setAssignees] = useState<Profile[]>([])

  // local editable fields
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('backlog')
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [assignedTo, setAssignedTo] = useState<string>('')

  const [sections, setSections] = useState<TicketSections>({
    context: '',
    checklist: '',
    links: '',
    dod: '',
    notes: ''
  })

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [rawDescription, setRawDescription] = useState('')

  const [newComment, setNewComment] = useState('')

  const [saving, setSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [ticketConfirm, setTicketConfirm] = useState<null | { type: 'archive' | 'delete' }>(null)

  // used to refresh the running timer UI
  const [tick, setTick] = useState(0)

  // Checklist UI-only checkmarks (not persisted)
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!runningEntry) return
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [runningEntry])

  const canEditMeta = me.isAdmin
  const canEditInstructions = me.isAdmin
  const canDelete = me.isAdmin

  const authorName = useMemo(() => {
    return (id?: string | null) =>
      id && profilesMap[id]?.full_name
        ? profilesMap[id].full_name!
        : id
        ? id.slice(0, 8)
        : 'Unknown'
  }, [profilesMap])

  const checklistItems = useMemo(() => parseChecklist(sections.checklist || ''), [sections.checklist])

  const totalLoggedMinutes = useMemo(
    () => timeEntries.reduce((sum, e) => sum + minutesFromEntry(e), 0),
    [timeEntries]
  )

  const runningElapsedMinutes = useMemo(() => {
    if (!runningEntry?.started_at) return 0
    const start = new Date(runningEntry.started_at).getTime()
    const now = Date.now()
    return Math.max(0, Math.round((now - start) / 60000))
  }, [runningEntry, tick])

  // Keep raw <-> structured in sync when toggling advanced editor.
  useEffect(() => {
    if (!me.isAdmin) return

    if (advancedOpen) {
      setRawDescription(buildTicketMarkdown(sections))
    } else {
      setSections(parseTicketMarkdown(rawDescription))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedOpen])

  const adminHasUnsaved = useMemo(() => {
    if (!ticket || !me.isAdmin) return false

    const currentDescription = advancedOpen
      ? rawDescription
      : buildTicketMarkdown(sections)

    const originalDescription = ticket.description || ''

    const descChanged = advancedOpen
      ? currentDescription !== originalDescription
      : normalizeMarkdown(currentDescription) !== normalizeMarkdown(originalDescription)

    const metaChanged =
      title.trim() !== (ticket.title || '').trim() ||
      (ticket.priority || 'normal') !== priority ||
      (ticket.due_date || '') !== (dueDate || '') ||
      (ticket.assigned_to || '') !== (assignedTo || '')

    return descChanged || metaChanged
  }, [ticket, me.isAdmin, title, priority, dueDate, assignedTo, sections, rawDescription, advancedOpen])

  const loadEverything = async () => {
    if (me.loading) return
    if (!me.userId) {
      router.push('/login')
      return
    }

    setLoading(true)

    const { data: tData, error: tErr } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single()

    if (tErr || !tData) {
      toast.error(tErr?.message || 'Not found', 'Failed to load ticket')
      router.push('/tickets')
      return
    }

    const t = tData as Ticket
    setTicket(t)

    setTitle(t.title || '')
    setStatus(t.status || 'backlog')
    setPriority(t.priority || 'normal')
    setDueDate(t.due_date || '')
    setAssignedTo(t.assigned_to || '')

    const md = t.description || ''
    setRawDescription(md)
    setSections(parseTicketMarkdown(md))

    // Client (optional)
    if (t.client_id) {
      const { data: cData } = await supabase
        .from('clients')
        .select('id,name,website_url,wp_admin_url,drive_folder_url')
        .eq('id', t.client_id)
        .single()

      if (cData) setClient(cData as Client)
      else setClient(null)
    } else {
      setClient(null)
    }

    // Comments
    const { data: cmData, error: cmErr } = await supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (cmErr) {
      toast.error(cmErr.message, 'Failed to load comments')
      setComments([])
    } else {
      setComments((cmData ?? []) as Comment[])
    }

    // Time entries
    const { data: teData, error: teErr } = await supabase
      .from('time_entries')
      .select('id,ticket_id,user_id,work_date,minutes,started_at,ended_at,note,created_at')
      .eq('ticket_id', ticketId)
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (teErr) {
      toast.error(teErr.message, 'Failed to load time entries')
      setTimeEntries([])
      setRunningEntry(null)
    } else {
      const rows = (teData ?? []) as TimeEntry[]
      setTimeEntries(rows)
      const running = rows.find(r => r.user_id === me.userId && r.started_at && !r.ended_at) || null
      setRunningEntry(running)
    }

    // Profiles map (assigned, created, comment authors)
    const ids = new Set<string>()
    if (t.assigned_to) ids.add(t.assigned_to)
    if (t.created_by) ids.add(t.created_by)
    ;(cmData ?? []).forEach((c: any) => c.author_id && ids.add(c.author_id))

    ;(teData ?? []).forEach((t: any) => t.user_id && ids.add(t.user_id))

    if (ids.size > 0) {
      const idList = Array.from(ids)
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', idList)

      const map: Record<string, Profile> = {}
      ;(pData ?? []).forEach((p: any) => (map[p.id] = p))
      setProfilesMap(map)
    } else {
      setProfilesMap({})
    }

    // Admin: load all assignees for dropdown
    if (me.isAdmin) {
      const { data: allP } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name', { ascending: true })

      setAssignees((allP ?? []) as Profile[])
    } else {
      setAssignees([])
    }

    setAdvancedOpen(false)
    setChecked({})
    setLoading(false)
  }

  useEffect(() => {
    loadEverything()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loading, me.userId, ticketId])

  const buildCopySummary = () => {
    if (!ticket) return ''

    const lines: string[] = []
    lines.push(`Ticket: ${title || ticket.title}`)
    lines.push(`Status: ${status} | Priority: ${priority} | Due: ${dueDate || '—'}`)
    lines.push(`Client: ${client?.name ?? '—'}`)
    lines.push(`Assigned To: ${authorName(assignedTo || ticket.assigned_to)}`)
    lines.push('')

    if ((sections.links || '').trim()) {
      lines.push('Links:')
      lines.push(sections.links.trim())
      lines.push('')
    }

    if ((sections.context || '').trim()) {
      lines.push('Context:')
      lines.push(sections.context.trim())
      lines.push('')
    }

    if (checklistItems.length > 0) {
      lines.push('Checklist:')
      checklistItems.forEach((it, idx) => {
        const mark = checked[idx] ? '[x]' : '[ ]'
        lines.push(`${mark} ${it}`)
      })
      lines.push('')
    }

    if ((sections.dod || '').trim()) {
      lines.push('Definition of Done:')
      lines.push(sections.dod.trim())
      lines.push('')
    }

    if ((sections.notes || '').trim()) {
      lines.push('Notes:')
      lines.push(sections.notes.trim())
      lines.push('')
    }

    lines.push(`Link: /tickets/${ticket.id}`)
    return lines.join('\n')
  }

  const handleCopy = async () => {
    const text = buildCopySummary()
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied summary to clipboard')
    } catch {
      toast.error('Copy failed (browser blocked clipboard).')
    }
  }

  const updateStatus = async (newStatus: string) => {
    if (!ticket) return
    setStatus(newStatus)

    setStatusSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('tickets')
      .update({ status: newStatus, updated_at: now })
      .eq('id', ticket.id)

    setStatusSaving(false)

    if (error) {
      toast.error(error.message, 'Status update failed')
      // revert
      setStatus(ticket.status || 'backlog')
      return
    }

    setTicket(prev => (prev ? { ...prev, status: newStatus, updated_at: now } : prev))
  }

  const handleSave = async () => {
    if (!ticket) return
    if (!me.isAdmin) return

    // Guardrail: DoD should not be empty
    const dod = (sections.dod || '').trim()
    if (!dod || dod === '—') {
      toast.error('Definition of Done cannot be empty.')
      return
    }

    setSaving(true)

    const nextDescription = advancedOpen ? rawDescription : buildTicketMarkdown(sections)

    const patch: Partial<Ticket> = {
      title: title.trim() || ticket.title,
      priority,
      due_date: dueDate || null,
      assigned_to: assignedTo || null,
      description: nextDescription,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('tickets').update(patch).eq('id', ticket.id)

    setSaving(false)

    if (error) {
      toast.error(error.message, 'Save failed')
      return
    }

    toast.success('Saved')
    await loadEverything()
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setSaving(true)
    const { error } = await supabase.from('ticket_comments').insert([
      {
        ticket_id: ticketId,
        author_id: me.userId,
        body: newComment.trim()
      }
    ])
    setSaving(false)

    if (error) {
      toast.error(error.message, 'Comment failed')
      return
    }

    setNewComment('')
    toast.success('Comment added')
    await loadEverything()
  }

  const archiveTicket = async () => {
    if (!ticket) return
    setSaving(true)
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', ticket.id)
    setSaving(false)

    if (error) {
      toast.error(error.message, 'Archive failed')
      return
    }

    toast.success('Ticket archived')
    router.push('/tickets')
  }

  const deleteTicket = async () => {
    if (!ticket) return
    setSaving(true)
    const { error } = await supabase.from('tickets').delete().eq('id', ticket.id)
    setSaving(false)

    if (error) {
      toast.error(error.message, 'Delete failed')
      toast.info('If comments exist, ensure ticket_comments has ON DELETE CASCADE or delete comments first.')
      return
    }

    toast.success('Ticket deleted')
    router.push('/tickets')
  }

  const startTimer = async () => {
    if (!me.userId) return
    if (runningEntry) {
      toast.info('Timer already running for you on this ticket.')
      return
    }
    setTimeSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('time_entries').insert([
      {
        ticket_id: ticketId,
        user_id: me.userId,
        work_date: toISODate(new Date()),
        started_at: now,
        ended_at: null,
        minutes: null,
        note: startNote.trim() || null
      }
    ])
    setTimeSaving(false)
    if (error) {
      toast.error(error.message, 'Failed to start timer')
      return
    }
    toast.success('Timer started')
    setStartNote('')
    await loadEverything()
  }

  const stopTimer = async () => {
    if (!runningEntry) return
    setTimeSaving(true)
    const end = new Date()
    const start = new Date(runningEntry.started_at || '')
    const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))

    const { error } = await supabase
      .from('time_entries')
      .update({ ended_at: end.toISOString(), minutes })
      .eq('id', runningEntry.id)

    setTimeSaving(false)
    if (error) {
      toast.error(error.message, 'Failed to stop timer')
      return
    }
    toast.success(`Timer stopped (${(minutes / 60).toFixed(2)} hr)`)
    await loadEverything()
  }

  const addManualEntry = async () => {
    if (!me.userId) return
    const hours = Number(manualHours)
    if (!Number.isFinite(hours) || hours <= 0) {
      toast.error('Enter a valid number of hours (e.g. 1.5).')
      return
    }
    const minutes = Math.round(hours * 60)
    setTimeSaving(true)
    const { error } = await supabase.from('time_entries').insert([
      {
        ticket_id: ticketId,
        user_id: me.userId,
        work_date: toISODate(new Date()),
        minutes,
        started_at: null,
        ended_at: null,
        note: manualNote.trim() || null
      }
    ])
    setTimeSaving(false)
    if (error) {
      toast.error(error.message, 'Failed to add entry')
      return
    }
    toast.success('Time entry added')
    setManualHours('')
    setManualNote('')
    await loadEverything()
  }

  const deleteTimeEntry = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this time entry?')) return
    setTimeSaving(true)
    const { error } = await supabase.from('time_entries').delete().eq('id', id)
    setTimeSaving(false)
    if (error) {
      toast.error(error.message, 'Failed to delete entry')
      return
    }
    toast.success('Entry deleted')
    await loadEverything()
  }

  if (me.loading || loading) return <div className="text-sm text-slate-600">Loading…</div>
  if (!ticket) return <div className="text-sm text-slate-600">Ticket not found.</div>

  const overdue = isOverdue(dueDate)

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!ticketConfirm}
        title={ticketConfirm?.type === 'delete' ? 'Delete ticket permanently?' : 'Archive this ticket?'}
        description={
          ticketConfirm?.type === 'delete'
            ? 'This will permanently delete the ticket. Make sure comments cascade delete (recommended).'
            : 'Archiving hides the ticket from the board and default views.'
        }
        confirmText={ticketConfirm?.type === 'delete' ? 'Delete' : 'Archive'}
        danger={ticketConfirm?.type === 'delete'}
        onCancel={() => setTicketConfirm(null)}
        onConfirm={async () => {
          const type = ticketConfirm?.type
          setTicketConfirm(null)
          if (type === 'archive') await archiveTicket()
          if (type === 'delete') await deleteTicket()
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link className="text-sm text-blue-700 hover:underline" href="/tickets">
            ← Back to Tickets
          </Link>

          <div className="mt-2">
            {canEditMeta ? (
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="text-2xl font-semibold"
              />
            ) : (
              <h1 className="text-2xl font-semibold text-slate-900">{ticket.title}</h1>
            )}
            <div className="text-xs text-slate-500 mt-1 font-mono">{ticket.id}</div>
          </div>

          <div className="mt-2 text-sm text-slate-700">
            Client: <span className="font-medium">{client?.name ?? '—'}</span>
            <span className="mx-2">•</span>
            Assigned: <span className="font-medium">{authorName(assignedTo || ticket.assigned_to)}</span>
            <span className="mx-2">•</span>
            Due:{' '}
            <span className={overdue ? 'font-medium text-red-700' : 'text-slate-700'}>
              {dueLabel(dueDate)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopy}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Copy Summary
          </button>

          {me.isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving || !adminHasUnsaved}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {saving ? 'Saving…' : adminHasUnsaved ? 'Save changes' : 'Saved'}
            </button>
          )}

          {canDelete && (
            <>
              <button
                onClick={() => setTicketConfirm({ type: 'archive' })}
                disabled={saving}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Archive
              </button>
              <button
                onClick={() => setTicketConfirm({ type: 'delete' })}
                disabled={saving}
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Meta */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block mb-1">Status</label>
                <select
                  value={status}
                  onChange={e => updateStatus(e.target.value)}
                  disabled={statusSaving || saving}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {statusSaving && <div className="text-xs text-slate-500 mt-1">Saving status…</div>}
              </div>

              <div>
                <label className="block mb-1">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} disabled={!canEditMeta}>
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {!canEditMeta && <div className="text-xs text-slate-500 mt-1">Admin only</div>}
              </div>

              <div>
                <label className="block mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={!canEditMeta} />
                {!canEditMeta && <div className="text-xs text-slate-500 mt-1">Admin only</div>}
              </div>
            </div>

            {canEditMeta && (
              <div>
                <label className="block mb-1">Assigned To</label>
                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                  <option value="">Unassigned</option>
                  {assignees.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.full_name || a.id.slice(0, 8)}{a.role ? ` (${a.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Instructions</h2>
                <div className="text-sm text-slate-600">
                  Structured sections for clarity.
                </div>
              </div>

              {canEditInstructions && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={advancedOpen}
                    onChange={e => setAdvancedOpen(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Advanced (raw markdown)
                </label>
              )}
            </div>

            {!advancedOpen ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Context</div>
                  {canEditInstructions ? (
                    <textarea
                      rows={4}
                      value={sections.context}
                      onChange={e => setSections(prev => ({ ...prev, context: e.target.value }))}
                      placeholder="Background, intent, constraints…"
                    />
                  ) : (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <MarkdownBlock content={sections.context || ''} />
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Checklist</div>
                  <div className="text-xs text-slate-500">Checkmarks below are UI-only (not saved).</div>

                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    {checklistItems.length === 0 ? (
                      <div className="text-sm text-slate-600">No checklist found.</div>
                    ) : (
                      <div className="space-y-2">
                        {checklistItems.map((item, idx) => (
                          <label key={idx} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={!!checked[idx]}
                              onChange={e => setChecked(prev => ({ ...prev, [idx]: e.target.checked }))}
                            />
                            <span className="text-sm text-slate-800">{item}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {canEditInstructions && (
                    <textarea
                      className="mt-3 font-mono"
                      rows={6}
                      value={sections.checklist}
                      onChange={e => setSections(prev => ({ ...prev, checklist: e.target.value }))}
                      placeholder="- Step 1\n- Step 2\n- Step 3"
                    />
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Links & Access</div>
                  {canEditInstructions ? (
                    <textarea
                      className="font-mono"
                      rows={5}
                      value={sections.links}
                      onChange={e => setSections(prev => ({ ...prev, links: e.target.value }))}
                      placeholder="Website: …\nWP Admin: …\nDrive: …"
                    />
                  ) : (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <MarkdownBlock content={sections.links || ''} />
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Definition of Done</div>
                  {canEditInstructions ? (
                    <textarea
                      rows={4}
                      value={sections.dod}
                      onChange={e => setSections(prev => ({ ...prev, dod: e.target.value }))}
                      placeholder="What must be true before this ticket can be marked done?"
                    />
                  ) : (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <MarkdownBlock content={sections.dod || ''} />
                    </div>
                  )}
                  {canEditInstructions && (!sections.dod.trim() || sections.dod.trim() === '—') && (
                    <div className="text-xs text-red-700 mt-1">DoD should be specific and non-empty.</div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900">Notes</div>
                  {canEditInstructions ? (
                    <textarea
                      rows={3}
                      value={sections.notes}
                      onChange={e => setSections(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  ) : (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <MarkdownBlock content={sections.notes || ''} />
                    </div>
                  )}
                </div>

                {canEditInstructions && (
                  <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">Preview saved markdown</summary>
                    <pre className="whitespace-pre-wrap text-sm text-slate-800 mt-3">{buildTicketMarkdown(sections)}</pre>
                  </details>
                )}
              </div>
            ) : (
              <div>
                <textarea
                  className="font-mono"
                  rows={16}
                  value={rawDescription}
                  onChange={e => setRawDescription(e.target.value)}
                />
                <div className="text-xs text-slate-500 mt-2">
                  Tip: keep headings in this exact format: <span className="font-mono">## Context</span>,{' '}
                  <span className="font-mono">## Checklist</span>, <span className="font-mono">## Links &amp; Access</span>,{' '}
                  <span className="font-mono">## Definition of Done</span>, <span className="font-mono">## Notes</span>.
                </div>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Comments</h2>

            {comments.length === 0 ? (
              <p className="text-sm text-slate-600">No comments yet.</p>
            ) : (
              <div className="space-y-3 mb-6">
                {comments.map(c => (
                  <div key={c.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="text-sm text-slate-600 mb-1">
                      <span className="font-medium text-slate-900">{authorName(c.author_id)}</span>{' '}
                      <span className="text-xs">{formatDateTime(c.created_at)}</span>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <MarkdownBlock content={c.body} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <textarea
                rows={3}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment… (progress update, question, blocker, etc.)"
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">Pro tip: include links + what you need.</div>
                <button
                  onClick={handleAddComment}
                  disabled={saving || !newComment.trim()}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Add comment
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Time</h2>
                <div className="text-sm text-slate-600">Log work for this ticket.</div>
              </div>
              <Link className="text-sm text-blue-700 hover:underline" href="/timesheet">
                Timesheet
              </Link>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Total logged</span>
                <span className="font-medium">{totalLoggedMinutes} min ({(totalLoggedMinutes / 60).toFixed(2)} hr)</span>
              </div>
              {runningEntry && (
                <div className="mt-2 text-xs text-slate-600">
                  Your timer is running: {runningElapsedMinutes} min ({(runningElapsedMinutes / 60).toFixed(2)} hr)
                </div>
              )}
            </div>

            <div className="space-y-2">
              {!runningEntry ? (
                <>
                  <input
                    value={startNote}
                    onChange={e => setStartNote(e.target.value)}
                    placeholder="Optional note (what are you starting?)"
                    disabled={timeSaving}
                  />
                  <button
                    onClick={startTimer}
                    disabled={timeSaving}
                    className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {timeSaving ? 'Starting…' : 'Start timer'}
                  </button>
                </>
              ) : (
                <button
                  onClick={stopTimer}
                  disabled={timeSaving}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {timeSaving ? 'Stopping…' : 'Stop timer'}
                </button>
              )}
            </div>

            <details className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Add manual entry</summary>
              <div className="mt-3 space-y-2">
                <div>
                  <label className="block mb-1">Hours</label>
                  <input
                    value={manualHours}
                    onChange={e => setManualHours(e.target.value)}
                    placeholder="e.g. 1.5"
                    inputMode="decimal"
                    disabled={timeSaving}
                  />
                </div>
                <div>
                  <label className="block mb-1">Note (optional)</label>
                  <input
                    value={manualNote}
                    onChange={e => setManualNote(e.target.value)}
                    placeholder="What did you do?"
                    disabled={timeSaving}
                  />
                </div>
                <button
                  onClick={addManualEntry}
                  disabled={timeSaving}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Add entry
                </button>
              </div>
            </details>

            <details className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Recent entries</summary>
              <div className="mt-3 space-y-2">
                {timeEntries.length === 0 ? (
                  <div className="text-sm text-slate-600">No time logged yet.</div>
                ) : (
                  timeEntries.slice(0, 6).map(e => {
                    const mins = minutesFromEntry(e)
                    const label = e.started_at
                      ? e.ended_at
                        ? `${mins} min • ${formatDateTime(e.started_at)}`
                        : `Running… • ${formatDateTime(e.started_at)}`
                      : `${mins} min • ${formatDateTime(e.created_at)}`

                    const canRemove = me.isAdmin || e.user_id === me.userId

                    return (
                      <div key={e.id} className="rounded-md border border-slate-200 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm text-slate-800">{label}</div>
                            <div className="text-xs text-slate-600 truncate">{e.note || '—'}</div>
                          </div>
                          {canRemove && !(!e.ended_at && e.started_at) && (
                            <button
                              onClick={() => deleteTimeEntry(e.id)}
                              className="text-xs text-red-700 hover:underline"
                              disabled={timeSaving}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
                {timeEntries.length > 6 && (
                  <div className="text-xs text-slate-500">Open Timesheet to see all entries.</div>
                )}
              </div>
            </details>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Details</h2>
            <div className="text-sm text-slate-800 space-y-1">
              <div>
                <span className="text-slate-500">Task type:</span>{' '}
                <span className="font-medium">{ticket.task_type ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Effort:</span>{' '}
                <span className="font-medium">{ticket.estimated_effort ?? '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Assigned to:</span>{' '}
                <span className="font-medium">{authorName(assignedTo || ticket.assigned_to)}</span>
              </div>
              <div>
                <span className="text-slate-500">Created by:</span>{' '}
                <span className="font-medium">{authorName(ticket.created_by)}</span>
              </div>
              <div className="pt-2 text-xs text-slate-500">
                Created: {formatDateTime(ticket.created_at)}
                <br />
                Updated: {formatDateTime(ticket.updated_at)}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Quick Links</h2>

            {client?.website_url ? (
              <a className="block" href={client.website_url} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : (
              <div className="text-sm text-slate-500">Website: —</div>
            )}

            {client?.wp_admin_url ? (
              <a className="block" href={client.wp_admin_url} target="_blank" rel="noreferrer">
                WordPress Admin
              </a>
            ) : (
              <div className="text-sm text-slate-500">WP Admin: —</div>
            )}

            {client?.drive_folder_url ? (
              <a className="block" href={client.drive_folder_url} target="_blank" rel="noreferrer">
                Drive Folder
              </a>
            ) : (
              <div className="text-sm text-slate-500">Drive: —</div>
            )}

            <div className="pt-2">
              <Link className="block text-sm text-blue-700 hover:underline" href="/board">
                Open board
              </Link>
            </div>
          </div>

          {overdue && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              This ticket is overdue. If you’re blocked, set status to <b>blocked</b> and comment what you need.
            </div>
          )}

          {canDelete && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Admin actions</div>
              <div className="text-sm text-slate-600 mt-1">Use Archive for normal cleanup. Delete is permanent.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setTicketConfirm({ type: 'archive' })}
                  disabled={saving}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Archive
                </button>
                <button
                  onClick={() => setTicketConfirm({ type: 'delete' })}
                  disabled={saving}
                  className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
