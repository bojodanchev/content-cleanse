import Link from 'next/link'
import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background grid-pattern noise-overlay flex flex-col">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 p-6">
        <Link href="/" className="flex items-center gap-2.5 w-fit">
          <Image
            src="/logo-icon.png"
            alt="Creator Engine"
            width={36}
            height={36}
            className="w-9 h-9"
          />
          <span className="font-semibold text-lg tracking-tight">
            Creator<span className="text-primary">Engine</span>
          </span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>

      {/* Decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top right glow */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        {/* Bottom left glow */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      </div>
    </div>
  )
}
