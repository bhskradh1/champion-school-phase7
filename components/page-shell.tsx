import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Sidebar from '@/components/sidebar';

/* Shared page frame (sidebar + title) for the admin tool pages. */
export default function PageShell({
  role,
  title,
  subtitle,
  chip,
  children,
}: {
  role: string;
  title: string;
  subtitle: string;
  chip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <Sidebar role={role} />
      <main className="main">
        <div className="content">
          <div className="page-head">
            <div>
              <Link href="/dashboard" className="back-link">
                <ArrowLeft size={16} /> Dashboard
              </Link>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {chip && (
              <div className="security-chip">
                <ShieldCheck size={16} /> {chip}
              </div>
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
