'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings, LogOut, ChevronUp } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getClient } from '@/lib/supabase/client'

interface UserMenuProps {
  initials: string
  displayName: string
  plan: string
}

export function UserMenu({ initials, displayName, plan }: UserMenuProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = getClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary/20 text-primary text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium truncate">
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {plan} plan
            </p>
          </div>
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive cursor-pointer focus:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
