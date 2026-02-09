'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Gift,
  Users,
  DollarSign,
  Clock,
  Copy,
  Check,
  Loader2,
  Pencil,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Affiliate, Commission } from '@/lib/supabase/types'

interface AffiliateStats {
  referralCount: number
  totalEarned: number
  pendingPayout: number
}

export function AffiliateSection() {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingCode, setEditingCode] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [savingCode, setSavingCode] = useState(false)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    loadAffiliate()
  }, [])

  const loadAffiliate = async () => {
    try {
      const res = await fetch('/api/affiliate')
      const data = await res.json()
      if (data.affiliate) {
        setAffiliate(data.affiliate)
        setStats(data.stats)
        setNewCode(data.affiliate.code)
        loadCommissions()
      }
    } catch (error) {
      console.error('Failed to load affiliate data:', error)
    }
    setLoading(false)
  }

  const loadCommissions = async () => {
    try {
      const res = await fetch('/api/affiliate/commissions')
      const data = await res.json()
      if (data.commissions) {
        setCommissions(data.commissions)
      }
    } catch (error) {
      console.error('Failed to load commissions:', error)
    }
  }

  const handleJoin = async () => {
    setJoining(true)
    try {
      const res = await fetch('/api/affiliate', { method: 'POST' })
      const data = await res.json()
      if (data.affiliate) {
        setAffiliate(data.affiliate)
        setNewCode(data.affiliate.code)
        setStats({ referralCount: 0, totalEarned: 0, pendingPayout: 0 })
      }
    } catch (error) {
      console.error('Failed to join affiliate program:', error)
    }
    setJoining(false)
  }

  const handleCopyLink = () => {
    if (!affiliate) return
    navigator.clipboard.writeText(`${appUrl}/?ref=${affiliate.code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveCode = async () => {
    setCodeError(null)
    setSavingCode(true)
    try {
      const res = await fetch('/api/affiliate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCodeError(data.error)
      } else {
        setAffiliate(data.affiliate)
        setEditingCode(false)
      }
    } catch (error) {
      setCodeError('Failed to update code')
    }
    setSavingCode(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Not yet an affiliate - show join CTA
  if (!affiliate) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Join Our Affiliate Program
          </CardTitle>
          <CardDescription>
            Earn recurring commissions by referring new users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {[
              { icon: DollarSign, title: '10% Commission', desc: 'Earn 10% on every payment from users you refer' },
              { icon: Gift, title: '10% Discount', desc: 'Your referrals get 10% off their first payment' },
              { icon: Users, title: 'Lifetime Referrals', desc: 'Earn commissions on all future payments' },
            ].map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-4 rounded-xl border border-border/50 bg-secondary/30 text-center"
              >
                <benefit.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                <h4 className="font-semibold text-sm mb-1">{benefit.title}</h4>
                <p className="text-xs text-muted-foreground">{benefit.desc}</p>
              </motion.div>
            ))}
          </div>

          <Button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            {joining ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Gift className="w-4 h-4 mr-2" />
            )}
            Become an Affiliate
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Active affiliate view
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Referrals', value: stats?.referralCount ?? 0, icon: Users, color: 'text-blue-400' },
          { label: 'Total Earned', value: `$${(stats?.totalEarned ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Pending Payout', value: `$${(stats?.pendingPayout ?? 0).toFixed(2)}`, icon: Clock, color: 'text-yellow-400' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color} opacity-50`} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Referral Link */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Your Referral Link</CardTitle>
          <CardDescription>Share this link to earn commissions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={`${appUrl}/?ref=${affiliate.code}`}
              readOnly
              className="bg-secondary/30 font-mono text-sm"
            />
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="shrink-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Code customization */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Affiliate Code:</span>
            {editingCode ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={newCode}
                  onChange={(e) => {
                    setNewCode(e.target.value)
                    setCodeError(null)
                  }}
                  placeholder="your-code"
                  className="bg-secondary/30 h-8 text-sm max-w-[200px]"
                />
                <Button
                  size="sm"
                  onClick={handleSaveCode}
                  disabled={savingCode}
                  className="h-8"
                >
                  {savingCode ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingCode(false)
                    setNewCode(affiliate.code)
                    setCodeError(null)
                  }}
                  className="h-8"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Badge variant="secondary" className="font-mono">{affiliate.code}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingCode(true)}
                  className="h-7 px-2"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
          {codeError && (
            <p className="text-sm text-destructive">{codeError}</p>
          )}
        </CardContent>
      </Card>

      {/* Commission History */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No commissions yet. Share your referral link to start earning!
            </p>
          ) : (
            <div className="space-y-3">
              {commissions.map((commission) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40"
                >
                  <div>
                    <p className="text-sm font-medium">
                      ${Number(commission.amount).toFixed(2)} commission
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(commission.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      commission.status === 'paid'
                        ? 'text-green-500 border-green-500/30'
                        : 'text-yellow-500 border-yellow-500/30'
                    }
                  >
                    {commission.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
