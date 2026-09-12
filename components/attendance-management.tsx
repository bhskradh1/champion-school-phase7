'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, FileCheck2, Loader2, Save, ShieldCheck, UserRoundX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Student = { id:string; full_name:string; admission_no:string|null; roll_no:number|null };
type Scope = { class_id:string; section_id:string; class_name:string; grade:number; section_name:string };
type RecordRow = { student_id:string; status:'present'|'absent'|'late'|'excused'; note:string|null };

const statusMeta = {
  present: { label:'Present', icon:Check }, absent:{label:'Absent',icon:UserRoundX}, late:{label:'Late',icon:Clock3}, excused:{label:'Excused',icon:FileCheck2}
} as const;

export default function AttendanceManagement({ role, scopes, classes, sections, studentsByScope, initialRecords, initialDate }:{
  role:string; scopes:Scope[]; classes:any[]; sections:any[]; studentsByScope:Record<string,Student[]>; initialRecords:Record<string,RecordRow[]>; initialDate:string;
}) {
  const canMark = role==='admin' || scopes.length>0;
  const [scopeKey,setScopeKey]=useState(scopes[0]?`${scopes[0].class_id}:${scopes[0].section_id}`:'');
  const [date,setDate]=useState(initialDate);
  const [records,setRecords]=useState<Record<string,RecordRow[]>>(initialRecords);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  const selected=useMemo(()=>scopes.find(s=>`${s.class_id}:${s.section_id}`===scopeKey),[scopes,scopeKey]);
  const roster=selected ? (studentsByScope[scopeKey]||[]) : [];
  const keyFor=()=>selected?`${selected.class_id}:${selected.section_id}:${date}`:'';
  const current=records[keyFor()] || roster.map(s=>({student_id:s.id,status:'present',note:null}));

  function setStatus(id:string,status:RecordRow['status']) {
    setRecords(x=>({...x,[keyFor()]:current.map(r=>r.student_id===id?{...r,status}:r)}));
  }
  function markAll(status:RecordRow['status']) { setRecords(x=>({...x,[keyFor()]:current.map(r=>({...r,status}))})); }
  async function save(){
    if(!selected) return; setBusy(true); setError(''); setMessage('');
    const supabase=createClient(); if(!supabase){setError('Connect Supabase to save attendance.');setBusy(false);return;}
    const {data,error}=await supabase.rpc('save_class_attendance',{p_class_id:selected.class_id,p_section_id:selected.section_id,p_attendance_date:date,p_records:current});
    if(error){setError(error.message);setBusy(false);return;}
    setMessage(`${data||current.length} attendance records saved.`); setBusy(false);
  }

  if(!canMark) return <div className="empty-panel"><div className="empty-icon"><ShieldCheck size={25}/></div><h3>Attendance is restricted to class teachers</h3><p>You can view attendance assigned to you, but only the designated class teacher can record it.</p></div>;

  return <div className="attendance-space">
    <section className="panel attendance-editor">
      <div className="panel-head"><div><span className="section-kicker">DAILY REGISTER</span><h3>Take attendance</h3><p>Only class teachers and admins can save attendance. Every write is checked in PostgreSQL.</p></div><div className="security-chip"><ShieldCheck size={15}/> RLS + RPC protected</div></div>
      <div className="attendance-controls">
        <label>Class & section<select value={scopeKey} onChange={e=>setScopeKey(e.target.value)}><option value="">Select class</option>{scopes.map((s)=>(<option key={`${s.class_id}:${s.section_id}`} value={`${s.class_id}:${s.section_id}`}>Class {s.grade} · {s.section_name}</option>))}</select></label>
        <label>Date<input type="date" max={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)}/></label>
        <div className="attendance-actions"><button className="secondary-btn" onClick={()=>markAll('present')}><Check size={15}/> Mark all present</button><button className="primary-btn" disabled={!selected||busy||!roster.length} onClick={save}>{busy?<Loader2 size={15} className="spin"/>:<Save size={15}/>} Save attendance</button></div>
      </div>
      {message&&<div className="form-success">{message}</div>}{error&&<div className="form-error">{error}</div>}
      {selected&&<div className="attendance-summary"><strong>{roster.length}</strong><span>students</span><i/> <strong>{current.filter(r=>r.status==='present').length}</strong><span>present</span><i/> <strong>{current.filter(r=>r.status==='absent').length}</strong><span>absent</span><i/> <strong>{current.filter(r=>r.status==='late').length}</strong><span>late</span></div>}
      <div className="attendance-list">
        {!selected&&<div className="loading-row">Choose a class and section to load the register.</div>}
        {selected&&roster.map(s=>{const r=current.find(x=>x.student_id===s.id) || {student_id:s.id,status:'present' as const,note:null}; return <div className="attendance-row" key={s.id}><div className="person-inline"><div className="avatar student">{s.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>{s.full_name}</strong><span>{s.admission_no||'No admission no.'}{s.roll_no!=null?` · Roll ${s.roll_no}`:''}</span></div></div><div className="attendance-buttons">{(Object.keys(statusMeta) as RecordRow['status'][]).map(status=>{const Icon=statusMeta[status].icon;return <button key={status} className={r.status===status?`attendance-pill ${status} selected`:`attendance-pill ${status}`} onClick={()=>setStatus(s.id,status)}><Icon size={13}/>{statusMeta[status].label}</button>})}</div></div>})}
      </div>
    </section>
  </div>;
}

export function AttendanceStudentView({records}:{records:any[]}){
  const counts={present:0,absent:0,late:0,excused:0}; records.forEach(r=>counts[r.status as keyof typeof counts]++);
  return <div className="attendance-space"><section className="stat-grid"><Stat icon={Check} label="Present" value={counts.present}/><Stat icon={UserRoundX} label="Absent" value={counts.absent}/><Stat icon={Clock3} label="Late" value={counts.late}/><Stat icon={FileCheck2} label="Excused" value={counts.excused}/></section><section className="panel"><div className="panel-head"><div><h3>Attendance history</h3><p>Exact attendance dates are shown below.</p></div><div className="security-chip"><CalendarDays size={15}/> {records.length} recorded days</div></div><div className="attendance-history">{records.map(r=><div className="history-row" key={r.id}><div><strong>{new Date(`${r.attendance_date}T00:00:00`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</strong><span>{r.classes?.name||`Class ${r.classes?.grade||''}`} · {r.sections?.name?`Section ${r.sections.name}`:''}</span></div><span className={`status ${r.status==='present'?'approved':r.status==='absent'?'pending':'neutral'}`}>{r.status}</span></div>)}{!records.length&&<div className="loading-row">No attendance has been recorded yet.</div>}</div></section></div>
}
function Stat({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <div className="stat-card"><div className="stat-icon blue"><Icon size={19}/></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>Recorded attendance</small></div></div>}
