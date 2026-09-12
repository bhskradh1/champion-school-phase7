'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Edit3, Mail, Phone, Plus, RefreshCw, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import ApprovalActions from '@/components/approval-actions';

type Option = { id: string; name: string; grade?: number; class_id?: string; academic_year_id?: string; is_current?: boolean };
type Student = {
  id: string; full_name: string; email: string | null; phone: string | null;
  is_active: boolean; created_at: string;
  enrollment?: { id: string; class_id: string; section_id: string; academic_year_id: string; admission_no: string | null; roll_no: number | null; is_active: boolean };
};
type Request = {
  id: string; student_id: string; created_at: string; requested_class: string; requested_section: string;
  student?: { full_name: string; email: string | null };
};

export default function StudentManagement({
  students, classes, sections, years, requests, canManage
}: {
  students: Student[]; classes: Option[]; sections: Option[]; years: Option[]; requests: Request[]; canManage: boolean;
}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Student | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => students.filter(s => {
    const e = s.enrollment;
    const c = classes.find(x => x.id === e?.class_id);
    const sec = sections.find(x => x.id === e?.section_id);
    const hay = [s.full_name, s.email, s.phone, e?.admission_no, String(e?.roll_no ?? ''), c?.name, sec?.name].join(' ').toLowerCase();
    return hay.includes(query.toLowerCase());
  }), [students, query, classes, sections]);

  return <div>
    <div className="student-toolbar">
      <div className="search wide"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, admission no, class…"/></div>
      {canManage && <button className="primary-btn" onClick={() => setShowAdd(true)}><Plus size={17}/> Register student</button>}
    </div>

    {requests.length > 0 && <section className="panel pending-panel">
      <div className="panel-head"><div><h3>Pending registrations</h3><p>Requests are visible only to admins or teachers authorized for the requested class/section.</p></div><ShieldCheck size={18}/></div>
      <div className="pending-cards">{requests.map(r => <div className="pending-card" key={r.id}>
        <div className="avatar student">{(r.student?.full_name || 'Student').split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
        <div className="person"><strong>{r.student?.full_name || 'Student'}</strong><span>{r.student?.email || 'No email'} · Class {r.requested_class} · {r.requested_section}</span></div>
        <ApprovalActions id={r.id}/>
      </div>)}</div>
    </section>}

    <section className="panel">
      <div className="panel-head"><div><h3>Student directory</h3><p>{filtered.length} visible student{filtered.length === 1 ? '' : 's'} · {canManage ? 'Admin management enabled' : 'Teaching-scope access'}</p></div><div className="security-chip"><CheckCircle2 size={15}/> RLS protected</div></div>
      <div className="table-wrap">
        <div className="table-head student-head"><span>STUDENT</span><span>CLASS / SECTION</span><span>ADMISSION</span><span>CONTACT</span><span>STATUS</span><span/></div>
        {filtered.map(s => {
          const e=s.enrollment, c=classes.find(x=>x.id===e?.class_id), sec=sections.find(x=>x.id===e?.section_id);
          return <div className="table-row student-row" key={s.id}>
            <div className="person-inline"><div className="avatar student">{s.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>{s.full_name}</strong><span>{s.email || 'No email'}</span></div></div>
            <strong>{c ? `Class ${c.grade ?? ''} · ${sec?.name || '—'}` : 'Not assigned'}</strong>
            <span className="muted">{e?.admission_no || '—'} {e?.roll_no != null ? `· Roll ${e.roll_no}` : ''}</span>
            <span className="muted">{s.phone || '—'}</span>
            <span className={'status '+(s.is_active ? 'approved' : 'pending')}>{s.is_active ? 'active' : 'inactive'}</span>
            {canManage ? <button className="icon-btn plain" title="Edit student" onClick={() => setEditing(s)}><Edit3 size={16}/></button> : <span/>}
          </div>
        })}
        {filtered.length===0 && <div className="loading-row">No students match your search.</div>}
      </div>
    </section>

    {(showAdd || editing) && <StudentModal
      mode={showAdd ? 'add' : 'edit'}
      student={editing}
      classes={classes}
      sections={sections}
      years={years}
      onClose={() => { setShowAdd(false); setEditing(null); }}
    />}
  </div>;
}

function StudentModal({mode,student,classes,sections,years,onClose}:{mode:'add'|'edit';student:Student|null;classes:Option[];sections:Option[];years:Option[];onClose:()=>void}) {
  const initialYear = student?.enrollment?.academic_year_id || years.find(y=>y.is_current)?.id || years[0]?.id || '';
  const [yearId,setYearId]=useState(initialYear);
  const [classId,setClassId]=useState(student?.enrollment?.class_id || '');
  const [sectionId,setSectionId]=useState(student?.enrollment?.section_id || '');
  const [name,setName]=useState(student?.full_name || '');
  const [email,setEmail]=useState(student?.email || '');
  const [phone,setPhone]=useState(student?.phone || '');
  const [admissionNo,setAdmissionNo]=useState(student?.enrollment?.admission_no || '');
  const [rollNo,setRollNo]=useState(student?.enrollment?.roll_no?.toString() || '');
  const [active,setActive]=useState(student?.is_active ?? true);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const availableClasses=classes.filter(c=>!c.academic_year_id || c.academic_year_id===yearId);

  function changeYear(v:string){setYearId(v); const still=classes.some(c=>c.id===classId && (!c.academic_year_id || c.academic_year_id===v)); if(!still){setClassId('');setSectionId('');}}
  const availableSections=sections.filter(s=>s.class_id===classId);
  function changeClass(v:string){setClassId(v); if(!sections.some(s=>s.id===sectionId && s.class_id===v)) setSectionId('');}
  async function save(){
    setBusy(true);setError('');
    try{
      const res=await fetch('/api/admin/students',{method:mode==='add'?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        student_id:student?.id,full_name:name,email,phone,class_id:classId,section_id:sectionId,academic_year_id:yearId,admission_no:admissionNo,roll_no:rollNo,is_active:active
      })});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Could not save student.');
      window.location.reload();
    }catch(e:any){setError(e.message)}finally{setBusy(false)}
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}>
    <div className="modal-card">
      <div className="modal-head"><div><span className="section-kicker">{mode==='add'?'NEW REGISTRATION':'STUDENT PROFILE'}</span><h2>{mode==='add'?'Register student':'Edit student'}</h2><p>{mode==='add'?'An invitation will be emailed to the student.':'Update profile, enrollment and active status.'}</p></div><button className="icon-btn plain" onClick={onClose}><X size={19}/></button></div>
      <div className="form-grid">
        <label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Student full name"/></label>
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="student@example.com" disabled={mode==='edit'}/></label>
        <label>Phone<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+977 …"/></label>
        <label>Admission no.<input value={admissionNo} onChange={e=>setAdmissionNo(e.target.value)} placeholder="CES-2083-001"/></label>
        <label>Academic year<select value={yearId} onChange={e=>changeYear(e.target.value)}><option value="">Select year</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}{y.is_current?' · current':''}</option>)}</select></label>
        <label>Class<select value={classId} onChange={e=>changeClass(e.target.value)}><option value="">Select class</option>{availableClasses.map(c=><option key={c.id} value={c.id}>Class {c.grade} · {c.name}</option>)}</select></label>
        <label>Section<select value={sectionId} onChange={e=>setSectionId(e.target.value)} disabled={!classId}><option value="">Select section</option>{availableSections.map(s=><option key={s.id} value={s.id}>{s.name}{s.name===student?.enrollment?.section_id?'':''}</option>)}</select></label>
        <label>Roll no.<input type="number" min="0" value={rollNo} onChange={e=>setRollNo(e.target.value)} placeholder="1"/></label>
      </div>
      {mode==='edit' && <label className="toggle-row"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/><span><strong>Active student</strong><small>Inactive students remain in history but are not treated as current.</small></span></label>}
      {mode==='add' && <div className="form-note"><Mail size={15}/> The student will receive a secure Supabase invitation. Never share the service-role key with the browser.</div>}
      {error&&<div className="form-error">{error}</div>}
      <div className="modal-actions"><button className="secondary-btn" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-btn" onClick={save} disabled={busy}>{busy?<RefreshCw className="spin" size={15}/>:<UserRound size={15}/>} {busy?'Saving…':mode==='add'?'Create & invite':'Save changes'}</button></div>
    </div>
  </div>
}
