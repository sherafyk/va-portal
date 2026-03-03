'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/lib/useMe'
import { useToast } from '@/app/components/ui/Toast'
import ConfirmDialog from '@/app/components/ui/ConfirmDialog'

type Client = { id: string; name: string }

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
  const toast = useToast()
  const me = useMe()

  const [loading, setLoading] = useState(true)

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

  // variables
  const [variables, setVariables] = useState<TemplateVar[]>([])

  // list filters
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<TemplateRow | null>(null)

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

    const [cRes, tRes] = await Promise.all([
      supabase.from('clients').select('id,name').order('name', { ascending: true }),
      supabase.from('ticket_templates').select('*').order('updated_at', { ascending: false })
    ])

    if (cRes.error) toast.error(cRes.error.message, 'Failed to load clients')
    setClients((cRes.data ?? []) as Client[])

    if (tRes.error) {
      toast.error(tRes.error.message, 'Failed to load templates')
      setTemplates([])
    } else {
      setTemplates((tRes.data ?? []) as TemplateRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loading, me.userId, me.isAdmin])

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
    setVariables(prev => [...prev, { key: '', label: '', placeholder: '', required: false }])
  }

  const updateVar = (idx: number, patch: Partial<TemplateVar>) => {
    setVariables(prev => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  const removeVar = (idx: number) => {
    setVariables(prev => prev.filter((_, i) => i !== idx))
  }

  const saveTemplate = async () => {
    if (!name.trim()) {
      toast.error('Template name is required.')
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
        toast.error(`Duplicate variable key: ${v.key}`)
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
      content: {
        context,
        checklist,
        linksHint,
        definitionOfDone,
        notes,
        variables: cleanVars
      }
    }

    let errMsg: string | null = null

    if (editingId) {
      const { error } = await supabase.from('ticket_templates').update(payload).eq('id', editingId)
      if (error) errMsg = error.message
    } else {
      const { error } = await supabase.from('ticket_templates').insert([payload])
      if (error) errMsg = error.message
    }

    if (errMsg) {
      toast.error(errMsg, 'Save failed')
      return
    }

    toast.success(editingId ? 'Template updated' : 'Template created')
    resetForm()
    await loadAll()
  }

  const toggleTemplateActive = async (t: TemplateRow) => {
    const { error } = await supabase
      .from('ticket_templates')
      .update({ is_active: !t.is_active })
      .eq('id', t.id)

    if (error) {
      toast.error(error.message, 'Update failed')
      return
    }

    toast.success(t.is_active ? 'Template deactivated' : 'Template activated')
    await loadAll()
  }

  const deleteTemplate = async (t: TemplateRow) => {
    const { error } = await supabase.from('ticket_templates').delete().eq('id', t.id)
    if (error) {
      toast.error(error.message, 'Delete failed')
      return
    }

    toast.success('Template deleted')
    await loadAll()
  }

  const duplicateTemplate = async (t: TemplateRow) => {
    const payload = {
      name: `${t.name} (copy)`,
      category: t.category,
      client_id: t.client_id,
      is_active: false,
      defaults: t.defaults,
      content: t.content
    }

    const { error } = await supabase.from('ticket_templates').insert([payload])
    if (error) {
      toast.error(error.message, 'Duplicate failed')
      return
    }

    toast.success('Template duplicated (inactive)')
    await loadAll()
  }

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return templates.filter(t => {
      if (!showInactive && !t.is_active) return false
      if (!q) return true
      return (
        (t.name || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        clientName(t.client_id).toLowerCase().includes(q)
      )
    })
  }, [templates, query, showInactive, clientName])

  if (me.loading || loading) return <div className="text-sm text-slate-600">Loading…</div>
  if (!me.isAdmin) return null

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete template permanently?"
        description={
          confirmDelete
            ? `${confirmDelete.name}\n\nThis cannot be undone.`
            : undefined
        }
        confirmText="Delete"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          const t = confirmDelete
          setConfirmDelete(null)
          await deleteTemplate(t)
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Templates</h1>
          <div className="mt-1 text-sm text-slate-600">
            Repeatable task recipes for fast, consistent ticket creation.
          </div>
        </div>

        <button
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          onClick={loadAll}
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              {editingId ? 'Edit template' : 'Create template'}
            </h2>
            {editingId && (
              <button className="text-sm text-blue-700 hover:underline" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>

          <div>
            <label className="block mb-1">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. WP plugin update" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1">Client</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">Global</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4" />
                Active
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="font-semibold text-slate-900">Defaults</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Task Type</label>
                <input value={taskType} onChange={e => setTaskType(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Priority</label>
                <input value={priority} onChange={e => setPriority(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Status</label>
                <input value={status} onChange={e => setStatus(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Effort</label>
                <input value={effort} onChange={e => setEffort(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Variables */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-900">Variables</div>
              <button className="text-sm text-blue-700 hover:underline" onClick={addVar}>
                + Add variable
              </button>
            </div>

            {variables.length === 0 ? (
              <div className="text-sm text-slate-600">
                No variables. Add variables to collect inputs like topic, output link, citation style, etc.
              </div>
            ) : (
              <div className="space-y-3">
                {variables.map((v, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Key</label>
                        <input
                          className="font-mono"
                          value={v.key}
                          onChange={e => updateVar(idx, { key: e.target.value })}
                          placeholder="topic"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Label</label>
                        <input
                          value={v.label}
                          onChange={e => updateVar(idx, { label: e.target.value })}
                          placeholder="Topic"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-600 mb-1">Placeholder</label>
                        <input
                          value={v.placeholder || ''}
                          onChange={e => updateVar(idx, { placeholder: e.target.value })}
                          placeholder="e.g. Bunker fuel price trends Q1"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!v.required}
                          onChange={e => updateVar(idx, { required: e.target.checked })}
                          className="h-4 w-4"
                        />
                        Required
                      </label>
                      <button
                        className="text-sm text-red-700 hover:underline"
                        onClick={() => removeVar(idx)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="text-xs text-slate-500 mt-2">
                      Use in content as <span className="font-mono">{`{{var.${(v.key || 'key').trim()}}}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block mb-1">Context</label>
            <textarea rows={3} value={context} onChange={e => setContext(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">Checklist</label>
            <textarea className="font-mono" rows={6} value={checklist} onChange={e => setChecklist(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">Links Hint</label>
            <textarea className="font-mono" rows={5} value={linksHint} onChange={e => setLinksHint(e.target.value)} />
            <div className="text-xs text-slate-500 mt-1">
              Supports placeholders like <span className="font-mono">{'{{client.website_url}}'}</span> and{' '}
              <span className="font-mono">{'{{var.output}}'}</span>.
            </div>
          </div>

          <div>
            <label className="block mb-1">Definition of Done</label>
            <textarea rows={3} value={definitionOfDone} onChange={e => setDefinitionOfDone(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">Notes</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={saveTemplate}
          >
            {editingId ? 'Update template' : 'Create template'}
          </button>
        </div>

        {/* List */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Templates</h2>
              <div className="text-sm text-slate-600">Search, edit, duplicate, deactivate.</div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-64">
                <label className="block mb-1">Search</label>
                <input placeholder="Name, category, client…" value={query} onChange={e => setQuery(e.target.value)} />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={e => setShowInactive(e.target.checked)}
                  className="h-4 w-4"
                />
                Show inactive
              </label>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {filteredTemplates.length === 0 ? (
              <div className="text-sm text-slate-600">No templates found.</div>
            ) : (
              filteredTemplates.map(t => (
                <div key={t.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-slate-900">{t.name}</div>
                        {!t.is_active && (
                          <span className="text-xs rounded-full bg-slate-100 px-2 py-1 text-slate-700">Inactive</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600">
                        {t.category} • {clientName(t.client_id)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Vars: {t.content?.variables?.length ?? 0}</div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <button className="text-sm text-blue-700 hover:underline" onClick={() => startEdit(t)}>
                        Edit
                      </button>
                      <button className="text-sm text-blue-700 hover:underline" onClick={() => duplicateTemplate(t)}>
                        Duplicate
                      </button>
                      <button className="text-sm text-blue-700 hover:underline" onClick={() => toggleTemplateActive(t)}>
                        {t.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="text-sm text-red-700 hover:underline" onClick={() => setConfirmDelete(t)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 mt-2">Updated: {new Date(t.updated_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
