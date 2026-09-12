'use client';
import { FormEvent, useState } from 'react';
import { MailPlus, Loader2 } from 'lucide-react';

export default function TeacherInviteForm({ onDone }: { onDone: () => void }) {
  const [fullName,setFullName]=useState('');
  const [email,setEmail]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setMessage('');
    const res=await fetch('/api/admin/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_name:fullName,email,role:'teacher'})});
    const data=await res.json();
    setBusy(false);
    if(!res.ok){setMessage(data.error||'Unable to send invitation.');return;}
    setMessage('Invitation sent successfully.'); setFullName(''); setEmail(''); onDone();
  }
  return <form className="inline-form" onSubmit={submit}>
    <div className="inline-input"><input required value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Teacher full name"/></div>
    <div className="inline-input"><MailPlus size={16}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="teacher@email.com"/></div>
    <button className="primary-btn" disabled={busy}>{busy?<Loader2 className="spin" size={16}/>:<MailPlus size={16}/>} {busy?'Sending…':'Invite teacher'}</button>
    {message && <span className={message.startsWith('Invitation')?'form-success':'form-error'}>{message}</span>}
  </form>
}
