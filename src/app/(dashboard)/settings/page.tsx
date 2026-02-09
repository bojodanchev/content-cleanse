'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User,
  CreditCard,
  Bell,
  Shield,
  Loader2,
  Check,
  Clock,
  AlertTriangle,
  Gift,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { getClient } from '@/lib/supabase/client'
import { PLANS } from '@/lib/crypto/plans'
import type { Profile, Payment } from '@/lib/supabase/types'
import { AffiliateSection } from '@/components/dashboard/affiliate-section'

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fullName, setFullName] = useState('')
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const supabase = getClient()
  const router = useRouter()

  useEffect(() => {
    loadProfile()
    loadPayments()
  }, [])

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data as Profile)
      setFullName((data as Profile).full_name || '')
    }
    setLoading(false)
  }

  const loadPayments = async () => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) setPayments(data as Payment[])
  }

  const handleSaveProfile = async () => {
    if (!profile) return

    setSaving(true)
    await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })

      const { url, error } = await response.json()
      if (url) {
        window.location.href = url
      } else {
        console.error('Checkout error:', error)
      }
    } catch (error) {
      console.error('Checkout error:', error)
    }
    setUpgrading(null)
  }

  const currentPlan = PLANS.find((p) => p.id === profile?.plan) || PLANS[0]

  const isExpired =
    profile?.plan !== 'free' &&
    profile?.plan_expires_at &&
    new Date(profile.plan_expires_at) < new Date()

  const isExpiringSoon =
    profile?.plan !== 'free' &&
    profile?.plan_expires_at &&
    !isExpired &&
    new Date(profile.plan_expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-secondary/30 border border-border/50">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="affiliate" className="gap-2">
            <Gift className="w-4 h-4" />
            Affiliate
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile?.email || ''}
                  disabled
                  className="bg-secondary/30"
                />
                <p className="text-xs text-muted-foreground">
                  Contact support to change your email
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-gradient-to-r from-primary to-primary/80"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : saved ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : null}
                  {saved ? 'Saved!' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 mt-6">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <div>
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Manage your subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Plan expiry warning */}
              {isExpired && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 mb-6">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">Plan expired</p>
                    <p className="text-sm text-muted-foreground">
                      Your {currentPlan.name} plan has expired. Renew to restore access.
                    </p>
                  </div>
                  <Button
                    onClick={() => handleUpgrade(profile!.plan)}
                    disabled={upgrading !== null}
                    size="sm"
                  >
                    {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Renew Now'}
                  </Button>
                </div>
              )}

              {isExpiringSoon && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 mb-6">
                  <Clock className="w-5 h-5 text-yellow-500 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-500">Plan expiring soon</p>
                    <p className="text-sm text-muted-foreground">
                      Expires {new Date(profile!.plan_expires_at!).toLocaleDateString()}. Renew to keep your access.
                    </p>
                  </div>
                  <Button
                    onClick={() => handleUpgrade(profile!.plan)}
                    disabled={upgrading !== null}
                    size="sm"
                    variant="outline"
                  >
                    {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Renew'}
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-xl border border-primary/30 bg-primary/5 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{currentPlan.name}</h3>
                      <Badge className={isExpired ? 'bg-destructive' : 'bg-primary'}>
                        {isExpired ? 'Expired' : 'Active'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {currentPlan.price === 0
                        ? 'Free forever'
                        : `$${currentPlan.price}/month • Crypto payments`}
                    </p>
                    {profile?.plan_expires_at && profile.plan !== 'free' && !isExpired && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Expires {new Date(profile.plan_expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Your Plan Includes:</h4>
                <ul className="space-y-2">
                  {currentPlan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade options */}
          {profile?.plan !== 'agency' && (
            <Card className="bg-card/50 border-border/50 mt-6">
              <CardHeader>
                <CardTitle>Upgrade Plan</CardTitle>
                <CardDescription>
                  Pay with crypto for 30 days of access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {PLANS.filter(
                    (p) =>
                      p.id !== 'free' &&
                      p.id !== profile?.plan &&
                      PLANS.findIndex((x) => x.id === p.id) >
                        PLANS.findIndex((x) => x.id === profile?.plan)
                  ).map((plan) => (
                    <div
                      key={plan.id}
                      className="p-4 rounded-xl border border-border/50 bg-secondary/30"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold">{plan.name}</h4>
                        <span className="text-lg font-bold">
                          ${plan.price}/mo
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        {plan.description}
                      </p>
                      <Button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgrading !== null}
                        className="w-full"
                        variant={plan.popular ? 'default' : 'outline'}
                      >
                        {upgrading === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Upgrade to {plan.name}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment history */}
          <Card className="bg-card/50 border-border/50 mt-6">
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No payments yet
                </p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {payment.plan} Plan
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.created_at).toLocaleDateString()}
                          {payment.crypto_currency && ` • ${payment.crypto_currency}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${payment.amount}</p>
                        <Badge
                          variant="outline"
                          className={
                            payment.status === 'confirmed'
                              ? 'text-green-500 border-green-500/30'
                              : payment.status === 'failed'
                              ? 'text-destructive border-destructive/30'
                              : 'text-yellow-500 border-yellow-500/30'
                          }
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage */}
          <Card className="bg-card/50 border-border/50 mt-6">
            <CardHeader>
              <CardTitle>Usage This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Videos Processed</span>
                  <span className="font-medium">
                    {profile?.quota_used} / {profile?.monthly_quota}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    style={{
                      width: `${
                        ((profile?.quota_used || 0) / (profile?.monthly_quota || 1)) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose what you want to be notified about
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  title: 'Processing Complete',
                  description: 'Get notified when your videos finish processing',
                  enabled: true,
                },
                {
                  title: 'Quota Warnings',
                  description: 'Alert when approaching monthly quota limit',
                  enabled: true,
                },
                {
                  title: 'Plan Expiry Reminder',
                  description: 'Reminder before your plan expires',
                  enabled: true,
                },
                {
                  title: 'Product Updates',
                  description: 'News about new features and improvements',
                  enabled: false,
                },
              ].map((notification, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.description}
                    </p>
                  </div>
                  <button
                    className={`w-12 h-6 rounded-full transition-colors ${
                      notification.enabled
                        ? 'bg-primary'
                        : 'bg-secondary'
                    } relative`}
                  >
                    <motion.div
                      animate={{ x: notification.enabled ? 24 : 4 }}
                      className="w-4 h-4 rounded-full bg-white absolute top-1"
                    />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Affiliate Tab */}
        <TabsContent value="affiliate">
          <AffiliateSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
