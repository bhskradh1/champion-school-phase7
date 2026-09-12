import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import AttendanceManagement, { AttendanceStudentView } from '@/components/attendance-management';
import { createClient } from '@/lib/supabase/server';
import { getSchoolReferenceData } from '@/lib/supabase/cache';

export default async function AttendancePage(){
  const supabase=await createClient();
  const today=new Date().toISOString().slice(0,10);
  if(!supabase) return <Shell role="admin"><AttendanceManagement role="admin" scopes={demoScopes} classes={[]} sections={[]} studentsByScope={demoRoster} initialRecords={{}} initialDate={today}/></Shell>;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return <Shell role="student"><div className="empty-panel"><h3>Please sign in</h3></div></Shell>;
  const {data:me}=await supabase.from('profiles').select('role,is_active,full_name').eq('id',user.id).single();
  const role=me?.role||'student';
  if(role==='student'){
    const {data:records}=await supabase.from('attendance_records').select('id,attendance_date,status,note,class_id,section_id,classes(name,grade),sections(name)').eq('student_id',user.id).order('attendance_date',{ascending:false});
    return <Shell role={role}><AttendanceStudentView records={records||[]}/></Shell>;
  }
  let assignments:any[]=[];
  if(role==='teacher') {
    const {data}=await supabase.from('teacher_assignments').select('class_id,section_id,is_class_teacher,classes(name,grade),sections(name)').eq('teacher_id',user.id).eq('is_class_teacher',true);
    assignments=data||[];
  }
  const { classes, sections } = await getSchoolReferenceData();
  const scopes=(role==='admin'
    ? (sections||[]).map(s=>{const c=(classes||[]).find(c=>c.id===s.class_id);return c?{class_id:c.id,section_id:s.id,class_name:c.name,grade:c.grade,section_name:s.name}:null}).filter(Boolean)
    : assignments.map(a=>a.sections?{class_id:a.class_id,section_id:a.section_id,class_name:a.classes?.name||'',grade:a.classes?.grade||0,section_name:a.sections?.name||''}:null).filter(Boolean)
  ) as any[];

  const scopeEntries = await Promise.all((scopes || []).map(async (s) => {
    const [enrollmentsResult, recordsResult] = await Promise.all([
      supabase.from('student_enrollments').select('student_id,admission_no,roll_no,profiles!student_enrollments_student_id_fkey(id,full_name)').eq('class_id', s.class_id).eq('section_id', s.section_id).eq('is_active', true),
      supabase.from('attendance_records').select('student_id,status,note,attendance_date').eq('class_id', s.class_id).eq('section_id', s.section_id).order('attendance_date', { ascending: false }).limit(120),
    ]);

    const roster = (enrollmentsResult.data || []).map((e: any) => ({
      id: e.student_id,
      full_name: (e.profiles as any)?.full_name || 'Student',
      admission_no: e.admission_no,
      roll_no: e.roll_no,
    })).sort((a, b) => a.full_name.localeCompare(b.full_name));

    const initialRecords: Record<string, any[]> = {};
    for (const r of recordsResult.data || []) {
      const k = `${s.class_id}:${s.section_id}:${r.attendance_date}`;
      (initialRecords[k] ||= []).push({ student_id: r.student_id, status: r.status, note: r.note });
    }

    return { key: `${s.class_id}:${s.section_id}`, roster, initialRecords };
  }));

  const studentsByScope: Record<string, any[]> = {};
  const initialRecords: Record<string, any[]> = {};
  for (const entry of scopeEntries) {
    studentsByScope[entry.key] = entry.roster;
    Object.assign(initialRecords, entry.initialRecords);
  }

  return <Shell role={role}><AttendanceManagement role={role} scopes={scopes} classes={classes||[]} sections={sections||[]} studentsByScope={studentsByScope} initialRecords={initialRecords} initialDate={today}/></Shell>;
}
function Shell({role,children}:{role:string;children:React.ReactNode}){return <div className="app-shell"><Sidebar role={role}/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>Attendance</h1><p>{role==='student'?'Your attendance history, including exact absence dates.':'Record daily attendance for your authorized class sections.'}</p></div><div className="security-chip"><ShieldCheck size={16}/> {role==='admin'?'Admin access':role==='teacher'?'Class-teacher scope':'Personal record'}</div></div>{children}</div></main></div>}
const demoScopes=[{class_id:'c8',section_id:'s8a',class_name:'Grade 8',grade:8,section_name:'A'}];
const demoRoster:Record<string,any[]>={'c8:s8a':[{id:'demo-1',full_name:'Aarav Sharma',admission_no:'CES-001',roll_no:1},{id:'demo-2',full_name:'Saanvi Rai',admission_no:'CES-002',roll_no:2}]};
