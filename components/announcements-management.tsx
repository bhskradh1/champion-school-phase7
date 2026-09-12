'use client';
import { Bell, Megaphone, Send, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AnnouncementsManagement({role,announcements:initial}:{role:string;announcements:any[]}){
 const supabase=createClient(); const [announcements,setAnnouncements]=useState(initial); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
 const [form,setForm]=useState({title:'',body:'',target_audience:'all',expires_at:''});
 async function publish(){
  if(!supabase){setNotice('Preview mode: connect Supabase to publish announcements.');return}
  const title=form.title.trim(),body=form.body.trim(); if(title.length<2||body.length<2){setNotice('Add a title and message before publishing.');return}
  setBusy(true);setNotice(''); const {data:{user}}=await supabase.auth.getUser();
  const {data,error}=await supabase.from('announcements').insert({title,body,target_audience:form.target_audience,is_published:true,published_at:new Date().toISOString(),expires_at:form.expires_at||null,created_by:user?.id}).select('id,title,body,target_audience,is_published,published_at,expires_at,created_at,created_by').single();
  if(error)setNotice(error.message);else {setAnnouncements(xs=>[data,...xs]);setForm({title:'',body:'',target_audience:'all',expires_at:''});setNotice('Announcement published and delivered to eligible recipients.')} setBusy(false);
 }
 async function remove(id:string){
  if(!supabase||!confirm('Remove this announcement and its delivered notifications?'))return; setBusy(true); const {error}=await supabase.from('announcements').delete().eq('id',id); if(error)setNotice(error.message);else {setAnnouncements(xs=>xs.filter(x=>x.id!==id));setNotice('Announcement removed.')}setBusy(false);
 }
 return <div className="announcements-space">
  {role==='admin'&&<section className="card announcement-compose"><div className="panel-head"><div><span className="section-kicker"><Megaphone size={15}/> ADMIN PUBLISHING</span><h2>Send an announcement</h2><p>Each eligible active account receives a private in-app notification.</p></div></div>
   <div className="announcement-form"><label>Title<input value={form.title} maxLength={160} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Parent–teacher meeting"/></label><label>Audience<select value={form.target_audience} onChange={e=>setForm({...form,target_audience:e.target.value})}><option value="all">Everyone</option><option value="teachers">Teachers only</option></select></label><label>Expires on <input type="datetime-local" value={form.expires_at} onChange={e=>setForm({...form,expires_at:e.target.value})}/></label><label className="announcement-message">Message<textarea value={form.body} maxLength={5000} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Write the information recipients need to know…"/></label></div>
   {notice&&<div className="notice">{notice}</div>}<button className="primary-btn" disabled={busy} onClick={publish}><Send size={15}/> Publish & notify</button>
  </section>}
  {role!=='admin'&&notice&&<div className="notice">{notice}</div>}
  <section className="announcement-feed"><div className="feed-head"><div><span className="section-kicker"><Bell size={15}/> SCHOOL UPDATES</span><h2>{announcements.length} announcement{announcements.length===1?'':'s'}</h2></div></div>
  {announcements.length===0?<div className="empty-panel"><Bell size={28}/><h3>No announcements right now</h3><p>New school updates will appear here.</p></div>:announcements.map(a=><article className="card announcement-card" key={a.id}><div className="announcement-icon"><Megaphone size={19}/></div><div className="announcement-content"><div className="announcement-meta"><span className="audience-chip"><Users size={12}/>{a.target_audience==='teachers'?'Teachers only':'Everyone'}</span><time>{new Date(a.published_at||a.created_at).toLocaleString()}</time>{a.expires_at&&<time>Expires {new Date(a.expires_at).toLocaleDateString()}</time>}</div><h3>{a.title}</h3><p>{a.body}</p><small>Published by {a.profiles?.full_name||'School Admin'}</small></div>{role==='admin'&&<button className="icon-btn danger" title="Remove announcement" disabled={busy} onClick={()=>remove(a.id)}><Trash2 size={16}/></button>}</article>)}</section>
 </div>
}
