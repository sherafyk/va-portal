'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Client = {
  id: string
  name: string
  website_url: string | null
  wp_admin_url: string | null
  drive_folder_url: string | null
}

type Profile = { id: string; full_name: string | null; role: string }

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

  const [loading, setLoading] = useState(true)

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
    () => templates.filter(t => !!clientId && t.client_id === clientId),
    [templates, clientId]
  )
  const globalTemplates = useMemo(
    () => templates.filter(t => t.client_id === null),
    [templates]
  )

  const loadAll = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    if (!session) {
      router.push('/login')
      return
    }

    // Admin-only
    const { data: myProfile, error: myErr } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', session.user.id)
      .single()

    if (myErr || !myProfile) {
      alert(`Failed to load profile: ${myErr?.message || 'No profile'}`)
      router.push('/tickets')
      return
    }
    if ((myProfile as Profile).role !== 'admin') {
      router.push('/my-work')
      return
    }

    setAssignedTo(session.user.id)

    const { data: cData, error: cErr } = await supabase
      .from('clients')
      .select('id,name,website_url,wp_admin_url,drive_folder_url')
      .order('name', { ascending: true })

    if (cErr) {
      alert(`Failed to load clients: ${cErr.message}`)
      setLoading(false)
      return
    }
    setClients((cData ?? []) as Client[])

    const { data: pData, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name', { ascending: true })

    if (pErr) {
      alert(`Failed to load assignees: ${pErr.message}`)
      setLoading(false)
      return
    }
    setAssignees((pData ?? []) as Profile[])

    const { data: tData, error: tErr } = await supabase
      .from('ticket_templates')
      .select('id,name,category,client_id,defaults,content,is_active,updated_at')
      .order('updated_at', { ascending: false })

    if (tErr) {
      alert(`Failed to load templates: ${tErr.message}`)
      setLoading(false)
      return
    }
    setTemplates((tData ?? []) as TemplateRow[])

    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        alert(`Missing required field: ${v.label || key}`)
        return false
      }
    }
    return true
  }

  const handleCreate = async () => {
    if (!clientId) {
      alert('Client is required.')
      return
    }
    if (!title.trim()) {
      alert('Title is required.')
      return
    }
    if (templateId && !validateRequiredVars()) return

    // DoD required (after rendering still must be present)
    if (!renderedFields.dodR.trim()) {
      alert('Definition of Done is required (prevents unclear tickets).')
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user.id

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
        created_by: userId,
        assigned_to: assignedTo || userId
      }
    ])

    if (error) {
      alert(`Create ticket failed: ${error.message}`)
      return
    }

    router.push('/tickets')
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Create Ticket (Admin)</h1>

      <div className="bg-white rounded shadow p-6 space-y-4 max-w-3xl">
        {/* Client + Assignee */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Client *</label>
            <select className="border p-2 w-full" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">Select client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Assigned To</label>
            <select className="border p-2 w-full" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              {assignees.map(a => (
                <option key={a.id} value={a.id}>
                  {(a.full_name ?? 'User')} ({a.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Template */}
        <div>
          <label className="block text-sm font-medium mb-1">Template</label>
          <select className="border p-2 w-full" value={templateId} onChange={e => setTemplateId(e.target.value)}>
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
        </div>

        {/* NEW: Variables section */}
        {templateId && templateVars.length > 0 && (
          <div className="border rounded p-4 bg-gray-50 space-y-3">
            <div className="font-semibold">Template Inputs</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templateVars.map(v => {
                const key = (v.key || '').trim()
                if (!key) return null
                const required = !!v.required
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-1">
                      {v.label || key} {required ? '*' : ''}
                    </label>
                    <input
                      className="border p-2 w-full"
                      value={vars[key] ?? ''}
                      onChange={e => setVars(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={v.placeholder || ''}
                    />
                  </div>
                )
              })}
            </div>
            <div className="text-xs text-gray-500">
              Use placeholders in templates like <span className="font-mono">{'{{var.topic}}'}</span>.
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input className="border p-2 w-full" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        {/* Meta */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Task Type</label>
            <select className="border p-2 w-full" value={taskType} onChange={e => setTaskType(e.target.value)}>
              {TASK_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select className="border p-2 w-full" value={priority} onChange={e => setPriority(e.target.value)}>
              {PRIORITIES.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="border p-2 w-full" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Due</label>
            <input className="border p-2 w-full" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Effort</label>
            <select className="border p-2 w-full" value={effort} onChange={e => setEffort(e.target.value)}>
              {EFFORTS.map(x => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Structured fields (base text that can include placeholders) */}
        <div>
          <label className="block text-sm font-medium mb-1">Context</label>
          <textarea className="border p-2 w-full" rows={3} value={context} onChange={e => setContext(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Checklist</label>
          <textarea className="border p-2 w-full font-mono" rows={6} value={checklist} onChange={e => setChecklist(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Links & Access</label>
          <textarea className="border p-2 w-full font-mono" rows={5} value={links} onChange={e => setLinks(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Definition of Done *</label>
          <textarea className="border p-2 w-full" rows={3} value={definitionOfDone} onChange={e => setDefinitionOfDone(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea className="border p-2 w-full" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* Preview */}
        <details className="border rounded p-4 bg-gray-50">
          <summary className="cursor-pointer font-semibold">Preview (what will be saved)</summary>
          <pre className="whitespace-pre-wrap text-sm mt-3">{buildDescription()}</pre>
        </details>

        <div className="flex items-center justify-between gap-3">
          <button onClick={handleCreate} className="bg-black text-white px-4 py-2 rounded">
            Create Ticket
          </button>

          <button onClick={() => router.push('/tickets')} className="border px-4 py-2 rounded">
            Cancel
          </button>
        </div>
      </div>
    </main>
  )
}