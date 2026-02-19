import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import {
  LayoutDashboard,
  Wand2,
  Settings,
  Zap,
  ImagePlus,
  Repeat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { UserMenu } from '@/components/dashboard/user-menu'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clean', href: '/clean', icon: Wand2 },
  { name: 'Photo Captions', href: '/captions', icon: ImagePlus },
  { name: 'Face Swap', href: '/faceswap', icon: Repeat },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Auto-downgrade expired plans
  if (
    profile &&
    profile.plan !== 'free' &&
    profile.plan_expires_at &&
    new Date(profile.plan_expires_at) < new Date()
  ) {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const serviceClient = createServiceClient()
    await serviceClient
      .from('profiles')
      .update({ plan: 'free', monthly_quota: 5, quota_used: 0, plan_expires_at: null })
      .eq('id', user.id)
    // Update local profile data
    profile.plan = 'free'
    profile.monthly_quota = 5
    profile.quota_used = 0
    profile.plan_expires_at = null
  }

  const quotaPercentage = profile
    ? ((profile.quota_used || 0) / (profile.monthly_quota || 5)) * 100
    : 0

  const initials =
    (profile?.full_name as string | null)
      ?.split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase() || user.email?.[0].toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/40 bg-card/30 flex flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="p-4 border-b border-border/40">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image
              src="/logo-icon.png"
              alt="Content Cleanse"
              width={36}
              height={36}
              className="w-9 h-9"
            />
            <span className="font-semibold tracking-tight">
              Content<span className="text-primary">Cleanse</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-auto">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        {/* Quota */}
        <div className="p-4 border-t border-border/40">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Monthly Quota</span>
              <span className="text-sm text-muted-foreground">
                {profile?.quota_used || 0}/{profile?.monthly_quota || 5}
              </span>
            </div>
            <Progress value={quotaPercentage} className="h-2" />
            {quotaPercentage >= 80 && (
              <Link href="/pricing" className="block mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Upgrade Plan
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* User menu */}
        <div className="p-4 border-t border-border/40">
          <UserMenu
            initials={initials}
            displayName={profile?.full_name || 'User'}
            plan={profile?.plan || 'free'}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
