import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Users } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import StudentManagement from '@/components/student-management';
import { createClient } from '@/lib/supabase/server';

export default async function StudentsPage() {
  const supabase = await createClient();
  if (!supabase) {
    const demoClasses=[{id:'c8',name:'Grade 8',grade:8},{id:'c9',name:'Grade 9',grade:9}];
    const demoSections=[{id:'s8a',name:'A',class_id:'c8'},{id:'s9a',name:'A',class_id:'c9'}];
    return <Shell canManage students={[]} classes={demoClasses} sections={demoSections} years={[{id:'y1',name:'2083 BS / 2026-27',is_current:true}]} requests={[]}/>;
  }

  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return <Shell canManage={false} students={[]} classes={[]} sections={[]} years={[]} requests={[]}/>;

  const { data: me } = await supabase.from('profiles').select('role,is_active').eq('id',user.id).single();
  const canManage = me?.role === 'admin' && me.is_active === true;

  const [{ data: students }, { data: enrollments }, { data: classes }, { data: sections }, { data: years }, { data: requests }] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,phone,is_active,created_at').eq('role','student').order('full_name'),
    supabase.from('student_enrollments').select('id,student_id,class_id,section_id,academic_year_id,admission_no,roll_no,is_active').order('created_at',{ascending:false}),
    supabase.from('classes').select('id,name,grade,academic_year_id').order('grade'),
    supabase.from('sections').select('id,name,class_id').order('name'),
    supabase.from('academic_years').select('id,name,is_current').order('starts_on',{ascending:false}),
    supabase.from('student_approval_requests').select('id,student_id,created_at,requested_class,requested_section,student:profiles!student_approval_requests_student_id_fkey(full_name,email)').eq('status','pending').order('created_at',{ascending:false})
  ]);

  const rows=(students||[]).map(s=>({...s,enrollment:(enrollments||[]).find(e=>e.student_id===s.id)}));
  return <Shell canManage={canManage} students={rows} classes={classes||[]} sections={sections||[]} years={years||[]} requests={(requests||[]) as any[]}/>;
}

function Shell({canManage,students,classes,sections,years,requests}:{canManage:boolean;students:any[];classes:any[];sections:any[];years:any[];requests:any[]}) {
  return <div className="app-shell"><Sidebar role={canManage?'admin':'teacher'}/><main className="main"><div className="content">
    <div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>Students</h1><p>{canManage ? 'Register students, manage enrollment and maintain the school directory.' : 'Students visible here are limited by your teaching assignments.'}</p></div><div className="security-chip"><ShieldCheck size={16}/> {students.length} visible</div></div>
    <StudentManagement students={students} classes={classes} sections={sections} years={years} requests={requests} canManage={canManage}/>
  </div></main></div>
}
