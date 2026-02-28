'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
}

type Profile = {
  id: string
  full_name: string | null
  role: string
}

export default function ClientsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [meProfile, setMeProfile] = useState<Profile | null>(null)
  const [clients, setClients] = useState<Client[]>([])

  // Form fields
  const [name, setName] = useState('')
  const [serverRegion, setServerRegion] = useState('LA')
  const [priorityTier, setPriorityTier] = useState('standard')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [wpAdminUrl, setWpAdminUrl] = useState('')
  const [driveFolderUrl, setDriveFolderUrl] = useState('')
  const [notes, setNotes] = useState('')

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert(`Failed to load clients: ${error.message}`)
      return
    }

    setClients((data ?? []) as Client[])
  }

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session) {
        router.push('/login')
        return
      }

      // Load my profile to determine role
      const { data: pData, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', session.user.id)
        .single()

      if (pErr || !pData) {
        alert(`Failed to load profile: ${pErr?.message || 'No profile'}`)
        router.push('/login')
        return
      }

      setMeProfile(pData as Profile)

      // If not admin, bounce them out. (They should never use /clients)
      if ((pData as Profile).role !== 'admin') {
        router.push('/tickets')
        return
      }

      await loadClients()
      setLoading(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setName('')
    setServerRegion('LA')
    setPriorityTier('standard')
    setWebsiteUrl('')
    setWpAdminUrl('')
    setDriveFolderUrl('')
    setNotes('')
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Client name is required.')
      return
    }

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

    if (error) {
      alert(`Create client failed: ${error.message}`)
      return
    }

    resetForm()
    await loadClients()
  }

  if (loading) return <div className="p-8">Loading...</div>

  // Extra guard (in case)
  if (!meProfile || meProfile.role !== 'admin') return null

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Clients (Admin)</h1>

      {/* Add Client */}
      <div className="bg-white rounded shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Add Client</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Client Name *</label>
            <input
              className="border p-2 w-full"
              placeholder="e.g. SFK"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Server Region</label>
            <select
              className="border p-2 w-full"
              value={serverRegion}
              onChange={e => setServerRegion(e.target.value)}
            >
              <option value="LA">LA</option>
              <option value="EDGE">EDGE</option>
              <option value="EU">EU</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority Tier</label>
            <select
              className="border p-2 w-full"
              value={priorityTier}
              onChange={e => setPriorityTier(e.target.value)}
            >
              <option value="critical">critical</option>
              <option value="standard">standard</option>
              <option value="passive">passive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Website URL</label>
            <input
              className="border p-2 w-full"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">WordPress Admin URL</label>
            <input
              className="border p-2 w-full"
              placeholder="https://example.com/wp-admin"
              value={wpAdminUrl}
              onChange={e => setWpAdminUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Drive Folder URL</label>
            <input
              className="border p-2 w-full"
              placeholder="https://drive.google.com/..."
              value={driveFolderUrl}
              onChange={e => setDriveFolderUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            className="border p-2 w-full"
            rows={4}
            placeholder="Credentials notes, SOP links, special rules, time windows, etc."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <button
          onClick={handleCreate}
          className="mt-4 bg-black text-white px-4 py-2 rounded"
        >
          Create Client
        </button>
      </div>

      {/* Client List (admin only) */}
      <div className="bg-white rounded shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Client List</h2>

        {clients.length === 0 ? (
          <p>No clients yet.</p>
        ) : (
          <div className="space-y-3">
            {clients.map(c => (
              <div key={c.id} className="border rounded p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-lg">{c.name}</div>
                    <div className="text-sm text-gray-600">
                      {c.server_region} — {c.priority_tier}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 text-sm space-y-1">
                  <div>
                    <span className="text-gray-600">Website:</span>{' '}
                    {c.website_url ? (
                      <a className="underline" href={c.website_url} target="_blank" rel="noreferrer">
                        {c.website_url}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div>
                    <span className="text-gray-600">WP Admin:</span>{' '}
                    {c.wp_admin_url ? (
                      <a className="underline" href={c.wp_admin_url} target="_blank" rel="noreferrer">
                        {c.wp_admin_url}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div>
                    <span className="text-gray-600">Drive:</span>{' '}
                    {c.drive_folder_url ? (
                      <a className="underline" href={c.drive_folder_url} target="_blank" rel="noreferrer">
                        {c.drive_folder_url}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-600">Notes:</span>{' '}
                    <span className="whitespace-pre-wrap">{c.notes || '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}