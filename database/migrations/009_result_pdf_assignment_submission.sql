-- Champion English School | Phase 8: Result PDF templates, Assignment submissions, Production hardening
-- Run after 007_examinations_results.sql and 005_assignments.sql

-- ============================================================================
-- 1. ASSIGNMENT SUBMISSIONS ENHANCEMENTS
-- ============================================================================

-- Add submission tracking and grading to assignments
alter table public.assignments 
add column if not exists max_marks numeric(5,2) default 100 check (max_marks > 0),
add column if not exists allow_late_submission boolean default false,
add column if not exists late_penalty_percent numeric(5,2) default 0 check (late_penalty_percent >= 0 and late_penalty_percent <= 100);

-- Enhanced assignment_submissions table
alter table public.assignment_submissions
add column if not exists submitted_at timestamptz,
add column if not exists grade numeric(5,2),
add column if not exists max_marks numeric(5,2),
add column if not exists feedback text,
add column if not exists graded_at timestamptz,
add column if not exists graded_by uuid references public.profiles(id) on delete set null,
add column if not exists status public.submission_status default 'submitted';

-- File attachments for submissions (stored in object storage)
create table if not exists public.assignment_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  file_url text not null,
  mime_type text not null default 'application/octet-stream',
  file_size bigint not null check (file_size > 0),
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id) on delete cascade
);

create index idx_submission_files_submission on public.assignment_submission_files(submission_id);

-- Assignment submission history for audit
create table if not exists public.assignment_submission_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  action text not null check (action in ('submitted', 'updated', 'graded', 'feedback_added', 'file_uploaded')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_submission_history_submission on public.assignment_submission_history(submission_id);

-- ============================================================================
-- 2. RESULT PDF TEMPLATES & CONFIGURATION
-- ============================================================================

-- School branding and PDF configuration
create table if not exists public.result_pdf_templates (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references public.academic_years(id) on delete set null,
  template_name text not null unique check (char_length(trim(template_name)) between 2 and 100),
  header_text text default 'CHAMPION ENGLISH SCHOOL',
  sub_header_text text default 'Dharan-15, Sunsari, Nepal',
  footer_left text default 'Class Teacher',
  footer_right text default 'Principal/Admin',
  logo_url text,
  include_attendance boolean default true,
  include_grade_point boolean default false,
  grading_scale jsonb default '{"A+": 90, "A": 80, "B+": 70, "B": 60, "C+": 50, "C": 40, "F": 0}'::jsonb,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_result_templates_year on public.result_pdf_templates(academic_year_id, is_active);

-- Generated PDF records for tracking
create table if not exists public.generated_result_pdfs (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.exam_results(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  examination_id uuid not null references public.examinations(id) on delete cascade,
  pdf_url text not null,
  file_size bigint,
  generated_by uuid not null references public.profiles(id) on delete cascade,
  generated_at timestamptz not null default now()
);

create index idx_generated_pdfs_result on public.generated_result_pdfs(result_id);
create index idx_generated_pdfs_student on public.generated_result_pdfs(student_id, examination_id);

-- Bulk PDF generation jobs
create type public.pdf_job_status as enum ('pending', 'processing', 'completed', 'failed');

create table if not exists public.result_pdf_jobs (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  section_id uuid references public.sections(id) on delete cascade,
  status public.pdf_job_status not null default 'pending',
  total_students integer default 0,
  processed_count integer default 0,
  failed_count integer default 0,
  zip_file_url text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_pdf_jobs_exam on public.result_pdf_jobs(examination_id, status);
create index idx_pdf_jobs_created on public.result_pdf_jobs(created_at desc);

-- Individual PDF job items
create table if not exists public.result_pdf_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.result_pdf_jobs(id) on delete cascade,
  result_id uuid not null references public.exam_results(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  pdf_url text,
  status text not null default 'pending' check (status in ('pending', 'generated', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_pdf_job_items_job on public.result_pdf_job_items(job_id, status);

-- ============================================================================
-- 3. PRODUCTION HARDENING - RATE LIMITING & SECURITY
-- ============================================================================

-- Rate limiting tracking
create table if not exists public.rate_limit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  ip_address inet,
  endpoint text not null,
  method text not null default 'GET',
  request_count integer not null default 1,
  window_start timestamptz not null default now(),
  window_end timestamptz not null,
  blocked boolean default false,
  created_at timestamptz not null default now()
);

create index idx_rate_limit_user on public.rate_limit_logs(user_id, window_start);
create index idx_rate_limit_ip on public.rate_limit_logs(ip_address, window_start);
create index idx_rate_limit_endpoint on public.rate_limit_logs(endpoint, window_start);

-- Security audit enhancements
alter table public.audit_logs
add column if not exists ip_address inet,
add column if not exists user_agent text;

create index idx_audit_logs_ip on public.audit_logs(ip_address);
create index idx_audit_logs_created_desc on public.audit_logs(created_at desc);

-- Session management
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_token text not null unique,
  expires_at timestamptz not null,
  ip_address inet,
  user_agent text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);

create index idx_user_sessions_user on public.user_sessions(user_id, is_active);
create index idx_user_sessions_token on public.user_sessions(session_token);
create index idx_user_sessions_expires on public.user_sessions(expires_at);

-- ============================================================================
-- 4. NOTIFICATION ENHANCEMENTS FOR FCM
-- ============================================================================

-- Firebase Cloud Messaging tokens
create table if not exists public.fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  device_type text check (device_type in ('android', 'ios', 'web')),
  device_name text,
  is_active boolean default true,
  last_used_at timestamptz default now(),
  created_at timestamptz not null default now(),
  unique(user_id, token)
);

create index idx_fcm_tokens_user on public.fcm_tokens(user_id, is_active);

-- Notification delivery tracking
alter table public.notifications
add column if not exists fcm_message_id text,
add column if not exists delivered_at timestamptz,
add column if not exists read_at timestamptz;

create index idx_notifications_unread on public.notifications(recipient_id, read_at, created_at desc);

-- ============================================================================
-- 5. BACKUP & MAINTENANCE UTILITIES
-- ============================================================================

-- Database backup log
create table if not exists public.backup_logs (
  id uuid primary key default gen_random_uuid(),
  backup_type text not null check (backup_type in ('full', 'incremental', 'tables_only')),
  tables_backed_up jsonb,
  file_path text,
  file_size bigint,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
);

create index idx_backup_logs_status on public.backup_logs(status, started_at);

-- System settings for production
create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique check (char_length(trim(setting_key)) between 2 and 100),
  setting_value jsonb not null,
  description text,
  is_public boolean default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index idx_system_settings_key on public.system_settings(setting_key);

-- Insert default system settings
insert into public.system_settings(setting_key, setting_value, description, is_public) values
('student_approval_mode', '"class_teacher"', 'Who can approve student registrations: class_teacher, admin, or both'),
('discussion_thread_limit', '1', 'Maximum threads a student can create per day'),
('discussion_message_limit', '20', 'Maximum messages a student can send per day'),
('assignment_max_file_size_mb', '10', 'Maximum file size for assignment submissions in MB'),
('assignment_allowed_mime_types', '["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]', 'Allowed file types for assignments'),
('rate_limit_requests_per_minute', '60', 'API rate limit per user per minute'),
('session_timeout_hours', '24', 'User session timeout in hours'),
('result_pdf_enabled', 'true', 'Enable PDF result generation'),
('fcm_enabled', 'false', 'Enable Firebase Cloud Messaging')
on conflict (setting_key) do nothing;

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to check rate limit
create or replace function public.check_rate_limit(p_endpoint text, p_method text default 'GET', p_limit integer default 60)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  v_user_id uuid := auth.uid();
  v_window_start timestamptz := now() - interval '1 minute';
  v_count integer;
begin
  select count(*) into v_count 
  from public.rate_limit_logs 
  where user_id = v_user_id 
    and window_start >= v_window_start
    and endpoint = p_endpoint;
  
  if v_count >= p_limit then
    -- Log the blocked attempt
    insert into public.rate_limit_logs(user_id, endpoint, method, request_count, window_start, blocked)
    values(v_user_id, p_endpoint, p_method, 1, v_window_start, true);
    
    return false;
  end if;
  
  -- Log this request
  insert into public.rate_limit_logs(user_id, endpoint, method, request_count, window_start)
  values(v_user_id, p_endpoint, p_method, 1, v_window_start)
  on conflict (user_id, endpoint, window_start) 
  do update set request_count = rate_limit_logs.request_count + 1;
  
  return true;
end;
$$;

grant execute on function public.check_rate_limit(text, text, integer) to authenticated;

-- Function to get student attendance for result PDF
create or replace function public.get_student_attendance_summary(
  p_student_id uuid,
  p_from_date date,
  p_to_date date
)
returns table(total_days integer, present_days integer, absent_days integer, percentage numeric) 
language plpgsql security definer set search_path=public as $$
begin
  return query
  select 
    count(*)::integer as total_days,
    count(*) filter (where ar.status = 'PRESENT')::integer as present_days,
    count(*) filter (where ar.status IN ('ABSENT', 'LATE'))::integer as absent_days,
    round(count(*) filter (where ar.status = 'PRESENT') * 100.0 / nullif(count(*), 0), 2) as percentage
  from public.attendance_records ar
  join public.attendance a on a.id = ar.attendance_id
  where ar.student_id = p_student_id
    and a.date between p_from_date and p_to_date;
end;
$$;

grant execute on function public.get_student_attendance_summary(uuid, date, date) to authenticated;

-- Function to generate individual result PDF data
create or replace function public.get_result_pdf_data(p_result_id uuid)
returns json language plpgsql security definer set search_path=public as $$
declare
  v_result record;
  v_student record;
  v_class record;
  v_section record;
  v_exam record;
  v_items jsonb;
  v_attendance jsonb;
begin
  -- Get result with related data
  select r.*, s.full_name as student_name, s.student_code,
         c.name as class_name, sec.name as section_name,
         e.name as exam_name, e.term as exam_term
  into v_result
  from public.exam_results r
  join public.profiles s on s.id = r.student_id
  join public.classes c on c.id = r.class_id
  join public.sections sec on sec.id = r.section_id
  join public.examinations e on e.id = r.examination_id
  where r.id = p_result_id;
  
  if not found then
    return null;
  end if;
  
  -- Get subject-wise marks
  select jsonb_agg(jsonb_build_object(
    'subject_name', subj.name,
    'subject_code', subj.code,
    'marks', ri.marks,
    'max_marks', ri.max_marks,
    'percentage', ri.percentage,
    'grade', ri.grade
  ) order by subj.name)
  into v_items
  from public.exam_result_items ri
  join public.subjects subj on subj.id = ri.subject_id
  where ri.result_id = p_result_id;
  
  -- Get attendance summary for exam period
  select jsonb_build_object(
    'total_days', att.total_days,
    'present_days', att.present_days,
    'absent_days', att.absent_days,
    'percentage', att.percentage
  )
  into v_attendance
  from public.get_student_attendance_summary(
    v_result.student_id,
    coalesce(v_result.starts_on, (select min(starts_on) from public.academic_years)),
    coalesce(v_result.ends_on, now())
  ) att;
  
  return jsonb_build_object(
    'student_name', v_result.student_name,
    'student_code', v_result.student_code,
    'class_name', v_result.class_name,
    'section_name', v_result.section_name,
    'exam_name', v_result.exam_name,
    'exam_term', v_result.exam_term,
    'total_marks', v_result.total_marks,
    'total_max_marks', v_result.total_max_marks,
    'percentage', v_result.percentage,
    'grade', v_result.grade,
    'rank', v_result.rank,
    'subjects', v_items,
    'attendance', v_attendance,
    'generated_at', to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
  );
end;
$$;

grant execute on function public.get_result_pdf_data(uuid) to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.assignment_submission_files enable row level security;
alter table public.assignment_submission_history enable row level security;
alter table public.result_pdf_templates enable row level security;
alter table public.generated_result_pdfs enable row level security;
alter table public.result_pdf_jobs enable row level security;
alter table public.result_pdf_job_items enable row level security;
alter table public.fcm_tokens enable row level security;
alter table public.user_sessions enable row level security;
alter table public.system_settings enable row level security;

-- Assignment submission files policies
create policy "submission files readable by owner and teachers" on public.assignment_submission_files
for select to authenticated using (
  public.is_admin() or
  uploaded_by = auth.uid() or
  exists (
    select 1 from public.assignment_submissions asub
    join public.assignments a on a.id = asub.assignment_id
    where asub.id = submission_id
      and (asub.student_id = auth.uid() or public.can_manage_exam_scope(a.class_id, a.section_id, a.subject_id))
  )
);

create policy "submission files uploadable by students" on public.assignment_submission_files
for insert to authenticated with check (
  uploaded_by = auth.uid() and
  exists (
    select 1 from public.assignment_submissions asub
    where asub.id = submission_id and asub.student_id = auth.uid()
  )
);

-- Result PDF policies
create policy "result pdf templates readable by staff" on public.result_pdf_templates
for select to authenticated using (
  public.is_admin() or me.role in ('teacher', 'admin')
);

create policy "result pdf templates manageable by admin" on public.result_pdf_templates
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "generated pdfs readable by owner and staff" on public.generated_result_pdfs
for select to authenticated using (
  public.is_admin() or
  student_id = auth.uid() or
  public.is_class_teacher_for_scope(
    (select class_id from public.exam_results where id = result_id),
    (select section_id from public.exam_results where id = result_id)
  )
);

-- PDF job policies
create policy "pdf jobs readable by staff" on public.result_pdf_jobs
for select to authenticated using (
  public.is_admin() or
  public.is_class_teacher_for_scope(class_id, section_id)
);

create policy "pdf jobs creatable by admin and class teachers" on public.result_pdf_jobs
for insert to authenticated with check (
  public.is_admin() or
  public.is_class_teacher_for_scope(class_id, section_id)
);

create policy "pdf job items readable by staff" on public.result_pdf_job_items
for select to authenticated using (
  public.is_admin() or
  exists (
    select 1 from public.result_pdf_jobs j
    where j.id = job_id and (
      public.is_admin() or
      public.is_class_teacher_for_scope(j.class_id, j.section_id)
    )
  )
);

-- FCM token policies
create policy "fcm tokens manageable by owner" on public.fcm_tokens
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- User sessions policies
create policy "user sessions readable by owner and admin" on public.user_sessions
for select to authenticated using (
  public.is_admin() or user_id = auth.uid()
);

create policy "user sessions manageable by owner" on public.user_sessions
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- System settings policies
create policy "system settings readable by authenticated" on public.system_settings
for select to authenticated using (
  is_public or public.is_admin() or me.role = 'teacher'
);

create policy "system settings manageable by admin" on public.system_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

create trigger result_pdf_templates_set_updated_at 
before update on public.result_pdf_templates 
for each row execute procedure public.set_updated_at();

create trigger system_settings_set_updated_at 
before update on public.system_settings 
for each row execute procedure public.set_updated_at();

-- Auto-update last_activity on user_sessions
create or replace function public.update_session_activity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.last_activity := now();
  return new;
end;
$$;

create trigger user_sessions_update_activity
before update on public.user_sessions
for each row execute procedure public.update_session_activity();

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table public.assignment_submission_files is 'File attachments for assignment submissions stored in object storage';
comment on table public.result_pdf_templates is 'Configurable templates for generating result PDFs';
comment on table public.generated_result_pdfs is 'Records of generated result PDFs with storage URLs';
comment on table public.result_pdf_jobs is 'Bulk PDF generation jobs for class/section results';
comment on table public.fcm_tokens is 'Firebase Cloud Messaging tokens for push notifications';
comment on table public.rate_limit_logs is 'API rate limiting tracking for security';
comment on table public.user_sessions is 'Active user sessions for security management';
comment on table public.system_settings is 'Application-wide configuration settings';
