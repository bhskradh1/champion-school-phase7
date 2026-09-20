'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Lock, MessageCircle, Plus, Send, Trash2, Users, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Scope = { class_id:string; section_id:string|null; class_name:string; section_name:string; label:string };
type Thread = any;

export default function DiscussionsManagement({ role, threads:initialThreads, replies:initialReplies, votes:initialVotes, pollOptions:initialPollOptions, scopes }: {role:string; threads:Thread[]; replies:Thread[]; votes:Thread[]; pollOptions:Thread[]; scopes:Scope[]}) {
  const supabase = createClient();
  const [threads,setThreads]=useState(initialThreads);
  const [replies,setReplies]=useState(initialReplies);
  const [votes,setVotes]=useState(initialVotes); const [pollOptions,setPollOptionsData]=useState(initialPollOptions);
  const [audience,setAudience]=useState<'school'|'class'>('school');
  const [scope,setScope]=useState(scopes[0]?.label||'');
  const [kind,setKind]=useState<'thread'|'poll'>('thread');
  const [title,setTitle]=useState(''); const [body,setBody]=useState('');
  const [replyText,setReplyText]=useState<Record<string,string>>({});
  const [composerPollOptions,setComposerPollOptions]=useState(['','']);
const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
  const canCreate = role==='student'||role==='teacher'||role==='admin';

  const selectedScope = scopes.find(s=>s.label===scope) || scopes[0];
  const grouped = useMemo(()=>threads.map(t=>({...t,replies:replies.filter(r=>r.thread_id===t.id)})),[threads,replies]);

  /*
   * LIVE SYNC: when anyone posts a thread/poll, replies, votes or deletes,
   * Supabase tells this page and it reloads the feed by itself.
   * The short delay merges several quick changes into one reload.
   * (The typed-but-unsent reply text is NOT touched by a reload.)
   */
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  refreshRef.current = refresh;

  useEffect(() => {
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { refreshRef.current(); }, 400);
    };
    const channel = supabase
      .channel('discussions-live-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_threads' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_replies' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_poll_votes' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_poll_options' }, scheduleRefresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createThread(){
    if(!supabase) return setNotice('Preview mode: connect Supabase to post.');
    if(!title.trim()) return setNotice('Add a title.');
    setBusy(true); setNotice('');
    try {
      let inserted:any;
      if(kind==='poll'){
        const options=composerPollOptions.map(x=>x.trim()).filter(Boolean);
        if(options.length<2) throw new Error('A poll needs at least two options.');
        const {data,error}=await supabase.rpc('create_discussion_poll',{p_audience:audience,p_class_id:audience==='class'?selectedScope?.class_id:null,p_section_id:audience==='class'?selectedScope?.section_id:null,p_title:title.trim(),p_body:body.trim(),p_options:options});
        if(error) throw error;
        inserted={id:data};
      } else {
        const {data,error}=await supabase.from('discussion_threads').insert({author_id:(await supabase.auth.getSession()).data.session?.user?.id,audience,class_id:audience==='class'?selectedScope?.class_id:null,section_id:audience==='class'?selectedScope?.section_id:null,title:title.trim(),body:body.trim(),kind:'thread'}).select('id,author_id,audience,class_id,section_id,kind,title,body,created_at,is_locked,is_deleted,created_day').single();
        if(error) throw error; inserted=data;
      }
      setNotice('Posted successfully.'); setTitle(''); setBody(''); setComposerPollOptions(['','']);
      await refresh();
    } catch(e:any){setNotice(e.message||'Could not post. You can create only one top-level post per day.');}
    finally{setBusy(false)}
  }
  async function refresh(){
    if(!supabase) return;
    const {data:t}=await supabase.from('discussion_threads').select('id,author_id,audience,class_id,section_id,kind,title,body,created_at,is_locked,is_deleted,created_day,profiles!discussion_threads_author_id_fkey(full_name),classes(name),sections(name)').eq('is_deleted',false).order('created_at',{ascending:false}).limit(60);
    if(t) setThreads(t);
    const ids=(t||[]).map(x=>x.id); if(ids.length){const [{data:r},{data:v},{data:o}]=await Promise.all([supabase.from('discussion_replies').select('id,thread_id,author_id,body,created_at,profiles!discussion_replies_author_id_fkey(full_name)').in('thread_id',ids).eq('is_deleted',false).order('created_at'),supabase.from('discussion_poll_votes').select('id,thread_id,option_id,voter_id,created_at').in('thread_id',ids),supabase.from('discussion_poll_options').select('id,thread_id,label,position').in('thread_id',ids).order('position')]); setReplies(r||[]); setVotes(v||[]); setPollOptionsData(o||[])}
  }
  async function reply(threadId:string){ if(!supabase)return; const text=replyText[threadId]?.trim(); if(!text) return; const user=(await supabase.auth.getSession()).data.session?.user; if(!user)return; const {error}=await supabase.from('discussion_replies').insert({thread_id:threadId,author_id:user.id,body:text}); if(error)setNotice(error.message); else {setReplyText({...replyText,[threadId]:''}); await refresh();}}
  async function vote(threadId:string,optionId:string){if(!supabase)return;setBusy(true);const {error}=await supabase.rpc('vote_discussion_poll',{p_thread_id:threadId,p_option_id:optionId}); if(error)setNotice(error.message); else await refresh();setBusy(false)}
  async function removeThread(id:string){if(!supabase)return;if(!confirm('Delete this discussion?'))return; const {error}=await supabase.from('discussion_threads').update({is_deleted:true}).eq('id',id); if(error)setNotice(error.message); else await refresh();}
  async function toggleLock(t:Thread){if(!supabase)return;if(role!=='admin')return;const {error}=await supabase.from('discussion_threads').update({is_locked:!t.is_locked}).eq('id',t.id);if(error)setNotice(error.message);else await refresh()}

  return <div className="discussion-layout">
    {canCreate && <section className="discussion-composer card">
      <div className="section-kicker"><MessageCircle size={16}/> Community</div>
      <h2>Start a discussion</h2><p className="muted">{role==='student'?'One top-level post per person per Nepal calendar day. Replies are open without a daily cap.':'You can start as many threads and polls as you need. Students are limited to one per day.'}</p>
      <div className="segmented"><button className={kind==='thread'?'active':''} onClick={()=>setKind('thread')}><MessageCircle size={16}/> Thread</button><button className={kind==='poll'?'active':''} onClick={()=>setKind('poll')}><BarChart3 size={16}/> Poll</button></div>
      <div className="form-grid two">
        <label>Audience<select value={audience} onChange={e=>setAudience(e.target.value as any)}><option value="school">Everyone</option><option value="class">My class / assigned class</option></select></label>
        {audience==='class' && <label>Class scope<select value={scope} onChange={e=>setScope(e.target.value)}>{scopes.map(s=><option key={s.label}>{s.label}</option>)}</select></label>}
      </div>
      <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="What would you like to discuss?" maxLength={180}/></label>
      <label>Message<textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Share an idea, question, announcement or study tip…" rows={4} maxLength={10000}/></label>
      {kind==='poll' && <div className="poll-builder"><strong>Poll options</strong>{composerPollOptions.map((o,i)=><div className="inline-field" key={i}><input value={o} onChange={e=>{const a=[...composerPollOptions];a[i]=e.target.value;setComposerPollOptions(a)}} placeholder={`Option ${i+1}`}/>{composerPollOptions.length>2&&<button className="icon-btn" onClick={()=>setComposerPollOptions(composerPollOptions.filter((_,j)=>j!==i))}><X size={16}/></button>}</div>)}{composerPollOptions.length<10&&<button className="ghost-btn" onClick={()=>setComposerPollOptions([...composerPollOptions,''])}><Plus size={15}/> Add option</button>}</div>}
      {notice && <div className="notice">{notice}</div>}
      <button className="primary-btn" disabled={busy} onClick={createThread}>{busy?'Posting…':<><Send size={16}/> Publish {kind}</>}</button>
    </section>}

    <section className="discussion-feed">
      <div className="feed-head"><div><span className="section-kicker"><Users size={16}/> Discussion feed</span><h2>Conversations</h2></div><button className="ghost-btn" onClick={refresh}>Refresh</button></div>
      {grouped.length===0 ? <div className="empty-panel"><MessageCircle size={28}/><h3>No discussions yet</h3><p>Start the first conversation for your school community.</p></div> : grouped.map(t=>{
        const tvotes=votes.filter(v=>v.thread_id===t.id); const repliesFor=t.replies||[]; const options=pollOptions.filter((x:any)=>x.thread_id===t.id);
        return <article className="discussion-card card" key={t.id}>
          <div className="thread-top"><div className="author-avatar">{(t.profiles?.full_name||'U').slice(0,2).toUpperCase()}</div><div><strong>{t.profiles?.full_name||'Community member'}</strong><span>{t.audience==='school'?'Everyone':`${t.classes?.name||t.class_name||'Class'}${t.sections?.name?` · ${t.sections.name}`:''}`} · {new Date(t.created_at).toLocaleString()}</span></div><div className="thread-actions">{t.is_locked&&<span className="status-pill"><Lock size={13}/> Locked</span>}{role==='admin'&&<button className="icon-btn" title="Lock/unlock" onClick={()=>toggleLock(t)}><Lock size={15}/></button>}{(role==='admin')&&<button className="icon-btn danger" onClick={()=>removeThread(t.id)}><Trash2 size={15}/></button>}</div></div>
          <div className="thread-body"><div className="thread-tag">{t.kind==='poll'?'POLL':'DISCUSSION'}</div><h3>{t.title}</h3>{t.body&&<p>{t.body}</p>}</div>
          {t.kind==='poll' && <PollBlock threadId={t.id} options={options} votes={tvotes} onVote={vote} disabled={busy||t.is_locked}/>} 
          <div className="reply-list">{repliesFor.slice(-5).map((r:any)=><div className="reply" key={r.id}><div className="reply-avatar">{(r.profiles?.full_name||'U').slice(0,1).toUpperCase()}</div><div><strong>{r.profiles?.full_name||'Member'}</strong><p>{r.body}</p><small>{new Date(r.created_at).toLocaleString()}</small></div></div>)}</div>
          {!t.is_locked && <div className="reply-box"><input value={replyText[t.id]||''} onChange={e=>setReplyText({...replyText,[t.id]:e.target.value})} onKeyDown={e=>{if(e.key==='Enter')reply(t.id)}} placeholder="Write a reply…"/><button className="icon-send" onClick={()=>reply(t.id)}><Send size={16}/></button></div>}
        </article>
      })}
    </section>
  </div>
}
function PollBlock({threadId,options,votes,onVote,disabled}:{threadId:string;options:any[];votes:any[];onVote:(a:string,b:string)=>void;disabled:boolean}){
  const total=votes.length;
  return <div className="poll-block"><div className="poll-note"><BarChart3 size={16}/> Choose one option {total>0&&<span>{total} vote{total===1?'':'s'}</span>}</div>{options.map((o:any)=>{const count=votes.filter(x=>x.option_id===o.id).length; const pct=total?Math.round(count*100/total):0; return <button key={o.id} disabled={disabled} className="poll-option" onClick={()=>onVote(threadId,o.id)}><div><span>{o.label}</span><div className="poll-bar"><i style={{width:`${pct}%`}}/></div></div><strong>{pct}%</strong></button>})}</div>
}
