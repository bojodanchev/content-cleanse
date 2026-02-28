'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { UserMenu } from '@/components/dashboard/user-menu'

interface MobileNavProps {
  navigation: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[]
  quotaUsed: number
  monthlyQuota: number
  quotaPercentage: number
  initials: string
  displayName: string
  plan: string
}

export function MobileNav({
  navigation,
  quotaUsed,
  monthlyQuota,
  quotaPercentage,
  initials,
  displayName,
  plan,
}: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close drawer on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      {/* Top bar - mobile only */}
      <div className="fixed top-0 left-0 right-0 z-40 h-14 bg-card/95 backdrop-blur border-b border-border/40 flex items-center justify-between px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/logo-icon.png"
            alt="Creator Engine"
            width={28}
            height={28}
            className="w-7 h-7"
          />
          <span className="font-semibold tracking-tight text-sm">
            Creator<span className="text-primary">Engine</span>
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Overlay + Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Drawer panel */}
          <div className="absolute inset-y-0 left-0 w-64 bg-card border-r border-border/40 flex flex-col animate-in slide-in-from-left duration-200">
            {/* Drawer header */}
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <Image
                  src="/logo-icon.png"
                  alt="Creator Engine"
                  width={36}
                  height={36}
                  className="w-9 h-9"
                />
                <span className="font-semibold tracking-tight">
                  Creator<span className="text-primary">Engine</span>
                </span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
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
                    {quotaUsed}/{monthlyQuota}
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
                displayName={displayName}
                plan={plan}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
