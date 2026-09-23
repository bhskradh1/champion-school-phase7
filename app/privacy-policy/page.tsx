import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | ConnectChamps",
  description: "Privacy Policy for ConnectChamps by Champion English School.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">
            Champion English School
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Last updated: September 23, 2026
          </p>
        </div>

        <article className="space-y-7 rounded-2xl bg-white p-6 leading-7 shadow-sm ring-1 ring-slate-200 sm:p-10">
          <section>
            <h2 className="mb-3 text-xl font-bold">1. Introduction</h2>
            <p>
              This Privacy Policy explains how ConnectChamps, the school
              management and communication application operated by Champion
              English School, collects, uses, stores, and protects information
              when students, parents or guardians, teachers, administrators,
              and other authorized users use the website or mobile application.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">2. Information We Collect</h2>
            <p>Depending on how you use ConnectChamps, we may process:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Account information such as name, email address, and user role.</li>
              <li>School information such as class, section, academic year, and student records.</li>
              <li>Attendance, assignments, submissions, class activities, and homework information.</li>
              <li>Examination, marks, grades, and result information.</li>
              <li>Notices, announcements, events, and other school content.</li>
              <li>Information voluntarily uploaded by authorized users, such as documents or images.</li>
              <li>Technical information needed to operate, secure, and troubleshoot the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">3. How We Use Information</h2>
            <p>Information is used for legitimate school and service purposes, including:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Creating and managing user accounts.</li>
              <li>Providing dashboards and school services appropriate to each user role.</li>
              <li>Managing attendance, assignments, examinations, and academic results.</li>
              <li>Publishing school notices, events, activities, and announcements.</li>
              <li>Communicating important school information.</li>
              <li>Maintaining security, preventing unauthorized access, and troubleshooting technical problems.</li>
              <li>Improving the reliability and functionality of ConnectChamps.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">4. Student and Minor Privacy</h2>
            <p>
              ConnectChamps may process information relating to school students,
              including minors. Student information is intended to be used for
              educational and school-administration purposes. Access is
              restricted according to user roles and the permissions configured
              by the school. Parents or guardians may contact the school to
              request information about a student record or to raise a privacy
              concern.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">5. Data Storage and Service Providers</h2>
            <p>
              ConnectChamps may use third-party infrastructure and service
              providers, including Supabase and hosting infrastructure such as
              Vercel, to provide authentication, database, hosting, security,
              and application functionality. These providers may process
              information on behalf of the service according to their own terms
              and privacy practices.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">6. Information Sharing</h2>
            <p>
              We do not sell personal information. Information may be accessible
              to authorized school personnel and users according to their role
              and the features of ConnectChamps. Information may also be
              disclosed when reasonably necessary to provide the service,
              protect security, comply with applicable law, or respond to a
              lawful request.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">7. Security</h2>
            <p>
              We use reasonable technical and organizational measures to protect
              information from unauthorized access, alteration, disclosure, or
              destruction. However, no internet service can guarantee complete
              security, and users should protect their passwords and account
              credentials.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">8. Data Retention</h2>
            <p>
              School and account information may be retained for as long as
              reasonably necessary for school administration, educational
              records, legal requirements, security, or operation of the
              service. Retention may vary depending on the type of information
              and the school&apos;s requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">9. Your Privacy Requests</h2>
            <p>
              If you believe information is inaccurate, if you have a question
              about how your information is used, or if you want to request
              appropriate access, correction, or deletion, please contact
              Champion English School. Requests involving student records may
              require verification of identity or authorization.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">10. Third-Party Links</h2>
            <p>
              ConnectChamps may contain links to third-party websites or
              services. Their privacy practices are governed by their own
              policies, and we recommend reviewing those policies before
              providing personal information.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy when the application, school
              services, or applicable requirements change. The latest version
              will be published on this page with an updated date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">12. Contact</h2>
            <p>
              For privacy questions or requests, please contact Champion English
              School through the school&apos;s official contact channels.
            </p>
            <p className="mt-3 font-medium">
              Champion English School
              <br />
              Sayapatri Margha, Dharan-15, Nepal
              <br />
              Phone: 9814350277
            </p>
          </section>

          <div className="border-t border-slate-200 pt-6 text-sm text-slate-500">
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Return to ConnectChamps
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
