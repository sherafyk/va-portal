'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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

type Profile = {
  id: string
  full_name: string | null
  role: string
}

const STATUSES = [
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'review',
  'done',
  'archived'
]

const PRIORITIES = ['critical', 'high', 'normal', 'low']

function getSection(md: string, heading: string): string {
  // Extract content under `## Heading` until next `## `
  const re = new RegExp(`(^|\\n)##\\s+${heading}\\s*\\n([\\s\\S]*?)(\\n##\\s+|$)`, 'i')
  const m = md.match(re)
  if (!m) return ''
  return (m[2] || '').trim()
}

function parseChecklist(text: string): string[] {
  // Accept lines starting with "- " or "* "
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const items = lines
    .filter(l => l.startsWith('- ') || l.startsWith('* '))
    .map(l => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)

  // If user didn’t use bullets, treat each non-empty line as an item
  if (items.length === 0) return lines
  return items
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>()
  const ticketId = params.id
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<string | null>(null)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [client, setClient] = useState<Client | null>(null)

  const [comments, setComments] = useState<Comment[]>([])
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({})

  // Editable fields (local state)
  const [status, setStatus] = useState('backlog')
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)

  // Checklist UI-only checkmarks (not persisted)
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  const authorName = useMemo(() => {
    return (id?: string | null) =>
      id && profilesMap[id]?.full_name
        ? profilesMap[id].full_name!
        : id
        ? id.slice(0, 8)
        : 'Unknown'
  }, [profilesMap])

  const sections = useMemo(() => {
    const md = description || ''
    const context = getSection(md, 'Context')
    const checklistText = getSection(md, 'Checklist')
    const linksText = getSection(md, 'Links & Access')
    const dod = getSection(md, 'Definition of Done')
    const notes = getSection(md, 'Notes')

    const checklistItems = parseChecklist(checklistText)

    return { context, checklistText, checklistItems, linksText, dod, notes }
  }, [description])

  const loadEverything = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    if (!session) {
      router.push('/login')
      return
    }
    setMe(session.user.id)

    // Ticket
    const { data: tData, error: tErr } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single()

    if (tErr || !tData) {
      alert(`Failed to load ticket: ${tErr?.message || 'Not found'}`)
      router.push('/tickets')
      return
    }

    const t = tData as Ticket
    setTicket(t)

    setStatus(t.status || 'backlog')
    setPriority(t.priority || 'normal')
    setDueDate(t.due_date || '')
    setDescription(t.description || '')

    // Client (optional)
    if (t.client_id) {
      const { data: cData } = await supabase
        .from('clients')
        .select('id,name,website_url,wp_admin_url,drive_folder_url')
        .eq('id', t.client_id)
        .single()

      if (cData) setClient(cData as Client)
    }

    // Comments
    const { data: cmData, error: cmErr } = await supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (cmErr) {
      alert(`Failed to load comments: ${cmErr.message}`)
    } else {
      setComments((cmData ?? []) as Comment[])
    }

    // Profiles map
    const ids = new Set<string>()
    if (t.assigned_to) ids.add(t.assigned_to)
    if (t.created_by) ids.add(t.created_by)
    ;(cmData ?? []).forEach((c: any) => c.author_id && ids.add(c.author_id))

    if (ids.size > 0) {
      const idList = Array.from(ids)
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', idList)

      const map: Record<string, Profile> = {}
      ;(pData ?? []).forEach((p: any) => (map[p.id] = p))
      setProfilesMap(map)
    }

    // Reset checklist UI checks when reloading ticket
    setChecked({})

    setLoading(false)
  }

  useEffect(() => {
    loadEverything()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const handleSave = async () => {
    if (!ticket) return
    setSaving(true)

    const { error } = await supabase
      .from('tickets')
      .update({
        status,
        priority,
        due_date: dueDate || null,
        description,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticket.id)

    setSaving(false)

    if (error) {
      alert(`Save failed: ${error.message}`)
      return
    }

    await loadEverything()
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setSaving(true)

    const { error } = await supabase.from('ticket_comments').insert([
      {
        ticket_id: ticketId,
        author_id: me,
        body: newComment.trim()
      }
    ])

    setSaving(false)

    if (error) {
      alert(`Comment failed: ${error.message}`)
      return
    }

    setNewComment('')
    await loadEverything()
  }

  const buildCopySummary = () => {
    if (!ticket) return ''

    const lines: string[] = []
    lines.push(`Ticket: ${ticket.title}`)
    lines.push(`Status: ${status} | Priority: ${priority} | Due: ${dueDate || '—'}`)
    lines.push(`Client: ${client?.name ?? '—'}`)
    lines.push(`Assigned To: ${authorName(ticket.assigned_to)}`)
    lines.push('')

    if (sections.linksText) {
      lines.push('Links:')
      lines.push(sections.linksText)
      lines.push('')
    }

    if (sections.context) {
      lines.push('Context:')
      lines.push(sections.context)
      lines.push('')
    }

    if (sections.checklistItems.length > 0) {
      lines.push('Checklist:')
      sections.checklistItems.forEach((it, idx) => {
        const mark = checked[idx] ? '[x]' : '[ ]'
        lines.push(`${mark} ${it}`)
      })
      lines.push('')
    }

    if (sections.dod) {
      lines.push('Definition of Done:')
      lines.push(sections.dod)
      lines.push('')
    }

    if (sections.notes) {
      lines.push('Notes:')
      lines.push(sections.notes)
      lines.push('')
    }

    lines.push(`Link: /tickets/${ticket.id}`)
    return lines.join('\n')
  }

  const handleCopy = async () => {
    const text = buildCopySummary()
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied summary to clipboard.')
    } catch {
      alert('Copy failed (browser blocked clipboard).')
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!ticket) return <div className="p-8">Ticket not found.</div>

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link className="underline text-sm" href="/tickets">
            ← Back to Tickets
          </Link>
          <h1 className="text-3xl font-bold mt-2">{ticket.title}</h1>
          <div className="text-sm text-gray-600 mt-1">
            Ticket ID: <span className="font-mono">{ticket.id}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="border px-4 py-2 rounded hover:bg-gray-50"
          >
            Copy Summary
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded shadow p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  className="border p-2 w-full"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  className="border p-2 w-full"
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <input
                  className="border p-2 w-full"
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Render checklist visually */}
            <div className="border rounded p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Checklist</h2>
                <div className="text-xs text-gray-500">
                  (UI-only checkmarks)
                </div>
              </div>

              {sections.checklistItems.length === 0 ? (
                <div className="text-sm text-gray-600 mt-2">No checklist found.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {sections.checklistItems.map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!!checked[idx]}
                        onChange={e =>
                          setChecked(prev => ({ ...prev, [idx]: e.target.checked }))
                        }
                      />
                      <span className="text-sm">{item}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Raw description editor stays (admin can edit; VA can edit too if you want) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Full Description (Structured Markdown)
              </label>
              <textarea
                className="border p-2 w-full font-mono"
                rows={12}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">
                Tip: Use the structured sections (## Context, ## Checklist, ## Links & Access, ## Definition of Done, ## Notes).
              </div>
            </div>
          </div>

          <div className="bg-white rounded shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Comments</h2>

            {comments.length === 0 ? (
              <p className="text-gray-600">No comments yet.</p>
            ) : (
              <div className="space-y-3 mb-6">
                {comments.map(c => (
                  <div key={c.id} className="border rounded p-3">
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium text-gray-800">
                        {authorName(c.author_id)}
                      </span>{' '}
                      <span className="text-xs">
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap">{c.body}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <textarea
                className="border p-2 w-full"
                rows={3}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment…"
              />
              <button
                onClick={handleAddComment}
                disabled={saving}
                className="border px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded shadow p-6 space-y-2">
            <h2 className="text-lg font-semibold mb-2">Details</h2>
            <div className="text-sm">
              <div>
                <span className="text-gray-600">Client:</span>{' '}
                <span className="font-medium">{client?.name ?? '—'}</span>
              </div>
              <div>
                <span className="text-gray-600">Task type:</span>{' '}
                <span className="font-medium">{ticket.task_type ?? '—'}</span>
              </div>
              <div>
                <span className="text-gray-600">Effort:</span>{' '}
                <span className="font-medium">{ticket.estimated_effort ?? '—'}</span>
              </div>
              <div>
                <span className="text-gray-600">Assigned to:</span>{' '}
                <span className="font-medium">{authorName(ticket.assigned_to)}</span>
              </div>
              <div>
                <span className="text-gray-600">Created by:</span>{' '}
                <span className="font-medium">{authorName(ticket.created_by)}</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Created: {new Date(ticket.created_at).toLocaleString()}
                <br />
                Updated: {new Date(ticket.updated_at).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-white rounded shadow p-6 space-y-2">
            <h2 className="text-lg font-semibold mb-2">Quick Links</h2>

            {client?.website_url ? (
              <a className="block underline" href={client.website_url} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : (
              <div className="text-sm text-gray-500">Website: —</div>
            )}

            {client?.wp_admin_url ? (
              <a className="block underline" href={client.wp_admin_url} target="_blank" rel="noreferrer">
                WordPress Admin
              </a>
            ) : (
              <div className="text-sm text-gray-500">WP Admin: —</div>
            )}

            {client?.drive_folder_url ? (
              <a className="block underline" href={client.drive_folder_url} target="_blank" rel="noreferrer">
                Drive Folder
              </a>
            ) : (
              <div className="text-sm text-gray-500">Drive: —</div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}