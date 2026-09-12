import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import DiscussionsManagement from '@/components/discussions-management';
import { createClient } from '@/lib/supabase/server';

export default async function DiscussionsPage(){
  const supabase=await createClient();
  if(!supabase) return <Shell role="admin"><DiscussionsManagement role="admin" threads={demoThreads} replies={[]} votes={[]} pollOptions={[]} scopes={demoScopes}/></Shell>;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return <Shell role="student"><div className="empty-panel"><h3>Please sign in</h3></div></Shell>;
  const {data:me}=await supabase.from('profiles').select('role,is_active').eq('id',user.id).single();
  const role=me?.role||'student';
  let scopes:any[]=[];
  if(role==='teacher'){
    const {data}=await supabase.from('teacher_assignments').select('id,class_id,section_id,classes(name),sections(name)').eq('teacher_id',user.id);
    scopes=(data||[]).map((x:any)=>({class_id:x.class_id,section_id:x.section_id,class_name:x.classes?.name||'',section_name:x.sections?.name||'Whole class',label:`${x.classes?.name||'Class'} · ${x.sections?.name||'Whole class'}`}));
  } else if(role==='student'){
    const {data}=await supabase.from('student_enrollments').select('class_id,section_id,classes(name),sections(name)').eq('student_id',user.id).eq('is_active',true).limit(1).single();
    if(data) scopes=[{class_id:data.class_id,section_id:data.section_id,class_name:(data as any).classes?.name||'',section_name:(data as any).sections?.name||'',label:`${(data as any).classes?.name||'Class'} · ${(data as any).sections?.name||'Section'}`}];
  } else {
    const {data:c}=await supabase.from('classes').select('id,name'); const {data:s}=await supabase.from('sections').select('id,name,class_id');
    scopes=(c||[]).flatMap((x:any)=>(s||[]).filter((z:any)=>z.class_id===x.id).map((z:any)=>({class_id:x.id,section_id:z.id,class_name:x.name,section_name:z.name,label:`${x.name} · ${z.name}`})));
  }
  const select='id,author_id,audience,class_id,section_id,kind,title,body,created_at,is_locked,is_deleted,created_day,profiles!discussion_threads_author_id_fkey(full_name),classes(name),sections(name)';
  const {data:threads}=await supabase.from('discussion_threads').select(select).eq('is_deleted',false).order('created_at',{ascending:false});
  const ids=(threads||[]).map((t:any)=>t.id);
  let replies:any[]=[],votes:any[]=[],pollOptions:any[]=[];
  if(ids.length){
    const [{data:r},{data:v},{data:o}]=await Promise.all([
      supabase.from('discussion_replies').select('id,thread_id,author_id,body,created_at,profiles!discussion_replies_author_id_fkey(full_name)').in('thread_id',ids).eq('is_deleted',false).order('created_at'),
      supabase.from('discussion_poll_votes').select('id,thread_id,option_id,voter_id,created_at').in('thread_id',ids),
      supabase.from('discussion_poll_options').select('id,thread_id,label,position').in('thread_id',ids).order('position')
    ]); replies=r||[];votes=v||[];pollOptions=o||[];
  }
  return <Shell role={role}><DiscussionsManagement role={role} threads={threads||[]} replies={replies} votes={votes} pollOptions={pollOptions} scopes={scopes}/></Shell>;
}
function Shell({role,children}:{role:string;children:React.ReactNode}){return <div className="app-shell"><Sidebar role={role}/><main className="main"><div className="content"><div className="page-head"><div><Link href="/dashboard" className="back-link"><ArrowLeft size={16}/> Dashboard</Link><h1>Discussions</h1><p>{role==='student'?'Ask questions, share ideas and vote with your school community.':'Create and participate in class and school-wide conversations.'}</p></div><div className="security-chip"><ShieldCheck size={16}/> {role==='admin'?'Moderation access':role==='teacher'?'Teaching scope':'Student community'}</div></div>{children}</div></main></div>}
const demoScopes=[{class_id:'c8',section_id:'s8a',class_name:'Grade 8',section_name:'A',label:'Grade 8 · A'}];
const demoThreads=[{id:'demo1',author_id:'demo',audience:'school',class_id:null,section_id:null,kind:'thread',title:'Welcome to the Champion community',body:'Use this space for study questions, ideas and helpful conversations.',created_at:new Date().toISOString(),is_locked:false,is_deleted:false,profiles:{full_name:'School Admin'},classes:null,sections:null}];
