import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy - Legendary Fyre Records',
  description: 'Privacy Policy for Legendary Fyre Records Dashboard',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-red-500 hover:text-red-400 text-sm mb-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-slate-400">Last updated: January 29, 2025</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p className="text-slate-300 leading-relaxed">
              Legendary Fyre Records ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our dashboard and services. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.1 Personal Information</h3>
            <p className="text-slate-300 leading-relaxed mb-4">
              We may collect personal information that you provide to us, including:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Name, email address, and contact information</li>
              <li>Username and password credentials</li>
              <li>Artist name, stage name, and professional information</li>
              <li>Phone number and other contact details</li>
              <li>IPI (Interested Party Information) numbers</li>
              <li>Payment and financial information (if applicable)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.2 Usage Data</h3>
            <p className="text-slate-300 leading-relaxed mb-4">
              We automatically collect information about how you interact with the Service, including:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Log data (IP address, browser type, access times, pages viewed)</li>
              <li>Device information (device type, operating system, unique device identifiers)</li>
              <li>Usage patterns and preferences</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.3 Content Data</h3>
            <p className="text-slate-300 leading-relaxed mb-4">
              We collect content you upload or create through the Service, including:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Music files, audio recordings, and related metadata</li>
              <li>Release information, song titles, and catalog data</li>
              <li>Contract documents and legal files</li>
              <li>Task lists, notes, and project information</li>
              <li>Social media metrics and analytics data</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.4 Third-Party Integrations</h3>
            <p className="text-slate-300 leading-relaxed">
              When you connect third-party services (such as Instagram, Spotify, or other platforms), we may collect:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Access tokens and authentication credentials</li>
              <li>Account IDs and profile information</li>
              <li>Metrics and analytics data from connected platforms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              We use the information we collect for various purposes, including:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>To provide, maintain, and improve the Service</li>
              <li>To process your requests and manage your account</li>
              <li>To communicate with you about your account, releases, and services</li>
              <li>To analyze usage patterns and improve user experience</li>
              <li>To detect, prevent, and address technical issues and security threats</li>
              <li>To comply with legal obligations and enforce our agreements</li>
              <li>To provide customer support and respond to inquiries</li>
              <li>To generate analytics reports and business insights</li>
              <li>To facilitate collaboration between artists, managers, and label staff</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Data Storage and Security</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.1 Storage Location</h3>
            <p className="text-slate-300 leading-relaxed">
              Your data is stored on secure servers. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.2 Security Measures</h3>
            <p className="text-slate-300 leading-relaxed mb-4">
              We employ various security measures to protect your information:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Encryption of sensitive data in transit and at rest</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Limited access to personal information on a need-to-know basis</li>
              <li>Secure backup and disaster recovery procedures</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">4.3 Data Retention</h3>
            <p className="text-slate-300 leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, we will securely delete or anonymize it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Information Sharing and Disclosure</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.1 Internal Sharing</h3>
            <p className="text-slate-300 leading-relaxed">
              We may share your information within Legendary Fyre Records with authorized personnel, including managers, administrators, and staff members who need access to perform their duties related to your account and services.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.2 Service Providers</h3>
            <p className="text-slate-300 leading-relaxed mb-4">
              We may share your information with third-party service providers who perform services on our behalf, such as:
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Cloud hosting and storage providers</li>
              <li>Payment processors</li>
              <li>Analytics and data analysis services</li>
              <li>Email and communication services</li>
              <li>AI and machine learning service providers</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.3 Legal Requirements</h3>
            <p className="text-slate-300 leading-relaxed">
              We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or a government agency).
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">5.4 Business Transfers</h3>
            <p className="text-slate-300 leading-relaxed">
              If we are involved in a merger, acquisition, or asset sale, your personal information may be transferred. We will provide notice before your personal information is transferred and becomes subject to a different Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Your Rights and Choices</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3 mt-6">6.1 Access and Correction</h3>
            <p className="text-slate-300 leading-relaxed">
              You have the right to access, update, and correct your personal information at any time through your account settings or by contacting us.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">6.2 Data Portability</h3>
            <p className="text-slate-300 leading-relaxed">
              You have the right to request a copy of your personal data in a structured, commonly used, and machine-readable format.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">6.3 Deletion</h3>
            <p className="text-slate-300 leading-relaxed">
              You may request deletion of your account and associated data, subject to our legal obligations to retain certain information for business and legal purposes.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">6.4 Opt-Out</h3>
            <p className="text-slate-300 leading-relaxed">
              You can opt out of certain data collection and processing activities, though this may limit your ability to use certain features of the Service.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">6.5 Cookies</h3>
            <p className="text-slate-300 leading-relaxed">
              You can control cookies through your browser settings. However, disabling cookies may affect the functionality of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Third-Party Services</h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              Our Service may contain links to third-party websites or integrate with third-party services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any information to them.
            </p>
            <p className="text-slate-300 leading-relaxed">
              When you connect third-party accounts (such as Instagram, Spotify, or social media platforms), you authorize us to access and use information from those accounts in accordance with this Privacy Policy and the terms of those third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Children's Privacy</h2>
            <p className="text-slate-300 leading-relaxed">
              Our Service is not intended for individuals under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us, and we will take steps to delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. International Data Transfers</h2>
            <p className="text-slate-300 leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using the Service, you consent to the transfer of your information to these countries.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. California Privacy Rights</h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>The right to know what personal information is collected, used, shared, or sold</li>
              <li>The right to delete personal information held by us</li>
              <li>The right to opt-out of the sale of personal information (we do not sell personal information)</li>
              <li>The right to non-discrimination for exercising your privacy rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. GDPR Rights (EU Users)</h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              If you are located in the European Economic Area (EEA), you have certain rights under the General Data Protection Regulation (GDPR):
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
              <li>Right of access to your personal data</li>
              <li>Right to rectification of inaccurate data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
              <li>Right to withdraw consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Changes to This Privacy Policy</h2>
            <p className="text-slate-300 leading-relaxed">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Contact Us</h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <ul className="list-none text-slate-300 space-y-2">
              <li>Through the support chat feature in the dashboard</li>
              <li>Through your account manager</li>
              <li>By submitting a request through your account settings</li>
            </ul>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800">
          <Link
            href="/dashboard"
            className="text-red-500 hover:text-red-400 text-sm"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
