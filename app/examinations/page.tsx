import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import ExaminationsManagement from '@/components/examinations-management';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getSchoolReferenceData } from '@/lib/supabase/cache';

export default async function ExaminationsPage(){
  // PERFORMANCE: token verified locally + profile in one query (was: getUser network call, then profile query)
  const {supabase,userId,profile}=await getCurrentUser();
  if(!supabase) return <Shell role="admin"><ExaminationsManagement role="admin" exams={demoExams} sheets={[]} marks={[]} results={[]} classes={demoClasses} sections={demoSections} subjects={demoSubjects} years={demoYears}/></Shell>;
  if(!userId) return <Shell role="student"><div className="empty-panel"><h3>Please sign in</h3></div></Shell>;
  const role=profile?.role||'student';
  // Marks entry and exam management are for teachers and admins only. Students see their published results on /results.
  if(role==='student') redirect('/dashboard');

  // PERFORMANCE: reference data and the exam list are independent, so fetch them together.
  const [reference, examsResult] = await Promise.all([
    getSchoolReferenceData(),
    supabase.from('examinations').select('id,academic_year_id,term,name,starts_on,ends_on,marks_deadline,status,created_at').order('starts_on',{ascending:false,nullsFirst:false}),
  ]);
  const { classes, sections, subjects, years } = reference;
  const list:any[]=(examsResult.data as any[]|null)||[];
  const examId=list[0]?.id;
  let sheets:any[]=[],marks:any[]=[],results:any[]=[];

  if(examId){
    // PERFORMANCE: mark sheets and results are independent, so fetch them together (was: one after another).
    const [sheetsResult, resultsResult] = await Promise.all([
      supabase.from('exam_mark_sheets').select('id,examination_id,class_id,section_id,subject_id,teacher_id,status,submitted_at,verified_at,review_note,classes(name,grade),sections(name),subjects(name,code),profiles!exam_mark_sheets_teacher_id_fkey(full_name)').eq('examination_id',examId),
      supabase.from('exam_results').select('id,examination_id,student_id,class_id,section_id,total_marks,total_max_marks,percentage,grade,gpa,result_status,failed_subjects,rank,is_published,profiles!exam_results_student_id_fkey(full_name),classes(name),sections(name)').eq('examination_id',examId).order('rank'),
    ]);
    sheets=(sheetsResult.data as any[]|null)||[];
    results=(resultsResult.data as any[]|null)||[];
    const ids=sheets.map(x=>x.id);
    if(ids.length){
      const {data:m}=await supabase.from('exam_marks').select('id,mark_sheet_id,student_id,enrollment_id,marks,max_marks,remarks,profiles!exam_marks_student_id_fkey(full_name)').in('mark_sheet_id',ids);
      marks=m||[];
    }
  }
  return <Shell role={role}><ExaminationsManagement role={role} exams={list} sheets={sheets} marks={marks} results={results} classes={classes||[]} sections={sections||[]} subjects={subjects||[]} years={years||[]}/></Shell>;
}
function Shell({role,children}:{role:string;children:React.ReactNode}){return <div className="app-shell"><Sidebar role={role}/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>Examinations & Results</h1><p>Manage mark entry, verification, result generation and publication.</p></div><div className="security-chip"><ShieldCheck size={16}/> {role==='admin'?'Admin control':role==='teacher'?'Teacher mark entry':'Published results'}</div></div>{children}</div></main></div>}
const demoYears=[{id:'y1',name:'2083 BS / 2026-27',is_current:true}],demoClasses=[{id:'c8',name:'Grade 8',grade:8}],demoSections=[{id:'s8a',name:'A',class_id:'c8'}],demoSubjects=[{id:'sub1',name:'English',code:'ENG'}],demoExams=[{id:'e1',name:'Terminal Examination',term:'terminal',status:'open'}];
