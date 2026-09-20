'use client';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NotificationsCenter({notifications:initial}:{notifications:any[]}){
 const supabase=createClient();const router=useRouter();const [notifications,setNotifications]=useState(initial);const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const unread=useMemo(()=>notifications.filter(n=>!n.read_at).length,[notifications]);
 // LIVE: when a new notification arrives for me (e.g. someone replied to my thread), the list updates by itself.
 useEffect(()=>{
  if(!supabase) return;
  let active=true; let channel:any=null;
  (async()=>{
   const {data:{session}}=await supabase.auth.getSession(); const uid=session?.user?.id; if(!uid||!active) return;
   const reload=async()=>{const {data}=await supabase.from('notifications').select('id,announcement_id,thread_id,kind,title,body,created_at,read_at').eq('recipient_id',uid).order('created_at',{ascending:false}).limit(50); if(active&&data) setNotifications(data)};
   channel=supabase.channel('notifications-page-'+Math.random().toString(36).slice(2)).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`recipient_id=eq.${uid}`},()=>{reload()}).subscribe();
  })();
  return ()=>{active=false; if(channel) supabase.removeChannel(channel)};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function read(id:string){if(!supabase){setNotifications(xs=>xs.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x));return}setBusy(true);const {error}=await supabase.rpc('mark_notification_read',{p_notification_id:id});if(error)setNotice(error.message);else setNotifications(xs=>xs.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x));setBusy(false)}
 function openNotification(n:any){if(!n.read_at)read(n.id);if(n.kind==='discussion_reply')router.push('/discussions')}
 async function readAll(){if(!supabase){setNotifications(xs=>xs.map(x=>({...x,read_at:x.read_at||new Date().toISOString()})));return}setBusy(true);const {data,error}=await supabase.rpc('mark_all_notifications_read');if(error)setNotice(error.message);else {setNotifications(xs=>xs.map(x=>({...x,read_at:x.read_at||new Date().toISOString()})));setNotice(`${data||0} notification${data===1?'':'s'} marked as read.`)}setBusy(false)}
 return <section className="card notification-centre"><div className="notification-head"><div><span className="section-kicker"><Bell size={15}/> PRIVATE INBOX</span><h2>{unread?`${unread} unread notification${unread===1?'':'s'}`:'You are all caught up'}</h2><p>Only you can view or change the read state of these messages.</p></div><button className="secondary-btn" disabled={busy||!unread} onClick={readAll}><CheckCheck size={15}/> Mark all read</button></div>{notice&&<div className="notice">{notice}</div>}<div className="notification-list">{notifications.length===0?<div className="empty-panel"><Bell size={28}/><h3>No notifications yet</h3><p>When the school publishes an update for you, it will appear here.</p></div>:notifications.map(n=><button className={`notification-row ${n.read_at?'read':'unread'}`} key={n.id} onClick={()=>openNotification(n)} disabled={busy||(!!n.read_at&&n.kind!=='discussion_reply')}><span className="notification-dot">{n.read_at?<CheckCheck size={15}/>:<Circle size={11} fill="currentColor"/>}</span><span><strong>{n.title}</strong><small>{n.body}</small><time>{new Date(n.created_at).toLocaleString()}{!n.read_at&&' · Mark as read'}{n.kind==='discussion_reply'&&' · Open discussion'}</time></span></button>)}</div></section>
}
