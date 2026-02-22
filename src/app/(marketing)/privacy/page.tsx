import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Creator Engine',
  description: 'Privacy Policy for Creator Engine.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: February 22, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-muted-foreground [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_strong]:text-foreground [&_a]:text-primary">
          <h2>1. Introduction</h2>
          <p>
            Creator Engine (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our platform at creatorengine.app (&quot;Service&quot;).
          </p>

          <h2>2. Information We Collect</h2>
          <p><strong>Account information:</strong> When you create an account, we collect your name, email address, and password (stored as a secure hash).</p>
          <p><strong>Uploaded content:</strong> Photos, videos, and face images you upload for processing. These are stored temporarily to deliver the Service.</p>
          <p><strong>Payment information:</strong> Cryptocurrency transaction identifiers. We do not collect or store credit card numbers or bank account details.</p>
          <p><strong>Usage data:</strong> Job history, quota usage, plan information, and feature usage to operate and improve the Service.</p>
          <p><strong>Technical data:</strong> IP address, browser type, and device information collected automatically through server logs.</p>

          <h2>3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide and operate the Service (processing jobs, delivering outputs)</li>
            <li>To manage your account and enforce plan limits</li>
            <li>To process payments and maintain transaction records</li>
            <li>To communicate with you about your account and service updates</li>
            <li>To detect and prevent fraud or abuse</li>
            <li>To improve the Service based on aggregate usage patterns</li>
          </ul>

          <h2>4. Data Storage and Processing</h2>
          <p>
            Your data is stored on servers provided by Supabase (database and authentication) and processed on Modal.com (serverless compute). Uploaded files are stored in Supabase Storage with row-level security — only you can access your files.
          </p>
          <p>
            Processed output files are available for download and may be automatically deleted after 30 days of inactivity.
          </p>

          <h2>5. Data Sharing</h2>
          <p>We do not sell your personal information. We share data only with:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Service providers:</strong> Supabase (storage/auth), Modal.com (processing), Vercel (hosting), NOWPayments (payment processing) — solely to operate the Service</li>
            <li><strong>Legal requirements:</strong> When required by law, court order, or governmental authority</li>
          </ul>

          <h2>6. AI and Face Data</h2>
          <p>
            If you use our face swap feature, you upload face images that are processed using machine learning models. Face data is used exclusively for the processing you request and is stored only while the associated face profile exists. You can delete your saved faces at any time through the app, and all associated data will be permanently removed.
          </p>
          <p>
            We do not use your uploaded images or face data to train machine learning models.
          </p>

          <h2>7. Cookies and Local Storage</h2>
          <p>
            We use essential cookies and browser storage for authentication sessions and application state. We do not use third-party tracking cookies or advertising pixels.
          </p>

          <h2>8. Data Security</h2>
          <p>
            We implement industry-standard security measures including encrypted connections (HTTPS/TLS), row-level security on all database tables, secure password hashing, and isolated processing environments. However, no system is 100% secure and we cannot guarantee absolute security.
          </p>

          <h2>9. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Export your data in a standard format</li>
            <li>Withdraw consent for optional data processing</li>
          </ul>
          <p>
            To exercise these rights, contact us at <strong>support@creatorengine.app</strong>.
          </p>

          <h2>10. Data Retention</h2>
          <p>
            Account data is retained while your account is active. Upon account deletion, we remove your personal data within 30 days, except where retention is required by law. Processed files may be deleted sooner based on storage policies.
          </p>

          <h2>11. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for users under 18. We do not knowingly collect information from minors. If we learn that we have collected data from a minor, we will promptly delete it.
          </p>

          <h2>12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated via the email on your account. Continued use of the Service after changes constitutes acceptance.
          </p>

          <h2>13. Contact</h2>
          <p>
            For privacy-related questions or requests, contact us at <strong>support@creatorengine.app</strong>.
          </p>
        </div>
      </div>
    </div>
  )
}
