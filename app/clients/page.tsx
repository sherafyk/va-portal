'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/useMe'
import { useToast } from '@/app/components/ui/Toast'
import ConfirmDialog from '@/app/components/ui/ConfirmDialog'
import { formatDateTime } from '@/lib/format'

type Client = {
  id: string
  name: string
  server_region: string
  priority_tier: string
  website_url: string | null
  wp_admin_url: string | null
  drive_folder_url: string | null
  notes: string | null
  created_at: string
  // Optional (recommended) soft-delete flag
  is_active?: boolean
}

export default function ClientsPage() {
  const router = useRouter()
  const toast = useToast()
  const me = useMe()

  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])

  // Form fields
  const [name, setName] = useState('')
  const [serverRegion, setServerRegion] = useState('LA')
  const [priorityTier, setPriorityTier] = useState('standard')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [wpAdminUrl, setWpAdminUrl] = useState('')
  const [driveFolderUrl, setDriveFolderUrl] = useState('')
  const [notes, setNotes] = useState('')

  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<Client | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null)

  const resetForm = () => {
    setName('')
    setServerRegion('LA')
    setPriorityTier('standard')
    setWebsiteUrl('')
    setWpAdminUrl('')
    setDriveFolderUrl('')
    setNotes('')
  }

  const loadClients = async () => {
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

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message, 'Failed to load clients')
      setLoading(false)
      return
    }

    setClients((data ?? []) as Client[])
    setLoading(false)
  }

  useEffect(() => {
    loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.loading, me.userId, me.isAdmin])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter(c => {
      const active = c.is_active !== false
      if (!showInactive && !active) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.server_region || '').toLowerCase().includes(q) ||
        (c.priority_tier || '').toLowerCase().includes(q)
      )
    })
  }, [clients, query, showInactive])

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Client name is required.')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('clients').insert([
      {
        name: name.trim(),
        server_region: serverRegion.trim(),
        priority_tier: priorityTier.trim(),
        website_url: websiteUrl.trim() || null,
        wp_admin_url: wpAdminUrl.trim() || null,
        drive_folder_url: driveFolderUrl.trim() || null,
        notes: notes.trim() || null
      }
    ])

    setSaving(false)

    if (error) {
      toast.error(error.message, 'Create client failed')
      return
    }

    toast.success('Client created')
    resetForm()
    await loadClients()
  }

  const beginEdit = (c: Client) => {
    setEditing(c)
    setName(c.name || '')
    setServerRegion(c.server_region || 'LA')
    setPriorityTier(c.priority_tier || 'standard')
    setWebsiteUrl(c.website_url || '')
    setWpAdminUrl(c.wp_admin_url || '')
    setDriveFolderUrl(c.drive_folder_url || '')
    setNotes(c.notes || '')
  }

  const cancelEdit = () => {
    setEditing(null)
    resetForm()
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!name.trim()) {
      toast.error('Client name is required.')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('clients')
      .update({
        name: name.trim(),
        server_region: serverRegion.trim(),
        priority_tier: priorityTier.trim(),
        website_url: websiteUrl.trim() || null,
        wp_admin_url: wpAdminUrl.trim() || null,
        drive_folder_url: driveFolderUrl.trim() || null,
        notes: notes.trim() || null
      })
      .eq('id', editing.id)

    setSaving(false)

    if (error) {
      toast.error(error.message, 'Update failed')
      return
    }

    toast.success('Client updated')
    setEditing(null)
    resetForm()
    await loadClients()
  }

  const setActive = async (client: Client, isActive: boolean) => {
    setSaving(true)
    const { error } = await supabase
      .from('clients')
      .update({ is_active: isActive })
      .eq('id', client.id)
    setSaving(false)

    if (error) {
      // Very common if column doesn't exist yet.
      toast.error(
        error.message,
        'Soft-archive failed'
      )
      toast.info(
        'Tip: add clients.is_active (boolean) to enable safe archive/unarchive. See SQL instructions in this response.'
      )
      return
    }

    toast.success(isActive ? 'Client re-activated' : 'Client archived')
    await loadClients()
  }

  const deleteClient = async (client: Client) => {
    setSaving(true)
    const { error } = await supabase.from('clients').delete().eq('id', client.id)
    setSaving(false)

    if (error) {
      toast.error(
        error.message,
        'Delete failed'
      )
      toast.info('If this client has tickets, deletion may be blocked by a foreign key. Use Archive instead.')
      return
    }

    toast.success('Client deleted')
    await loadClients()
  }

  if (me.loading || loading) return <div className="text-sm text-slate-600">Loading…</div>
  if (!me.isAdmin) return null

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this client?"
        description={
          confirmDelete
            ? `${confirmDelete.name}\n\nIf this client is referenced by tickets, deletion may fail. Consider archiving instead.`
            : undefined
        }
        confirmText="Delete"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          const c = confirmDelete
          setConfirmDelete(null)
          await deleteClient(c)
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <div className="mt-1 text-sm text-slate-600">Admin-only client metadata.</div>
        </div>
      </div>

      {/* Create / Edit */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-slate-900">
              {editing ? 'Edit client' : 'Add client'}
            </div>
            <div className="text-sm text-slate-600">
              Keep URLs here so templates can auto-inject access links.
            </div>
          </div>

          {editing && (
            <button
              onClick={cancelEdit}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Client Name *</label>
            <input placeholder="e.g. SFK" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">Server Region</label>
            <select value={serverRegion} onChange={e => setServerRegion(e.target.value)}>
              <option value="LA">LA</option>
              <option value="EDGE">EDGE</option>
              <option value="EU">EU</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <div>
            <label className="block mb-1">Priority Tier</label>
            <select value={priorityTier} onChange={e => setPriorityTier(e.target.value)}>
              <option value="critical">critical</option>
              <option value="standard">standard</option>
              <option value="passive">passive</option>
            </select>
          </div>

          <div>
            <label className="block mb-1">Website URL</label>
            <input placeholder="https://example.com" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">WordPress Admin URL</label>
            <input placeholder="https://example.com/wp-admin" value={wpAdminUrl} onChange={e => setWpAdminUrl(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1">Drive Folder URL</label>
            <input placeholder="https://drive.google.com/..." value={driveFolderUrl} onChange={e => setDriveFolderUrl(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <label className="block mb-1">Notes</label>
          <textarea
            rows={4}
            placeholder="Credentials notes, SOP links, special rules, time windows, etc."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={editing ? saveEdit : handleCreate}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {editing ? (saving ? 'Saving…' : 'Save changes') : saving ? 'Creating…' : 'Create client'}
          </button>

          {!editing && (
            <button
              onClick={resetForm}
              disabled={saving}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">Client list</div>
            <div className="text-sm text-slate-600">Click a client to edit. Archive instead of deleting if referenced by tickets.</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <label className="block mb-1">Search</label>
              <input placeholder="Search…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                className="h-4 w-4"
              />
              Show archived
            </label>
          </div>
        </div>

        <div className="mt-4 divide-y">
          {filtered.length === 0 ? (
            <div className="py-6 text-sm text-slate-600">No clients match your search.</div>
          ) : (
            filtered.map(c => {
              const active = c.is_active !== false
              return (
                <div key={c.id} className="py-4 flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-semibold text-slate-900">{c.name}</div>
                        {!active && (
                          <span className="text-xs rounded-full bg-slate-100 px-2 py-1 text-slate-700">Archived</span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600">
                        {c.server_region} • {c.priority_tier}
                        <span className="mx-2">•</span>
                        Created {formatDateTime(c.created_at)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => beginEdit(c)}
                      >
                        Edit
                      </button>

                      <button
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setActive(c, !active)}
                        disabled={saving}
                      >
                        {active ? 'Archive' : 'Unarchive'}
                      </button>

                      <button
                        className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                        onClick={() => setConfirmDelete(c)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Website</div>
                      {c.website_url ? (
                        <a className="break-all" href={c.website_url} target="_blank" rel="noreferrer">
                          {c.website_url}
                        </a>
                      ) : (
                        <div className="text-slate-500">—</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">WP Admin</div>
                      {c.wp_admin_url ? (
                        <a className="break-all" href={c.wp_admin_url} target="_blank" rel="noreferrer">
                          {c.wp_admin_url}
                        </a>
                      ) : (
                        <div className="text-slate-500">—</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Drive</div>
                      {c.drive_folder_url ? (
                        <a className="break-all" href={c.drive_folder_url} target="_blank" rel="noreferrer">
                          {c.drive_folder_url}
                        </a>
                      ) : (
                        <div className="text-slate-500">—</div>
                      )}
                    </div>
                  </div>

                  <div className="text-sm">
                    <div className="text-xs text-slate-500">Notes</div>
                    <div className="whitespace-pre-wrap text-slate-700">{c.notes || '—'}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
