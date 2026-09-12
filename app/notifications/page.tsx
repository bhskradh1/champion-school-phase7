import Link from 'next/link';
import { ArrowLeft, Bell, ShieldCheck } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import NotificationsCenter from '@/components/notifications-center';
import { createClient } from '@/lib/supabase/server';

export default async function NotificationsPage(){
  const supabase=await createClient();
  if(!supabase)return <Shell role="admin"><NotificationsCenter notifications={demoNotifications}/></Shell>;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return <Shell role="student"><div className="empty-panel"><Bell size={28}/><h3>Please sign in</h3></div></Shell>;
  const {data:me}=await supabase.from('profiles').select('role').eq('id',user.id).single();
  const {data:notifications}=await supabase.from('notifications').select('id,announcement_id,kind,title,body,created_at,read_at').order('created_at',{ascending:false});
  return <Shell role={me?.role||'student'}><NotificationsCenter notifications={notifications||[]}/></Shell>;
}
function Shell({role,children}:{role:string;children:React.ReactNode}){return <div className="app-shell"><Sidebar role={role}/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>Notification centre</h1><p>Your school announcements and their read status.</p></div><div className="security-chip"><ShieldCheck size={16}/> Private to you</div></div>{children}</div></main></div>}
const demoNotifications=[{id:'demo-notification',title:'Welcome to notifications',body:'New announcements are delivered here for each recipient.',kind:'announcement',created_at:new Date().toISOString(),read_at:null}];
