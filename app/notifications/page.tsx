import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  ShieldCheck,
} from 'lucide-react';

import Sidebar from '@/components/sidebar';
import NotificationsCenter from '@/components/notifications-center';
import { getCurrentUser } from '@/lib/auth/current-user';

export default async function NotificationsPage() {
  const {
    supabase,
    userId,
    profile,
  } = await getCurrentUser();

  /*
   * Demo/fallback mode
   */
  if (!supabase) {
    return (
      <Shell role="admin">
        <NotificationsCenter
          notifications={
            demoNotifications
          }
        />
      </Shell>
    );
  }

  /*
   * No authenticated user
   */
  if (!userId) {
    return (
      <Shell role="student">
        <div className="empty-panel">
          <Bell size={28} />

          <h3>
            Please sign in
          </h3>
        </div>
      </Shell>
    );
  }

  /*
   * IMPORTANT PERFORMANCE FIX:
   *
   * Query only notifications belonging
   * to the current user.
   *
   * Your database already has an index:
   *
   * (recipient_id, read_at, created_at desc)
   *
   * so this query can use that index efficiently.
   */
  const {
    data: notifications,
    error,
  } = await supabase
    .from('notifications')
    .select(
      'id,announcement_id,kind,title,body,created_at,read_at'
    )
    .eq(
      'recipient_id',
      userId
    )
    .order(
      'created_at',
      {
        ascending: false,
      }
    )
    .limit(50);

  /*
   * Don't let an empty notification result
   * break the page.
   */
  const safeNotifications =
    error || !notifications
      ? []
      : notifications;

  return (
    <Shell
      role={
        profile?.role ||
        'student'
      }
    >
      <NotificationsCenter
        notifications={
          safeNotifications
        }
      />
    </Shell>
  );
}

function Shell({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <Sidebar role={role} />

      <main className="main">
        <div className="content">
          <div className="page-head">
            <div>
              <Link
                href="/dashboard"
                className="back-link"
              >
                <ArrowLeft size={16} />
                Dashboard
              </Link>

              <h1>
                Notification centre
              </h1>

              <p>
                Your school announcements
                and their read status.
              </p>
            </div>

            <div className="security-chip">
              <ShieldCheck size={16} />
              Private to you
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

const demoNotifications = [
  {
    id: 'demo-notification',
    title:
      'Welcome to notifications',
    body:
      'New announcements are delivered here for each recipient.',
    kind: 'announcement',
    created_at:
      new Date().toISOString(),
    read_at: null,
  },
];
