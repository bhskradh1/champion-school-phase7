import Link from 'next/link';
import { ArrowLeft, Construction, Sparkles } from 'lucide-react';
import Sidebar from '@/components/sidebar';
const titles: Record<string,string> = { teachers:'Teachers', classes:'Classes & subjects', attendance:'Attendance', assignments:'Assignments', discussions:'Discussions', announcements:'Announcements', examinations:'Examinations', settings:'Settings' };
export default async function ModulePage({ params }: { params: Promise<{module:string}> }) {
  const { module } = await params; const title=titles[module] || 'Module';
  return <div className="app-shell"><Sidebar/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>{title}</h1><p>This module is included in the application shell and is the next implementation surface.</p></div><div className="security-chip"><Sparkles size={16}/> Phase 1 foundation</div></div><div className="empty-panel"><div className="empty-icon"><Construction size={25}/></div><h3>{title} module is scaffolded</h3><p>The navigation, branding, role-aware architecture and Supabase security foundation are in place. This screen will be connected to its real data tables in the next build increment.</p></div></div></main></div>;
}
