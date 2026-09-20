'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/*
 * status:  'pending' | 'teacher_approved'
 * isAdmin: true for admins. When the school uses the two-step approval
 *          (class teacher, then admin), a teacher can only do step 1.
 */
export default function ApprovalActions({ id, status = 'pending', isAdmin = true }: { id:string; status?:string; isAdmin?:boolean }) {
  const router=useRouter();
  const [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  async function act(fn:'approve_student_request'|'reject_student_request') {
    const supabase=createClient(); if(!supabase){setMessage('Connect Supabase first');return;}
    let payload:any = { p_request_id:id };
    if(fn==='reject_student_request'){
      const reason=window.prompt('Why is this request being rejected?\n(The student will see this reason.)','You are not listed in this class. Please contact the school office.');
      if(reason===null) return;
      if(!reason.trim()){setMessage('A reason is required.');return;}
      payload={ p_request_id:id, p_reason:reason.trim() };
    }
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc(fn,payload);
    setBusy(false); if(error){setMessage(error.message);return;} router.refresh();
  }
  if(status==='teacher_approved' && !isAdmin){
    return <div className="action-pair"><span className="muted">Approved by you · waiting for the admin</span></div>;
  }
  return <div className="action-pair">{message&&<span className="action-error">{message}</span>}<button className="approve-btn" disabled={busy} onClick={()=>act('approve_student_request')}><Check size={14}/> {status==='teacher_approved'?'Final approve':'Approve'}</button><button className="reject-btn" disabled={busy} onClick={()=>act('reject_student_request')}><X size={14}/> Reject</button></div>;
}
