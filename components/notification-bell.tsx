'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useUnreadNotifications } from './use-unread-notifications';

/* The bell in the top bar: the red dot appears live when a notification arrives. */
export default function NotificationBell({
  initialUnread = 0,
}: {
  initialUnread?: number;
}) {
  const unread = useUnreadNotifications(initialUnread);

  return (
    <Link
      className="icon-btn"
      href="/notifications"
      aria-label="Open notification centre"
    >
      <Bell size={19} />
      {unread > 0 && <i />}
    </Link>
  );
}
