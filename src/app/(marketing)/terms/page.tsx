import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Creator Engine',
  description: 'Terms of Service for Creator Engine.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">Last updated: February 22, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_strong]:text-foreground [&_a]:text-primary">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Creator Engine (&quot;Service&quot;), operated by Creator Engine (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Creator Engine is a SaaS platform that provides content uniquification tools including video variant generation, photo caption creation, face swapping, and carousel multiplication. Processing is performed on remote servers and results are delivered digitally.
          </p>

          <h2>3. Accounts</h2>
          <p>
            You must create an account to use the Service. You are responsible for maintaining the security of your account credentials. You must provide accurate information and are responsible for all activity under your account. You must be at least 18 years old to use the Service.
          </p>

          <h2>4. Plans and Payments</h2>
          <p>
            The Service offers Free, Pro, and Agency plans. Paid plans grant 30-day access from the date of payment. Payments are processed via cryptocurrency through our payment provider. All sales are final — no refunds will be issued once payment is confirmed on the blockchain.
          </p>
          <p>
            We reserve the right to change pricing at any time. Price changes will not affect active 30-day access periods already purchased.
          </p>

          <h2>5. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe on the intellectual property rights of others</li>
            <li>Upload or process content that is illegal, harmful, or violates third-party rights</li>
            <li>Attempt to reverse-engineer, exploit, or interfere with the Service</li>
            <li>Use automated systems to abuse the Service beyond normal usage</li>
            <li>Create or distribute deepfake content intended to deceive, harass, or defame</li>
          </ul>

          <h2>6. Content and Ownership</h2>
          <p>
            You retain ownership of all content you upload to and generate through the Service. We do not claim any intellectual property rights over your content. You grant us a limited license to process, store, and deliver your content solely for the purpose of providing the Service.
          </p>
          <p>
            We may delete stored files after 30 days of inactivity or upon account termination.
          </p>

          <h2>7. Quotas and Limits</h2>
          <p>
            Each plan has usage quotas as described on our pricing page. Quotas reset with each new 30-day payment period. Unused quota does not roll over. We reserve the right to enforce rate limits to protect service stability.
          </p>

          <h2>8. Service Availability</h2>
          <p>
            We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable for maintenance, updates, or circumstances beyond our control. We are not liable for any downtime or data loss.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Creator Engine shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the 30 days preceding the claim.
          </p>

          <h2>10. Termination</h2>
          <p>
            We may suspend or terminate your account at any time for violation of these Terms or for any reason at our discretion. Upon termination, your right to use the Service ceases immediately. You may delete your account at any time through account settings.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms. Material changes will be communicated via the email associated with your account.
          </p>

          <h2>12. Contact</h2>
          <p>
            For questions about these Terms, contact us at <strong>support@creatorengine.app</strong>.
          </p>
        </div>
      </div>
    </div>
  )
}
