import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import AssignmentsManagement from '@/components/assignments-management';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getSchoolReferenceData } from '@/lib/supabase/cache';

export default async function AssignmentsPage(){
  // PERFORMANCE: token verified locally + profile in one query (was: getUser network call, then profile query)
  const {supabase,userId,profile}=await getCurrentUser();
  if(!supabase) return <Shell role="admin"><AssignmentsManagement role="admin" assignments={[]} scopes={demoScopes} subjects={demoSubjects} submissions={{}}/></Shell>;
  if(!userId) return <Shell role="student"><div className="empty-panel"><h3>Please sign in</h3></div></Shell>;
  const role=profile?.role||'student';

  /*
   * PERFORMANCE: everything below is fetched AT THE SAME TIME, and the
   * submissions come back inside the assignments query.
   * (Was: reference data -> teacher scopes -> assignments -> submissions, one after another.)
   */
  const select='id,teacher_id,class_id,section_id,subject_id,title,description,due_at,max_points,status,published_at,created_at,classes(name,grade),sections(name),subjects(name,code),profiles!assignments_teacher_id_fkey(full_name),assignment_submissions(id,assignment_id,student_id,content,attachment_url,status,submitted_at,grade,feedback,graded_at,profiles!assignment_submissions_student_id_fkey(full_name))';
  const assignmentsQuery = role==='student'
    ? supabase.from('assignments').select(select).eq('status','published').order('due_at',{ascending:true,nullsFirst:false}).limit(100)
    : supabase.from('assignments').select(select).order('created_at',{ascending:false}).limit(100);
  const teacherScopeQuery = role==='teacher'
    ? supabase.from('teacher_assignments').select('id,class_id,section_id,subject_id,is_class_teacher,classes(name,grade),sections(name),subjects(name,code)').eq('teacher_id',userId)
    : Promise.resolve({data:[] as any[]});

  const [reference, assignmentsResult, teacherScopeResult] = await Promise.all([getSchoolReferenceData(), assignmentsQuery, teacherScopeQuery]);
  const { classes, sections, subjects } = reference;

  let scopes:any[]=[];
  if(role==='teacher'){
    scopes=((teacherScopeResult.data as any[]|null)||[]).filter((x:any)=>x.subject_id).map((a:any)=>({class_id:a.class_id,section_id:a.section_id,class_name:a.classes?.name||'',grade:a.classes?.grade||0,section_name:a.sections?.name||'Whole class',subject_id:a.subject_id,subject_name:a.subjects?.name||'',subject_code:a.subjects?.code||''}));
  } else if(role==='admin'){
    scopes=(classes||[]).flatMap(c=>(sections||[]).filter(s=>s.class_id===c.id).flatMap(s=>(subjects||[]).map(sub=>({class_id:c.id,section_id:s.id,class_name:c.name,grade:c.grade,section_name:s.name,subject_id:sub.id,subject_name:sub.name,subject_code:sub.code}))));
  }

  // Split the embedded submissions back out into the shape the component expects.
  const assignments:any[]=[]; const submissionMap:Record<string,any[]>={};
  for(const row of ((assignmentsResult.data as any[]|null)||[])){
    const { assignment_submissions, ...assignment } = row;
    assignments.push(assignment);
    if(assignment_submissions?.length) submissionMap[assignment.id]=assignment_submissions;
  }
  return <Shell role={role}><AssignmentsManagement role={role} assignments={assignments} scopes={scopes} subjects={subjects||[]} submissions={submissionMap}/></Shell>;
}
function Shell({role,children}:{role:string;children:React.ReactNode}){return <div className="app-shell"><Sidebar role={role}/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>Assignments</h1><p>{role==='student'?'Your published classwork, deadlines and submissions.':'Create, publish and review assignments within your teaching scope.'}</p></div><div className="security-chip"><ShieldCheck size={16}/> {role==='admin'?'Admin access':role==='teacher'?'Teaching scope':'Personal assignments'}</div></div>{children}</div></main></div>}
const demoScopes=[{class_id:'c8',section_id:'s8a',class_name:'Grade 8',grade:8,section_name:'A',subject_id:'sub1',subject_name:'English',subject_code:'ENG'}];
const demoSubjects=[{id:'sub1',name:'English',code:'ENG'}];
