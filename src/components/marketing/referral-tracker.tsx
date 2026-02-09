'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export function ReferralTracker() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      document.cookie = `ref_code=${encodeURIComponent(ref)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`
    }
  }, [searchParams])

  return null
}
