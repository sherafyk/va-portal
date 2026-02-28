'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Client = { id: string; name: string }
type Profile = { id: string; role: string; full_name: string | null }

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
  created_at: string
  updated_at: string
}

const CATEGORIES = ['general', 'research', 'wp', 'data', 'admin', 'monitoring', 'other']

export default function TemplatesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const [me, setMe] = useState<Profile | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])

  // form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('general')
  const [clientId, setClientId] = useState<string>('') // empty = global
  const [isActive, setIsActive] = useState(true)

  // defaults fields
  const [taskType, setTaskType] = useState('other')
  const [priority, setPriority] = useState('normal')
  const [status, setStatus] = useState('backlog')
  const [effort, setEffort] = useState('M')

  // content fields
  const [context, setContext] = useState('')
  const [checklist, setChecklist] = useState('')
  const [linksHint, setLinksHint] = useState(
    'Website: {{client.website_url}}\nWP Admin: {{client.wp_admin_url}}\nDrive: {{client.drive_folder_url}}\nOther: '
  )
  const [definitionOfDone, setDefinitionOfDone] = useState('')
  const [notes, setNotes] = useState('')

  // NEW: variables
  const [variables, setVariables] = useState<TemplateVar[]>([])

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setCategory('general')
    setClientId('')
    setIsActive(true)
    setTaskType('other')
    setPriority('normal')
    setStatus('backlog')
    setEffort('M')
    setContext('')
    setChecklist('')
    setLinksHint(
      'Website: {{client.website_url}}\nWP Admin: {{client.wp_admin_url}}\nDrive: {{client.drive_folder_url}}\nOther: '
    )
    setDefinitionOfDone('')
    setNotes('')
    setVariables([])
  }

  const loadAll = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    if (!session) {
      router.push('/login')
      return
    }

    const { data: pData, error: pErr } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', session.user.id)
      .single()

    if (pErr || !pData) {
      alert(`Failed to load profile: ${pErr?.message || 'No profile'}`)
      router.push('/login')
      return
    }

    if (pData.role !== 'admin') {
      router.push('/my-work')
      return
    }
    setMe(pData as Profile)

    const { data: cData, error: cErr } = await supabase
      .from('clients')
      .select('id,name')
      .order('name', { ascending: true })

    if (cErr) alert(`Failed to load clients: ${cErr.message}`)
    setClients((cData ?? []) as Client[])

    const { data: tData, error: tErr } = await supabase
      .from('ticket_templates')
      .select('*')
      .order('updated_at', { ascending: false })

    if (tErr) {
      alert(`Failed to load templates: ${tErr.message}`)
    } else {
      setTemplates((tData ?? []) as TemplateRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clientName = useMemo(() => {
    const map: Record<string, string> = {}
    clients.forEach(c => (map[c.id] = c.name))
    return (id: string | null) => (id ? map[id] || id : 'Global')
  }, [clients])

  const startEdit = (t: TemplateRow) => {
    setEditingId(t.id)
    setName(t.name || '')
    setCategory(t.category || 'general')
    setClientId(t.client_id || '')
    setIsActive(!!t.is_active)

    const d = t.defaults || {}
    setTaskType(d.taskType || 'other')
    setPriority(d.priority || 'normal')
    setStatus(d.status || 'backlog')
    setEffort(d.effort || 'M')

    const c = t.content || {}
    setContext(c.context || '')
    setChecklist(c.checklist || '')
    setLinksHint(
      c.linksHint ||
        'Website: {{client.website_url}}\nWP Admin: {{client.wp_admin_url}}\nDrive: {{client.drive_folder_url}}\nOther: '
    )
    setDefinitionOfDone(c.definitionOfDone || '')
    setNotes(c.notes || '')
    setVariables((c.variables ?? []) as TemplateVar[])
  }

  const addVar = () => {
    setVariables(prev => [
      ...prev,
      { key: '', label: '', placeholder: '', required: false }
    ])
  }

  const updateVar = (idx: number, patch: Partial<TemplateVar>) => {
    setVariables(prev => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  const removeVar = (idx: number) => {
    setVariables(prev => prev.filter((_, i) => i !== idx))
  }

  const saveTemplate = async () => {
    if (!name.trim()) {
      alert('Template name is required.')
      return
    }

    // basic var validation
    const cleanVars = variables
      .map(v => ({
        key: (v.key || '').trim(),
        label: (v.label || '').trim(),
        placeholder: (v.placeholder || '').trim(),
        required: !!v.required
      }))
      .filter(v => v.key && v.label)

    const dup = new Set<string>()
    for (const v of cleanVars) {
      if (dup.has(v.key)) {
        alert(`Duplicate variable key: ${v.key}`)
        return
      }
      dup.add(v.key)
    }

    const payload = {
      name: name.trim(),
      category,
      client_id: clientId || null,
      is_active: isActive,
      defaults: { taskType, priority, status, effort },
      content: { context, checklist, linksHint, definitionOfDone, notes, variables: cleanVars }
    }

    let errMsg: string | null = null

    if (editingId) {
      const { error } = await supabase
        .from('ticket_templates')
        .update(payload)
        .eq('id', editingId)
      if (error) errMsg = error.message
    } else {
      const { error } = await supabase.from('ticket_templates').insert([payload])
      if (error) errMsg = error.message
    }

    if (errMsg) {
      alert(`Save failed: ${errMsg}`)
      return
    }

    resetForm()
    await loadAll()
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!me || me.role !== 'admin') return null

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Templates (Admin)</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded shadow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingId ? 'Edit Template' : 'Create Template'}
            </h2>
            {editingId && (
              <button className="underline text-sm" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input className="border p-2 w-full" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select className="border p-2 w-full" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Client</label>
              <select className="border p-2 w-full" value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">Global</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <span className="text-sm">Active</span>
            </div>
          </div>

          <div className="border rounded p-4 bg-gray-50 space-y-3">
            <div className="font-semibold">Defaults</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Task Type</label>
                <input className="border p-2 w-full" value={taskType} onChange={e => setTaskType(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Priority</label>
                <input className="border p-2 w-full" value={priority} onChange={e => setPriority(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Status</label>
                <input className="border p-2 w-full" value={status} onChange={e => setStatus(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Effort</label>
                <input className="border p-2 w-full" value={effort} onChange={e => setEffort(e.target.value)} />
              </div>
            </div>
          </div>

          {/* NEW: Variables */}
          <div className="border rounded p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Variables</div>
              <button className="underline text-sm" onClick={addVar}>
                + Add variable
              </button>
            </div>

            {variables.length === 0 ? (
              <div className="text-sm text-gray-600">
                No variables. Add variables to collect inputs like topic, output link, citation style, etc.
              </div>
            ) : (
              <div className="space-y-3">
                {variables.map((v, idx) => (
                  <div key={idx} className="border rounded p-3 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Key</label>
                        <input
                          className="border p-2 w-full font-mono"
                          value={v.key}
                          onChange={e => updateVar(idx, { key: e.target.value })}
                          placeholder="topic"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Label</label>
                        <input
                          className="border p-2 w-full"
                          value={v.label}
                          onChange={e => updateVar(idx, { label: e.target.value })}
                          placeholder="Topic"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Placeholder</label>
                        <input
                          className="border p-2 w-full"
                          value={v.placeholder || ''}
                          onChange={e => updateVar(idx, { placeholder: e.target.value })}
                          placeholder="e.g. Bunker fuel price trends Q1"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!v.required}
                          onChange={e => updateVar(idx, { required: e.target.checked })}
                        />
                        Required
                      </label>
                      <button className="underline text-sm text-red-600" onClick={() => removeVar(idx)}>
                        Remove
                      </button>
                    </div>

                    <div className="text-xs text-gray-500 mt-2">
                      Use in content as <span className="font-mono">{`{{var.${(v.key || 'key').trim()}}}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Context</label>
            <textarea className="border p-2 w-full" rows={3} value={context} onChange={e => setContext(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Checklist</label>
            <textarea className="border p-2 w-full font-mono" rows={6} value={checklist} onChange={e => setChecklist(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Links Hint</label>
            <textarea className="border p-2 w-full font-mono" rows={5} value={linksHint} onChange={e => setLinksHint(e.target.value)} />
            <div className="text-xs text-gray-500 mt-1">
              Supports placeholders like <span className="font-mono">{'{{client.website_url}}'}</span> and <span className="font-mono">{'{{var.output}}'}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Definition of Done</label>
            <textarea className="border p-2 w-full" rows={3} value={definitionOfDone} onChange={e => setDefinitionOfDone(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea className="border p-2 w-full" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button className="bg-black text-white px-4 py-2 rounded" onClick={saveTemplate}>
            {editingId ? 'Update Template' : 'Create Template'}
          </button>
        </div>

        {/* List */}
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Active Templates</h2>
          {templates.length === 0 ? (
            <div className="text-gray-600">No templates yet.</div>
          ) : (
            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className="border rounded p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-sm text-gray-600">
                        {t.category} • {clientName(t.client_id)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Vars: {(t.content?.variables?.length ?? 0)}
                      </div>
                    </div>
                    <button className="underline text-sm" onClick={() => startEdit(t)}>
                      Edit
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Updated: {new Date(t.updated_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}