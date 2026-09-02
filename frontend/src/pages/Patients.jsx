import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import client from '../api/client.js'
import { PageHeader, EmptyState } from '../components/ui.jsx'

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client
      .get('/patients')
      .then((res) => setPatients(res.data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = patients.filter((p) =>
    `${p.full_name} ${p.email}`.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <PageHeader title="Patients" subtitle="All patients registered on the platform." />

      <div className="mb-4 flex items-center gap-2 rounded border border-line bg-surface px-3 py-2">
        <Search size={16} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {loading && <div className="readout-label">Loading patients…</div>}

      {!loading && filtered.length === 0 && (
        <EmptyState
          title="No patients yet"
          description="Patients will appear here once they register or an admin adds them."
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper/60">
              <tr>
                <th className="px-4 py-3 font-medium text-muted">Name</th>
                <th className="px-4 py-3 font-medium text-muted">Email</th>
                <th className="px-4 py-3 font-medium text-muted">Blood group</th>
                <th className="px-4 py-3 font-medium text-muted">Allergies</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-pulse-dim">
                  <td className="px-4 py-3">
                    <Link to={`/patients/${p.id}`} className="font-medium text-ink hover:text-pulse-dark">
                      {p.full_name || 'Unnamed patient'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{p.email}</td>
                  <td className="px-4 py-3">{p.blood_group || '—'}</td>
                  <td className="px-4 py-3">{p.allergies || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
