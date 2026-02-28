'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const links = [
  { name: 'Features', href: '#features' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'How It Works', href: '#how-it-works' },
  {
    name: 'Analytics',
    href: '/tracking',
    live: true,
  },
]

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {open && (
        <div className="fixed inset-0 z-40" style={{ top: '64px' }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Menu panel */}
          <div className="relative bg-background border-b border-border/40 animate-in slide-in-from-top-2 duration-200">
            <nav className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors text-sm"
                >
                  {link.live && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                    </span>
                  )}
                  {link.name}
                </Link>
              ))}

              <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-border/40">
                <Link href="/login" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)}>
                  <Button
                    className="w-full bg-gradient-to-r from-primary to-primary/80"
                    size="sm"
                  >
                    Start Free
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
