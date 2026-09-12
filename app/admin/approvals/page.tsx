import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock3, MoreHorizontal, Search, ShieldCheck, UserRoundX } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import ApprovalActions from '@/components/approval-actions';
import { createClient } from '@/lib/supabase/server';

export default async function ApprovalsPage() {
  const supabase = await createClient();
  let rows:any[]=[];
  if (supabase) {
    const { data } = await supabase.from('student_approval_requests').select('id, created_at, status, requested_class, requested_section, student:profiles!student_approval_requests_student_id_fkey(full_name,email), class:classes!student_approval_requests_requested_class_fkey(name,grade), section:sections!student_approval_requests_requested_section_fkey(name)').eq('status','pending').order('created_at',{ascending:false});
    rows=data||[];
  }
  const fallback=[{id:'demo-1',student:{full_name:'Aarav Rai',email:'aarav@example.com'},requested_class:'8',requested_section:'A',created_at:'2 min ago',status:'pending'},{id:'demo-2',student:{full_name:'Srijana Limbu',email:'srijana@example.com'},requested_class:'6',requested_section:'B',created_at:'18 min ago',status:'pending'},{id:'demo-3',student:{full_name:'Nischal Karki',email:'nischal@example.com'},requested_class:'9',requested_section:'A',created_at:'43 min ago',status:'pending'}];
  const list = supabase ? rows : fallback;
  return <div className="app-shell"><Sidebar/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>Student approvals</h1><p>Review registration requests. Class teachers are restricted to their own class and section by database policy.</p></div><div className="security-chip"><ShieldCheck size={16}/> RLS protected</div></div><div className="toolbar"><div className="search wide"><Search size={18}/><input placeholder="Search pending students..."/></div><button className="secondary-btn">All pending <span className="count-pill">{list.length}</span></button></div><section className="panel"><div className="approval-table"><div className="table-head"><span>STUDENT</span><span>REQUESTED CLASS</span><span>REQUESTED</span><span>STATUS</span><span/></div>{list.map(r=><div className="table-row approval-table-row" key={r.id}><div className="person-inline"><div className="avatar student">{(r.student?.full_name||'Student').split(' ').map((x:string)=>x[0]).join('').slice(0,2)}</div><div><strong>{r.student?.full_name||'Student'}</strong><span>{r.student?.email||'—'}</span></div></div><strong>{r.class?.name || `Class ${r.requested_class}`} · {r.section?.name || r.requested_section}</strong><span className="muted"><Clock3 size={14}/> {r.created_at}</span><span className="status pending">Pending</span><ApprovalActions id={r.id}/></div>)}</div>{!supabase&&<div className="demo-banner"><ShieldCheck size={17}/><span>Showing demo records until Supabase is connected and real pending requests exist.</span></div>}{supabase&&rows.length===0&&<div className="empty-mini">No pending approval requests.</div>}</section></div></main></div>;
}
