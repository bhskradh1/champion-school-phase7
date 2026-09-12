'use client';
import Link from 'next/link';
import { Bell, BookOpen, CalendarCheck2, ClipboardList, GraduationCap, LayoutDashboard, MessageSquareText, Settings, ShieldCheck, Users, UserRoundCheck } from 'lucide-react';
import SignOut from './sign-out';

export default function Sidebar({ role='admin' }: { role?: string }) {
  const admin = role === 'admin';
  const teacher = role === 'teacher';
  const student = role === 'student';

  const closeSidebar = () => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('sidebar-open');
    }
  };

  const items = [
    ['/dashboard', LayoutDashboard, 'Dashboard'],
    ...(admin || teacher ? [['/students', Users, 'Students'] as const] : []),
    ...(admin ? [['/teachers', GraduationCap, 'Teachers'] as const, ['/classes', BookOpen, 'Classes & subjects'] as const] : []),
    ['/attendance', CalendarCheck2, 'Attendance'],
    ['/assignments', ClipboardList, 'Assignments'],
    ['/discussions', MessageSquareText, 'Discussions'],
  ] as const;

  return <>
    <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />
    <aside className="sidebar">
      <div className="sidebar-mobile-header">
        <div className="side-brand"><img src="/school-logo.jpg" alt="Champion English School"/><div><strong>Champion</strong><span>English School</span></div></div>
      </div>
      <div className="side-label">WORKSPACE</div>
      <nav>{items.map(([href,Icon,label])=><Link key={label} className="nav-item" href={href} onClick={closeSidebar}><Icon size={18}/>{label}</Link>)}</nav>
      <div className="side-label">SCHOOL</div>
      <nav>
        <Link className="nav-item" href="/announcements" onClick={closeSidebar}><Bell size={18}/>Announcements</Link>
        <Link className="nav-item" href="/notifications" onClick={closeSidebar}><Bell size={18}/>Notifications</Link>
        <Link className="nav-item" href="/examinations" onClick={closeSidebar}><ShieldCheck size={18}/>Examinations</Link>
        {admin && <Link className="nav-item" href="/settings" onClick={closeSidebar}><Settings size={18}/>Settings</Link>}
        {student && <Link className="nav-item" href="/profile" onClick={closeSidebar}><Users size={18}/>My profile</Link>}
        {student && <Link className="nav-item" href="/results" onClick={closeSidebar}><GraduationCap size={18}/>My results</Link>}
      </nav>
      <div className="side-footer"><div className="admin-mini"><div className="avatar">{admin?'AD':teacher?'TC':'ST'}</div><div><strong>{admin?'School Admin':teacher?'Teacher Portal':'Student Portal'}</strong><span>{role}</span></div></div><SignOut/></div>
    </aside>
  </>;
}
