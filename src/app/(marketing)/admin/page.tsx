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

interface FinancialStats {
  totalRevenue: number
  revenueThisMonth: number
  revenueLast30Days: number
  confirmedCount: number
  totalPaymentsCount: number
  averagePaymentValue: number
  mrr: number
  totalCommissionsPaid: number
}

interface PaymentRow {
  id: string
  user_id: string
  charge_id: string
  plan: string
  amount: number
  currency: string | null
  crypto_currency: string | null
  status: string
  created_at: string
  confirmed_at: string | null
  user_email: string | null
}

interface PaymentsResponse {
  payments: PaymentRow[]
  total: number
  page: number
  totalPages: number
}

interface RevenueByUser {
  user_id: string
  email: string
  totalPaid: number
  paymentCount: number
  plan: string
  planExpiresAt: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────
const planBadgeClass: Record<string, string> = {
  free: 'bg-zinc-700 text-zinc-300',
  pro: 'bg-pink-600/20 text-pink-400 border border-pink-500/30',
  agency: 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30',
}

const statusBadgeClass: Record<string, string> = {
  confirmed: 'bg-green-500/20 text-green-400 border border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  expired: 'bg-zinc-700 text-zinc-300',
}

function formatDate(iso: string | null) {
  if (!iso) return '\u2014'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`
}

// ── Component ──────────────────────────────────────────────────────────
export default function AdminPage() {
  // Auth state
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Tab
  const [activeTab, setActiveTab] = useState<'users' | 'financials'>('users')

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

  // Financial stats
  const [financialStats, setFinancialStats] = useState<FinancialStats | null>(null)
  const [financialStatsLoading, setFinancialStatsLoading] = useState(false)

  // Payments
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [paymentsTotal, setPaymentsTotal] = useState(0)
  const [paymentsPage, setPaymentsPage] = useState(1)
  const [paymentsSearch, setPaymentsSearch] = useState('')
  const [paymentsSearchInput, setPaymentsSearchInput] = useState('')
  const [paymentsStatusFilter, setPaymentsStatusFilter] = useState('all')
  const [paymentsPlanFilter, setPaymentsPlanFilter] = useState('all')
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  // Revenue by user
  const [revenueByUser, setRevenueByUser] = useState<RevenueByUser[]>([])
  const [revenueByUserLoading, setRevenueByUserLoading] = useState(false)
  const [revenueByUserExpanded, setRevenueByUserExpanded] = useState(false)
  const [revenueByUserLoaded, setRevenueByUserLoaded] = useState(false)

  // Track if financials data has been fetched
  const [financialsLoaded, setFinancialsLoaded] = useState(false)

  const pageSize = 20
  const paymentsPageSize = 20

  // ── Check existing session on mount ──────────────────────────────
  const [checking, setChecking] = useState(true)
  useEffect(() => {
    fetch('/api/admin/auth')
      .then(res => res.json())
      .then(data => { if (data.authenticated) setAuthed(true) })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

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

  // ── Fetch financial stats ────────────────────────────────────────
  const fetchFinancialStats = useCallback(async () => {
    setFinancialStatsLoading(true)
    try {
      const res = await fetch('/api/admin/financial-stats')
      if (res.ok) {
        setFinancialStats(await res.json())
      }
    } catch {
      // silent
    }
    setFinancialStatsLoading(false)
  }, [])

  // ── Fetch payments ───────────────────────────────────────────────
  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(paymentsPage), limit: String(paymentsPageSize) })
      if (paymentsSearch) params.set('search', paymentsSearch)
      if (paymentsStatusFilter !== 'all') params.set('status', paymentsStatusFilter)
      if (paymentsPlanFilter !== 'all') params.set('plan', paymentsPlanFilter)
      const res = await fetch(`/api/admin/payments?${params}`)
      if (res.ok) {
        const data: PaymentsResponse = await res.json()
        setPayments(data.payments)
        setPaymentsTotal(data.total)
      }
    } catch {
      // silent
    }
    setPaymentsLoading(false)
  }, [paymentsPage, paymentsSearch, paymentsStatusFilter, paymentsPlanFilter])

  // ── Fetch revenue by user ────────────────────────────────────────
  const fetchRevenueByUser = useCallback(async () => {
    setRevenueByUserLoading(true)
    try {
      const res = await fetch('/api/admin/revenue-by-user')
      if (res.ok) {
        const data = await res.json()
        setRevenueByUser(data.users)
        setRevenueByUserLoaded(true)
      }
    } catch {
      // silent
    }
    setRevenueByUserLoading(false)
  }, [])

  // Load data after auth
  useEffect(() => {
    if (authed) {
      fetchStats()
      fetchUsers()
    }
  }, [authed, fetchStats, fetchUsers])

  // Load financials data when tab switches
  useEffect(() => {
    if (authed && activeTab === 'financials' && !financialsLoaded) {
      fetchFinancialStats()
      fetchPayments()
      setFinancialsLoaded(true)
    }
  }, [authed, activeTab, financialsLoaded, fetchFinancialStats, fetchPayments])

  // Refetch payments when filters/page change (only if financials already loaded)
  useEffect(() => {
    if (financialsLoaded) {
      fetchPayments()
    }
  }, [paymentsPage, paymentsSearch, paymentsStatusFilter, paymentsPlanFilter, fetchPayments, financialsLoaded])

  // Debounced search (users)
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Debounced search (payments)
  useEffect(() => {
    const t = setTimeout(() => {
      setPaymentsSearch(paymentsSearchInput)
      setPaymentsPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [paymentsSearchInput])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [planFilter])

  useEffect(() => {
    setPaymentsPage(1)
  }, [paymentsStatusFilter, paymentsPlanFilter])

  // Expand revenue by user
  const handleExpandRevenue = () => {
    const next = !revenueByUserExpanded
    setRevenueByUserExpanded(next)
    if (next && !revenueByUserLoaded) {
      fetchRevenueByUser()
    }
  }

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
  const paymentsTotalPages = Math.max(1, Math.ceil(paymentsTotal / paymentsPageSize))

  // ── Password gate ────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <div className="text-zinc-500 text-sm">Checking session...</div>
      </div>
    )
  }

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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <p className="text-zinc-400 mt-1">User management and platform stats</p>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-8 border-b border-zinc-800">
        {(['users', 'financials'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors relative ${
              activeTab === tab
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500" />
            )}
          </button>
        ))}
      </div>

      {/* ── Users tab ──────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <>
          {/* Stats cards */}
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

          {/* Filters */}
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

          {/* Users table */}
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

          {/* Pagination */}
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
        </>
      )}

      {/* ── Financials tab ─────────────────────────────────────── */}
      {activeTab === 'financials' && (
        <>
          {/* Financial stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Revenue', value: financialStats?.totalRevenue, color: 'text-green-400', isCurrency: true },
              { label: 'This Month', value: financialStats?.revenueThisMonth, color: 'text-green-300', isCurrency: true },
              { label: 'Last 30 Days', value: financialStats?.revenueLast30Days, color: 'text-cyan-400', isCurrency: true },
              { label: 'Confirmed Payments', value: financialStats?.confirmedCount, color: 'text-white', isCurrency: false },
              { label: 'Avg Payment', value: financialStats?.averagePaymentValue, color: 'text-pink-400', isCurrency: true },
              { label: 'MRR', value: financialStats?.mrr, color: 'text-cyan-400', isCurrency: true },
              { label: 'Commissions Paid', value: financialStats?.totalCommissionsPaid, color: 'text-yellow-400', isCurrency: true },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
              >
                <div className={`text-3xl font-bold ${card.color}`}>
                  {financialStatsLoading ? (
                    <span className="inline-block w-8 h-8 rounded bg-zinc-800 animate-pulse" />
                  ) : card.isCurrency ? (
                    formatCurrency(card.value ?? 0)
                  ) : (
                    (card.value ?? 0)
                  )}
                </div>
                <div className="text-sm text-zinc-500 mt-1">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Payments filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <input
              type="text"
              value={paymentsSearchInput}
              onChange={(e) => setPaymentsSearchInput(e.target.value)}
              placeholder="Search by email..."
              className="w-full sm:w-72 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors text-sm"
            />

            <select
              value={paymentsStatusFilter}
              onChange={(e) => setPaymentsStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-pink-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>

            <select
              value={paymentsPlanFilter}
              onChange={(e) => setPaymentsPlanFilter(e.target.value)}
              className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-pink-500 cursor-pointer"
            >
              <option value="all">All Plans</option>
              <option value="pro">Pro</option>
              <option value="agency">Agency</option>
            </select>

            <span className="text-sm text-zinc-500 ml-auto">
              {paymentsTotal} payment{paymentsTotal !== 1 ? 's' : ''} found
            </span>
          </div>

          {/* Payments table */}
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-400 text-left">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Crypto</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Confirmed At</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-t border-zinc-800/60">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 w-24 rounded bg-zinc-800 animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        No payments found
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr
                        key={p.id}
                        className="border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-zinc-400 text-xs">
                          {formatDate(p.created_at)}
                        </td>
                        <td className="px-4 py-3 text-white font-mono text-xs">
                          {p.user_email || '\u2014'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${planBadgeClass[p.plan] || planBadgeClass.free}`}
                          >
                            {p.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white tabular-nums">
                          {formatCurrency(Number(p.amount))}
                        </td>
                        <td className="px-4 py-3 text-zinc-300 text-xs uppercase">
                          {p.crypto_currency || '\u2014'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadgeClass[p.status] || 'bg-zinc-700 text-zinc-300'}`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-xs">
                          {formatDate(p.confirmed_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments pagination */}
          {paymentsTotalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                disabled={paymentsPage <= 1}
                onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:border-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">
                Page {paymentsPage} of {paymentsTotalPages}
              </span>
              <button
                disabled={paymentsPage >= paymentsTotalPages}
                onClick={() => setPaymentsPage((p) => Math.min(paymentsTotalPages, p + 1))}
                className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:border-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}

          {/* Revenue by user (expandable) */}
          <div className="mt-8">
            <button
              onClick={handleExpandRevenue}
              className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <span
                className={`inline-block transition-transform ${revenueByUserExpanded ? 'rotate-90' : ''}`}
              >
                &#9654;
              </span>
              Revenue by User
              {revenueByUser.length > 0 && (
                <span className="text-zinc-500">({revenueByUser.length})</span>
              )}
            </button>

            {revenueByUserExpanded && (
              <div className="mt-4 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-900/80 text-zinc-400 text-left">
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Total Paid</th>
                        <th className="px-4 py-3 font-medium"># Payments</th>
                        <th className="px-4 py-3 font-medium">Current Plan</th>
                        <th className="px-4 py-3 font-medium">Plan Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByUserLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="border-t border-zinc-800/60">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <td key={j} className="px-4 py-3">
                                <div className="h-4 w-24 rounded bg-zinc-800 animate-pulse" />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : revenueByUser.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                            No paying users found
                          </td>
                        </tr>
                      ) : (
                        revenueByUser.map((u) => (
                          <tr
                            key={u.user_id}
                            className="border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-white font-mono text-xs">{u.email}</td>
                            <td className="px-4 py-3 text-green-400 tabular-nums font-medium">
                              {formatCurrency(u.totalPaid)}
                            </td>
                            <td className="px-4 py-3 text-zinc-300 tabular-nums">{u.paymentCount}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${planBadgeClass[u.plan] || planBadgeClass.free}`}
                              >
                                {u.plan}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-400 text-xs">
                              {formatDate(u.planExpiresAt)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
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
