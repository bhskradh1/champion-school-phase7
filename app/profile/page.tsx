import Link from 'next/link';
import { ArrowLeft, Mail, Phone, School, UserRound } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { getCurrentUser } from '@/lib/auth/current-user';

export default async function ProfilePage(){
  // PERFORMANCE: the profile already comes back with getCurrentUser (verified locally),
  // so only the enrollment needs another query. (Was: getUser network call + 2 sequential queries.)
  const {supabase,userId,profile:me}=await getCurrentUser();
  let profile:any={full_name:'Student Preview',email:'student@example.com',phone:'—',is_active:true};
  let enrollment:any=null;
  let details:any=null;
  if(supabase && userId){
    const [{data:e},{data:d}]=await Promise.all([
      supabase.from('student_enrollments').select('admission_no,roll_no,classes(name,grade),sections(name),academic_years(name)').eq('student_id',userId).eq('is_active',true).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('student_details').select('student_code,date_of_birth,gender,address,guardian_name,guardian_relation,guardian_phone').eq('student_id',userId).maybeSingle(),
    ]);
    profile=me||profile; enrollment=e; details=d;
  }
  const c=enrollment?.classes, sec=enrollment?.sections, year=enrollment?.academic_years;
  return <div className="app-shell"><Sidebar role="student"/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>My profile</h1><p>Your personal account and current enrollment.</p></div></div><div className="profile-grid"><section className="panel profile-card"><div className="profile-hero"><div className="profile-avatar"><UserRound size={28}/></div><div><span className="section-kicker">STUDENT ACCOUNT</span><h2>{profile.full_name}</h2><span className={'status '+(profile.is_active?'approved':'pending')}>{profile.is_active?'Active':'Inactive'}</span></div></div><div className="profile-details"><div><Mail size={16}/><span>Email</span><strong>{profile.email||'—'}</strong></div><div><Phone size={16}/><span>Phone</span><strong>{profile.phone||'—'}</strong></div><div><UserRound size={16}/><span>Student ID</span><strong>{details?.student_code||'—'}</strong></div><div><UserRound size={16}/><span>Date of birth</span><strong>{details?.date_of_birth||'—'}</strong></div><div><UserRound size={16}/><span>Gender</span><strong>{details?.gender?details.gender.charAt(0).toUpperCase()+details.gender.slice(1):'—'}</strong></div><div><UserRound size={16}/><span>Address</span><strong>{details?.address||'—'}</strong></div><div><UserRound size={16}/><span>Guardian</span><strong>{details?.guardian_name?`${details.guardian_name}${details.guardian_relation?` (${details.guardian_relation})`:''}`:'—'}</strong></div><div><Phone size={16}/><span>Guardian phone</span><strong>{details?.guardian_phone||'—'}</strong></div></div></section><section className="panel profile-card"><div className="panel-head"><div><h3>Current enrollment</h3><p>Your active academic placement.</p></div><School size={18}/></div><div className="enrollment-big"><strong>{c?`Class ${c.grade} · ${sec?.name||'—'}`:'Not assigned'}</strong><span>{c?.name||'No class'} · {year?.name||'No academic year'}</span><div><b>Admission</b><span>{enrollment?.admission_no||'—'}</span><b>Roll</b><span>{enrollment?.roll_no??'—'}</span></div></div></section></div></div></main></div>
}
