import Link from 'next/link';
import { ArrowLeft, Bell, ShieldCheck } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import AnnouncementsManagement from '@/components/announcements-management';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getSchoolReferenceData } from '@/lib/supabase/cache';

export default async function AnnouncementsPage(){
  // PERFORMANCE: token verified locally + profile in one query (was: getUser network call, then profile query)
  const {supabase,userId,profile}=await getCurrentUser();
  if(!supabase) return <Shell role="admin"><AnnouncementsManagement role="admin" announcements={demoAnnouncements}/></Shell>;
  if(!userId) return <Shell role="student"><div className="empty-panel"><Bell size={28}/><h3>Please sign in</h3></div></Shell>;
  const role=profile?.role||'student';
  // PERFORMANCE: only the latest 100 announcements (was: every announcement ever posted)
  // Classes/sections are only needed by the admin's "send to a class / section" form.
  const [{data:announcements},reference]=await Promise.all([
    supabase.from('announcements').select('id,title,body,target_audience,audience_class_id,audience_section_id,audience_user_id,is_published,published_at,expires_at,created_at,created_by,profiles!announcements_created_by_fkey(full_name),audience_class:classes!announcements_audience_class_id_fkey(name),audience_section:sections!announcements_audience_section_id_fkey(name),audience_person:profiles!announcements_audience_user_id_fkey(full_name)').order('created_at',{ascending:false}).limit(100),
    role==='admin'?getSchoolReferenceData():Promise.resolve(null),
  ]);
  return <Shell role={role}><AnnouncementsManagement role={role} announcements={announcements||[]} classes={reference?.classes||[]} sections={reference?.sections||[]}/></Shell>;
}
function Shell({role,children}:{role:string;children:React.ReactNode}){return <div className="app-shell"><Sidebar role={role}/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>Announcements</h1><p>Important school updates, delivered to the right people.</p></div><div className="security-chip"><ShieldCheck size={16}/> {role==='admin'?'Admin publishing':'Audience controlled'}</div></div>{children}</div></main></div>}
const demoAnnouncements=[{id:'demo-announcement',title:'Welcome to the notification centre',body:'School-wide updates will appear here and in your notification centre.',target_audience:'all',is_published:true,published_at:new Date().toISOString(),created_at:new Date().toISOString(),profiles:{full_name:'School Admin'}}];
