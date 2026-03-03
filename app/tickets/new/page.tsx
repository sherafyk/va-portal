'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMe } from '@/lib/useMe'
import { useToast } from '@/app/components/ui/Toast'

type Client = {
  id: string
  name: string
  website_url: string | null
  wp_admin_url: string | null
  drive_folder_url: string | null
}

type Profile = { id: string; full_name: string | null; role: string | null }

type TemplateVar = {
  key: string
  label: string
  placeholder?: string
  required?: boolean
}

type TemplateRow = {
  id: string
  name: string
  category: string
  client_id: string | null
  defaults: any
  content: any
  is_active: boolean
  updated_at: string
}

const STATUSES = ['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'archived']
const PRIORITIES = ['critical', 'high', 'normal', 'low']
const TASK_TYPES = ['wp', 'research', 'data', 'admin', 'monitoring', 'other']
const EFFORTS = ['S', 'M', 'L', 'XL']

function safe(v: any) {
  return v === null || v === undefined || v === '' ? '—' : String(v)
}

function renderAllPlaceholders(input: string, client: Client | null, vars: Record<string, string>): string {
  const map: Record<string, string> = {
    'client.name': safe(client?.name),
    'client.website_url': safe(client?.website_url),
    'client.wp_admin_url': safe(client?.wp_admin_url),
    'client.drive_folder_url': safe(client?.drive_folder_url)
  }

  // Replace {{client.*}} and unknown placeholders left as-is
  let out = input.replace(/{{\s*client\.([^}]+)\s*}}/g, (_, key) => {
    const k = `client.${String(key).trim()}`
    return map[k] ?? `{{${k}}}`
  })

  // Replace {{var.*}}
  out = out.replace(/{{\s*var\.([^}]+)\s*}}/g, (_, key) => {
    const k = String(key).trim()
    return safe(vars[k])
  })

  return out
}

export default function NewTicketPage() {
  const router = useRouter()
  const toast = useToast()
  const me = useMe()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [clients, setClients] = useState<Client[]>([])
  const [assignees, setAssignees] = useState<Profile[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])

  const [clientId, setClientId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')

  const [templateId, setTemplateId] = useState<string>('')

  const [title, setTitle] = useState('')
  const [taskType, setTaskType] = useState('wp')
  const [priority, setPriority] = useState('normal')
  const [status, setStatus] = useState('backlog')
  const [dueDate, setDueDate] = useState('')
  const [effort, setEffort] = useState('M')

  // Structured fields (base, before rendering)
  const [context, setContext] = useState('')
  const [checklist, setChecklist] = useState('')
  const [links, setLinks] = useState('')
  const [definitionOfDone, setDefinitionOfDone] = useState('')
  const [notes, setNotes] = useState('')

  // Variables input state
  const [vars, setVars] = useState<Record<string, string>>({})

  const selectedClient = useMemo(
    () => clients.find(c => c.id === clientId) || null,
    [clients, clientId]
  )

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === templateId) || null,
    [templates, templateId]
  )

  const templateVars: TemplateVar[] = useMemo(() => {
    const v = selectedTemplate?.content?.variables
    return Array.isArray(v) ? (v as TemplateVar[]) : []
  }, [selectedTemplate])

  const clientTemplates = useMemo(
    () => templates.filter(t => !!clientId && t.client_id === clientId && t.is_active),
    [templates, clientId]
  )
  const globalTemplates = useMemo(
    () => templates.filter(t => t.client_id === null && t.is_active),
    [templates]
  )

  const loadAll = async () => {
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

    setAssignedTo(me.userId)

    const [cRes, pRes, tRes] = await Promise.all([
      supabase.from('clients').select('id,name,website_url,wp_admin_url,drive_folder_url').order('name', { ascending: true }),
      supabase.from('profiles').select('id,full_name,role').order('full_name', { ascending: true }),
      supabase
        .from('ticket_templates')
        .select('id,name,category,client_id,defaults,content,is_active,updated_at')
        .order('updated_at', { ascending: false })
    ])

    if (cRes.error) toast.error(cRes.error.message, 'Failed to load clients')
    setClients((cRes.data ?? []) as Client[])

    if (pRes.error) toast.error(pRes.error.message, 'Failed to load assignees')
    setAssignees((pRes.data ?? []) as Profile[])

    if (tRes.error) toast.error(tRes.error.message, 'Failed to load templates')
    setTemplates((tRes.data ?? []) as TemplateRow[])

    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loading, me.userId, me.isAdmin])

  // When a template is selected, apply defaults + content and initialize vars
  useEffect(() => {
    if (!selectedTemplate) {
      setVars({})
      return
    }

    const d = selectedTemplate.defaults || {}
    if (d.taskType) setTaskType(d.taskType)
    if (d.priority) setPriority(d.priority)
    if (d.status) setStatus(d.status)
    if (d.effort) setEffort(d.effort)

    const c = selectedTemplate.content || {}
    if (c.context !== undefined) setContext(c.context || '')
    if (c.checklist !== undefined) setChecklist(c.checklist || '')
    if (c.definitionOfDone !== undefined) setDefinitionOfDone(c.definitionOfDone || '')
    if (c.notes !== undefined) setNotes(c.notes || '')

    // init vars with empty values (keep existing if same keys)
    const v: TemplateVar[] = Array.isArray(c.variables) ? c.variables : []
    setVars(prev => {
      const next: Record<string, string> = { ...prev }
      // remove old keys not present
      const keys = new Set(v.map(x => (x.key || '').trim()).filter(Boolean))
      Object.keys(next).forEach(k => {
        if (!keys.has(k)) delete next[k]
      })
      // add any missing keys
      v.forEach(x => {
        const k = (x.key || '').trim()
        if (!k) return
        if (next[k] === undefined) next[k] = ''
      })
      return next
    })
  }, [selectedTemplate])

  // Build links whenever client/template/vars change
  useEffect(() => {
    if (!selectedClient) return

    const linksHintRaw =
      (selectedTemplate?.content?.linksHint as string | undefined) ||
      'Website: {{client.website_url}}\nWP Admin: {{client.wp_admin_url}}\nDrive: {{client.drive_folder_url}}\nOther: '

    const rendered = renderAllPlaceholders(linksHintRaw, selectedClient, vars)

    // Preserve any manual edits under Other:
    const current = links || ''
    const otherIdx = current.toLowerCase().indexOf('other:')
    let preservedOther = ''
    if (otherIdx >= 0) {
      preservedOther = current.slice(otherIdx + 'other:'.length).trimStart()
    }

    let nextLinks = rendered
    if (!/other:/i.test(nextLinks)) nextLinks += '\nOther: '

    if (preservedOther) {
      nextLinks = nextLinks.replace(/Other:\s*$/i, `Other: ${preservedOther}`)
    }

    setLinks(nextLinks)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, templateId, JSON.stringify(vars)])

  const renderedFields = useMemo(() => {
    if (!selectedClient) {
      return {
        contextR: context,
        checklistR: checklist,
        linksR: links,
        dodR: definitionOfDone,
        notesR: notes
      }
    }
    return {
      contextR: renderAllPlaceholders(context || '', selectedClient, vars),
      checklistR: renderAllPlaceholders(checklist || '', selectedClient, vars),
      linksR: links, // already rendered via effect
      dodR: renderAllPlaceholders(definitionOfDone || '', selectedClient, vars),
      notesR: renderAllPlaceholders(notes || '', selectedClient, vars)
    }
  }, [selectedClient, context, checklist, links, definitionOfDone, notes, vars])

  const buildDescription = () => {
    return [
      `## Context`,
      (renderedFields.contextR || '').trim() || '—',
      ``,
      `## Checklist`,
      (renderedFields.checklistR || '').trim() || '—',
      ``,
      `## Links & Access`,
      (renderedFields.linksR || '').trim() || '—',
      ``,
      `## Definition of Done`,
      (renderedFields.dodR || '').trim() || '—',
      ``,
      `## Notes`,
      (renderedFields.notesR || '').trim() || '—'
    ].join('\n')
  }

  const validateRequiredVars = () => {
    for (const v of templateVars) {
      const key = (v.key || '').trim()
      if (!key) continue
      if (v.required && !String(vars[key] || '').trim()) {
        toast.error(`Missing required field: ${v.label || key}`)
        return false
      }
    }
    return true
  }

  const handleCreate = async () => {
    if (!clientId) {
      toast.error('Client is required.')
      return
    }
    if (!title.trim()) {
      toast.error('Title is required.')
      return
    }
    if (templateId && !validateRequiredVars()) return

    // DoD required
    if (!renderedFields.dodR.trim()) {
      toast.error('Definition of Done is required (prevents unclear tickets).')
      return
    }

    setSaving(true)

    const description = buildDescription()

    const { error } = await supabase.from('tickets').insert([
      {
        client_id: clientId,
        title: title.trim(),
        description,
        task_type: taskType,
        priority,
        status,
        due_date: dueDate || null,
        estimated_effort: effort,
        created_by: me.userId,
        assigned_to: assignedTo || me.userId
      }
    ])

    setSaving(false)

    if (error) {
      toast.error(error.message, 'Create ticket failed')
      return
    }

    toast.success('Ticket created')
    router.push('/tickets')
  }

  if (me.loading || loading) return <div className="text-sm text-slate-600">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/tickets" className="text-sm text-blue-700 hover:underline">
            ← Back to Tickets
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-2">Create Ticket</h1>
          <div className="text-sm text-slate-600 mt-1">Admin-only: create structured, high-clarity tasks.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          {/* Client + Assignee */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Client *</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">Select client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1">Assigned To</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                {assignees.map(a => (
                  <option key={a.id} value={a.id}>
                    {(a.full_name ?? 'User')} {a.role ? `(${a.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Template */}
          <div>
            <label className="block mb-1">Template</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}>
              <option value="">No template</option>

              {clientId && clientTemplates.length > 0 && (
                <optgroup label="Client templates">
                  {clientTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </optgroup>
              )}

              {globalTemplates.length > 0 && (
                <optgroup label="Global templates">
                  {globalTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="text-xs text-slate-500 mt-1">
              Tip: templates can include placeholders like <span className="font-mono">{'{{client.website_url}}'}</span> and{' '}
              <span className="font-mono">{'{{var.topic}}'}</span>.
            </div>
          </div>

          {/* Variables section */}
          {templateId && templateVars.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="font-semibold text-slate-900">Template Inputs</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templateVars.map(v => {
                  const key = (v.key || '').trim()
                  if (!key) return null
                  const required = !!v.required
                  return (
                    <div key={key}>
                      <label className="block mb-1">
                        {v.label || key} {required ? '*' : ''}
                      </label>
                      <input
                        value={vars[key] ?? ''}
                        onChange={e => setVars(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={v.placeholder || ''}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="text-xs text-slate-500">
                Required fields must be filled before creating the ticket.
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block mb-1">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Clear, specific task title" />
          </div>

          {/* Meta */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block mb-1">Task Type</label>
              <select value={taskType} onChange={e => setTaskType(e.target.value)}>
                {TASK_TYPES.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                {STATUSES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1">Due</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>

            <div>
              <label className="block mb-1">Effort</label>
              <select value={effort} onChange={e => setEffort(e.target.value)}>
                {EFFORTS.map(x => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Structured fields */}
          <div>
            <label className="block mb-1">Context</label>
            <textarea rows={3} value={context} onChange={e => setContext(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">Checklist</label>
            <textarea className="font-mono" rows={6} value={checklist} onChange={e => setChecklist(e.target.value)} placeholder="- Step 1\n- Step 2\n- Step 3" />
          </div>

          <div>
            <label className="block mb-1">Links & Access</label>
            <textarea className="font-mono" rows={5} value={links} onChange={e => setLinks(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">Definition of Done *</label>
            <textarea rows={3} value={definitionOfDone} onChange={e => setDefinitionOfDone(e.target.value)} placeholder="What does success look like?" />
          </div>

          <div>
            <label className="block mb-1">Notes</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {saving ? 'Creating…' : 'Create Ticket'}
            </button>

            <button
              onClick={() => router.push('/tickets')}
              disabled={saving}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Preview sidebar */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900">Preview</div>
              <div className="text-sm text-slate-600">What will be saved to the ticket.</div>
            </div>
          </div>

          <pre className="whitespace-pre-wrap text-sm text-slate-800 rounded-lg border border-slate-200 bg-slate-50 p-4 overflow-auto max-h-[70vh]">
            {buildDescription()}
          </pre>
        </div>
      </div>
    </div>
  )
}
