'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────
interface Stats {
  total: number
  free: number
  pro: number
  agency: number
  activeLastWeek: number
}

interface UserRow {
  id: string
  email: string
  full_name: string | null
  telegram_handle: string | null
  plan: string
  plan_expires_at: string | null
  quota_used: number
  monthly_quota: number
  created_at: string
}

interface UsersResponse {
  users: UserRow[]
  total: number
  page: number
  totalPages: number
}

// ── Helpers ────────────────────────────────────────────────────────────
const planBadgeClass: Record<string, string> = {
  free: 'bg-zinc-700 text-zinc-300',
  pro: 'bg-pink-600/20 text-pink-400 border border-pink-500/30',
  agency: 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30',
}

function formatDate(iso: string | null) {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Component ──────────────────────────────────────────────────────────
export default function AdminPage() {
  // Auth state
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Stats
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Users
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [usersLoading, setUsersLoading] = useState(false)

  // Edit modal
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editPlan, setEditPlan] = useState('free')
  const [editQuotaUsed, setEditQuotaUsed] = useState(0)
  const [editMonthlyQuota, setEditMonthlyQuota] = useState(5)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const pageSize = 20

  // ── Auth ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setAuthed(true)
      } else {
        const data = await res.json()
        setAuthError(data.error || 'Invalid password')
      }
    } catch {
      setAuthError('Network error')
    }
    setAuthLoading(false)
  }

  // ── Fetch stats ──────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) {
        setStats(await res.json())
      }
    } catch {
      // silent
    }
    setStatsLoading(false)
  }, [])

  // ── Fetch users ──────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (search) params.set('search', search)
      if (planFilter !== 'all') params.set('plan', planFilter)
      const res = await fetch(`/api/admin/users?${params}`)
      if (res.ok) {
        const data: UsersResponse = await res.json()
        setUsers(data.users)
        setTotal(data.total)
      }
    } catch {
      // silent
    }
    setUsersLoading(false)
  }, [page, search, planFilter])

  // Load data after auth
  useEffect(() => {
    if (authed) {
      fetchStats()
      fetchUsers()
    }
  }, [authed, fetchStats, fetchUsers])

  // Debounced search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [planFilter])

  // ── Edit modal ───────────────────────────────────────────────────
  const openEdit = (u: UserRow) => {
    setEditUser(u)
    setEditPlan(u.plan)
    setEditQuotaUsed(u.quota_used)
    setEditMonthlyQuota(u.monthly_quota)
    setEditError('')
  }

  const handleSaveEdit = async () => {
    if (!editUser) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editPlan !== editUser.plan
            ? { plan: editPlan }
            : { quota_used: editQuotaUsed, monthly_quota: editMonthlyQuota }
        ),
      })
      if (res.ok) {
        setEditUser(null)
        fetchUsers()
        fetchStats()
      } else {
        const data = await res.json()
        setEditError(data.error || 'Failed to save')
      }
    } catch {
      setEditError('Network error')
    }
    setEditSaving(false)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // ── Password gate ────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm mx-auto p-8 rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur"
        >
          <h1 className="text-2xl font-bold mb-1 text-white">Admin Panel</h1>
          <p className="text-zinc-400 text-sm mb-6">Enter the admin password to continue.</p>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {authError}
            </div>
          )}

          <label className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors"
            placeholder="Enter password"
          />

          <button
            type="submit"
            disabled={authLoading || !password}
            className="mt-4 w-full py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            {authLoading ? 'Verifying...' : 'Enter'}
          </button>
        </form>
      </div>
    )
  }

  // ── Main panel ───────────────────────────────────────────────────
  return (
    <div className="pt-24 pb-16 max-w-7xl mx-auto px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <p className="text-zinc-400 mt-1">User management and platform stats</p>
      </div>

      {/* ── Stats cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Users', value: stats?.total, color: 'text-white' },
          { label: 'Free', value: stats?.free, color: 'text-zinc-400' },
          { label: 'Pro', value: stats?.pro, color: 'text-pink-400' },
          { label: 'Agency', value: stats?.agency, color: 'text-cyan-400' },
          { label: 'Active (7d)', value: stats?.activeLastWeek, color: 'text-green-400' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
          >
            <div className={`text-3xl font-bold ${card.color}`}>
              {statsLoading ? (
                <span className="inline-block w-8 h-8 rounded bg-zinc-800 animate-pulse" />
              ) : (
                (card.value ?? 0)
              )}
            </div>
            <div className="text-sm text-zinc-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search email or name..."
          className="w-full sm:w-72 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors text-sm"
        />

        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-pink-500 cursor-pointer"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="agency">Agency</option>
        </select>

        <span className="text-sm text-zinc-500 ml-auto">
          {total} user{total !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* ── Users table ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900/80 text-zinc-400 text-left">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Full Name</th>
                <th className="px-4 py-3 font-medium">Telegram</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Quota</th>
                <th className="px-4 py-3 font-medium">Signed Up</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-zinc-800/60">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-zinc-800 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-zinc-300">{u.full_name || '\u2014'}</td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">
                      {u.telegram_handle ? (
                        <a
                          href={`https://t.me/${u.telegram_handle.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline"
                        >
                          @{u.telegram_handle.replace('@', '')}
                        </a>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${planBadgeClass[u.plan] || planBadgeClass.free}`}
                      >
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {formatDate(u.plan_expires_at)}
                    </td>
                    <td className="px-4 py-3 text-zinc-300 tabular-nums">
                      {u.quota_used}/{u.monthly_quota}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(u)}
                        className="px-3 py-1 rounded-md text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-pink-500 hover:text-pink-400 transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:border-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:border-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* ── Edit modal ──────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-lg font-bold text-white mb-1">Edit User</h2>
            <p className="text-sm text-zinc-400 mb-6 font-mono">{editUser.email}</p>

            {editError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              {/* Plan */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Plan</label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-pink-500 cursor-pointer"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="agency">Agency</option>
                </select>
              </div>

              {/* Quota Used */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Quota Used
                </label>
                <input
                  type="number"
                  min={0}
                  value={editQuotaUsed}
                  onChange={(e) => setEditQuotaUsed(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Monthly Quota */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Monthly Quota
                </label>
                <input
                  type="number"
                  min={1}
                  value={editMonthlyQuota}
                  onChange={(e) => setEditMonthlyQuota(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setEditUser(null)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-5 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
