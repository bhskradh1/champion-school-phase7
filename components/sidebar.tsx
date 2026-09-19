'use client';

import Link from 'next/link';
import {
  Bell,
  BookOpen,
  CalendarCheck2,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Users,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';

import SignOut from './sign-out';

export default function Sidebar({
  role = 'admin',
}: {
  role?: string;
}) {
  const [open, setOpen] = useState(false);

  const admin = role === 'admin';
  const teacher = role === 'teacher';
  const student = role === 'student';

  const closeSidebar = () => {
    setOpen(false);
  };

  const toggleSidebar = () => {
    setOpen((current) => !current);
  };

  const items = [
    [
      '/dashboard',
      LayoutDashboard,
      'Dashboard',
    ],
    ...(admin || teacher
      ? [
          [
            '/students',
            Users,
            'Students',
          ] as const,
        ]
      : []),
    ...(admin
      ? [
          [
            '/teachers',
            GraduationCap,
            'Teachers',
          ] as const,
          [
            '/classes',
            BookOpen,
            'Classes & subjects',
          ] as const,
        ]
      : []),
    [
      '/attendance',
      CalendarCheck2,
      'Attendance',
    ],
    [
      '/assignments',
      ClipboardList,
      'Assignments',
    ],
    [
      '/discussions',
      MessageSquareText,
      'Discussions',
    ],
  ] as const;

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        className="mobile-menu"
        aria-label={
          open
            ? 'Close navigation'
            : 'Open navigation'
        }
        aria-expanded={open}
        onClick={toggleSidebar}
      >
        {open ? (
          <X size={21} />
        ) : (
          <Menu size={21} />
        )}
      </button>

      {/* Mobile overlay */}
      <button
        type="button"
        className={
          open
            ? 'sidebar-overlay open'
            : 'sidebar-overlay'
        }
        aria-label="Close navigation"
        onClick={closeSidebar}
      />

      <aside
        className={
          open
            ? 'sidebar sidebar-open'
            : 'sidebar'
        }
      >
        <div className="sidebar-mobile-header">
          <div className="side-brand">
            <img
              src="/school-logo.jpg"
              alt="Champion English School"
            />

            <div>
              <strong>Champion</strong>
              <span>
                English School
              </span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-close"
            aria-label="Close navigation"
            onClick={closeSidebar}
          >
            <X size={19} />
          </button>
        </div>

        <div className="side-label">
          WORKSPACE
        </div>

        <nav>
          {items.map(
            ([href, Icon, label]) => (
              <Link
                key={label}
                className="nav-item"
                href={href}
                onClick={closeSidebar}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          )}
        </nav>

        <div className="side-label">
          SCHOOL
        </div>

        <nav>
          <Link
            className="nav-item"
            href="/announcements"
            onClick={closeSidebar}
          >
            <Bell size={18} />
            Announcements
          </Link>

          <Link
            className="nav-item"
            href="/notifications"
            onClick={closeSidebar}
          >
            <Bell size={18} />
            Notifications
          </Link>

          <Link
            className="nav-item"
            href="/examinations"
            onClick={closeSidebar}
          >
            <ShieldCheck size={18} />
            Examinations
          </Link>

          {admin && (
            <Link
              className="nav-item"
              href="/settings"
              onClick={closeSidebar}
            >
              <Settings size={18} />
              Settings
            </Link>
          )}

          {student && (
            <Link
              className="nav-item"
              href="/profile"
              onClick={closeSidebar}
            >
              <Users size={18} />
              My profile
            </Link>
          )}

          {student && (
            <Link
              className="nav-item"
              href="/results"
              onClick={closeSidebar}
            >
              <GraduationCap size={18} />
              My results
            </Link>
          )}
        </nav>

        <div className="side-footer">
          <div className="admin-mini">
            <div className="avatar">
              {admin
                ? 'AD'
                : teacher
                ? 'TC'
                : 'ST'}
            </div>

            <div>
              <strong>
                {admin
                  ? 'School Admin'
                  : teacher
                  ? 'Teacher Portal'
                  : 'Student Portal'}
              </strong>

              <span>{role}</span>
            </div>
          </div>

          <SignOut />
        </div>
      </aside>
    </>
  );
}
