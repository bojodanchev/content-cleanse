'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  CreditCard,
  Bell,
  Shield,
  Loader2,
  Check,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { getClient } from '@/lib/supabase/client'
import { PLANS } from '@/lib/stripe/plans'
import type { Profile } from '@/lib/supabase/types'

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fullName, setFullName] = useState('')

  const supabase = getClient()

  useEffect(() => {
    loadProfile()
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

  const handleManageBilling = async () => {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'portal' }),
    })

    const { url } = await response.json()
    if (url) window.location.href = url
  }

  const handleUpgrade = async (planId: string) => {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    })

    const { url } = await response.json()
    if (url) window.location.href = url
  }

  const currentPlan = PLANS.find((p) => p.id === profile?.plan) || PLANS[0]

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
                Manage your subscription and billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-xl border border-primary/30 bg-primary/5 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{currentPlan.name}</h3>
                      {currentPlan.popular && (
                        <Badge className="bg-primary">Active</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      ${currentPlan.price}/month
                    </p>
                  </div>
                </div>
                {profile?.stripe_customer_id && (
                  <Button variant="outline" onClick={handleManageBilling}>
                    Manage Billing
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                )}
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

          {profile?.plan !== 'agency' && (
            <Card className="bg-card/50 border-border/50 mt-6">
              <CardHeader>
                <CardTitle>Upgrade Plan</CardTitle>
                <CardDescription>
                  Get more power with a higher tier
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
                        className="w-full"
                        variant={plan.popular ? 'default' : 'outline'}
                      >
                        Upgrade to {plan.name}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
                <p className="text-xs text-muted-foreground">
                  Resets on {profile?.quota_reset_at
                    ? new Date(profile.quota_reset_at).toLocaleDateString()
                    : 'the 1st of next month'}
                </p>
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
      </Tabs>
    </div>
  )
}
