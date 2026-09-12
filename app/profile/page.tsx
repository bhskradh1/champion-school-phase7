import Link from 'next/link';
import { ArrowLeft, Mail, Phone, School, UserRound } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { createClient } from '@/lib/supabase/server';

export default async function ProfilePage(){
  const supabase=await createClient();
  let profile:any={full_name:'Student Preview',email:'student@example.com',phone:'—',is_active:true};
  let enrollment:any=null;
  if(supabase){
    const {data:{user}}=await supabase.auth.getUser();
    if(user){
      const {data:p}=await supabase.from('profiles').select('full_name,email,phone,is_active').eq('id',user.id).maybeSingle();
      const {data:e}=await supabase.from('student_enrollments').select('admission_no,roll_no,classes(name,grade),sections(name),academic_years(name)').eq('student_id',user.id).eq('is_active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
      profile=p||profile; enrollment=e;
    }
  }
  const c=enrollment?.classes, sec=enrollment?.sections, year=enrollment?.academic_years;
  return <div className="app-shell"><Sidebar role="student"/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>My profile</h1><p>Your personal account and current enrollment.</p></div></div><div className="profile-grid"><section className="panel profile-card"><div className="profile-hero"><div className="profile-avatar"><UserRound size={28}/></div><div><span className="section-kicker">STUDENT ACCOUNT</span><h2>{profile.full_name}</h2><span className={'status '+(profile.is_active?'approved':'pending')}>{profile.is_active?'Active':'Inactive'}</span></div></div><div className="profile-details"><div><Mail size={16}/><span>Email</span><strong>{profile.email||'—'}</strong></div><div><Phone size={16}/><span>Phone</span><strong>{profile.phone||'—'}</strong></div></div></section><section className="panel profile-card"><div className="panel-head"><div><h3>Current enrollment</h3><p>Your active academic placement.</p></div><School size={18}/></div><div className="enrollment-big"><strong>{c?`Class ${c.grade} · ${sec?.name||'—'}`:'Not assigned'}</strong><span>{c?.name||'No class'} · {year?.name||'No academic year'}</span><div><b>Admission</b><span>{enrollment?.admission_no||'—'}</span><b>Roll</b><span>{enrollment?.roll_no??'—'}</span></div></div></section></div></div></main></div>
}
