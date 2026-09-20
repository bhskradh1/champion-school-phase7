'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
export default function ApprovalActions({ id }: { id:string }) {
  const router=useRouter();
  const [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  async function act(fn:'approve_student_request'|'reject_student_request') {
    const supabase=createClient(); if(!supabase){setMessage('Connect Supabase first');return;}
    setBusy(true); setMessage('');
    const payload = fn==='approve_student_request' ? { p_request_id:id } : { p_request_id:id, p_reason:'Registration details need correction.' };
    const { error } = await supabase.rpc(fn,payload);
    setBusy(false); if(error){setMessage(error.message);return;} router.refresh();
  }
  return <div className="action-pair">{message&&<span className="action-error">{message}</span>}<button className="approve-btn" disabled={busy} onClick={()=>act('approve_student_request')}><Check size={14}/> Approve</button><button className="reject-btn" disabled={busy} onClick={()=>act('reject_student_request')}><X size={14}/> Reject</button></div>;
}
