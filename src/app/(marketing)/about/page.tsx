import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'About | Creator Engine',
  description: 'The story behind Creator Engine — content uniquification at scale.',
}

export default function AboutPage() {
  return (
    <div className="pt-24 pb-16 max-w-3xl mx-auto px-6">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <Image
            src="/logo-icon.png"
            alt="Creator Engine"
            width={48}
            height={48}
            className="w-12 h-12"
          />
          <h1 className="text-4xl font-bold tracking-tight">
            About Creator<span className="text-primary">Engine</span>
          </h1>
        </div>
        <div className="h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="space-y-8 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">What We Do</h2>
          <p>
            Creator Engine is a content uniquification platform built for creators, agencies, and
            marketers who need to produce unique variants of their content at scale. Upload once,
            get dozens of unique versions — each different enough to stand on its own across
            platforms and ad accounts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">The Problem</h2>
          <p>
            Platforms penalize duplicate content. Posting the same video or image across multiple
            accounts, ad sets, or channels leads to suppressed reach, flagged creatives, and
            wasted ad spend. Manually creating variants is tedious and doesn&apos;t scale.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Our Solution</h2>
          <p>
            We automate the uniquification process. Our engine applies subtle but meaningful
            transformations — color shifts, audio adjustments, metadata changes, visual
            modifications — to produce variants that are each technically unique while preserving
            your original creative intent.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Built For</h2>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">&#x2022;</span>
              <span><strong className="text-foreground">Media buyers</strong> running the same creative across multiple ad accounts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">&#x2022;</span>
              <span><strong className="text-foreground">Content creators</strong> repurposing content across platforms</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">&#x2022;</span>
              <span><strong className="text-foreground">Agencies</strong> managing multiple client accounts with shared assets</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">&#x2022;</span>
              <span><strong className="text-foreground">UGC creators</strong> who need face swap and caption variations at scale</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Get In Touch</h2>
          <p>
            Have questions, feedback, or want to partner with us? Reach out on our{' '}
            <a
              href="https://t.me/CreatorEngine"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Telegram channel
            </a>
            .
          </p>
        </section>
      </div>

      {/* CTA */}
      <div className="mt-16 p-8 rounded-2xl border border-border/60 bg-card/30 text-center">
        <h3 className="text-lg font-semibold text-foreground mb-2">Ready to get started?</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Start with 5 free videos. No credit card required.
        </p>
        <Link
          href="/signup"
          className="inline-block px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white text-sm font-medium transition-all"
        >
          Start Free
        </Link>
      </div>
    </div>
  )
}
