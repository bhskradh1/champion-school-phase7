import Link from 'next/link';

import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck2,
  ChevronDown,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
  Users,
  UserRoundCheck,
} from 'lucide-react';

import Sidebar from '@/components/sidebar';
import SignOut from '@/components/sign-out';
import NotificationBell from '@/components/notification-bell';
import { getCurrentUser } from '@/lib/auth/current-user';

export default async function Dashboard() {
  /*
   * PERFORMANCE:
   *
   * OLD: getUser() [network call to Supabase Auth]
   *        -> profile query
   *          -> role queries             = 4 round trips in a row
   *
   * NEW: getCurrentUser() [verifies the token locally + 1 profile query]
   *        -> ALL role queries at the same time  = 2 round trips
   */
  const { supabase, userId, profile, claims } = await getCurrentUser();

  let displayName = 'School Admin';
  let role = 'admin';

  let enrollment: any = null;
  let assignments: any[] = [];
  let pending = 0;
  let marksPending = 0;
  let overview: Overview = { teachers: 0, classes: 0, present: 0, absent: 0, late: 0, submitted: 0, corrections: 0, published: 0 };
  let studentCount = 0;
  let unreadNotifications = 0;

  if (supabase && userId) {
    const email = (claims as { email?: string } | null)?.email;

    displayName =
      profile?.full_name ||
      email?.split('@')[0] ||
      displayName;

    role = profile?.role || role;

    // Filtering by recipient_id lets Postgres use the notifications index.
    const unreadQuery = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null);

    const pendingQuery = () =>
      supabase
        .from('student_approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

    if (role === 'student') {
      const [unreadResult, enrollmentResult] = await Promise.all([
        unreadQuery,
        supabase
          .from('student_enrollments')
          .select(
            'admission_no,roll_no,classes(name,grade),sections(name),academic_years(name)'
          )
          .eq('student_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      unreadNotifications = unreadResult.count || 0;
      enrollment = enrollmentResult.data;
    } else if (role === 'teacher') {
      const [unreadResult, assignmentsResult, pendingResult, marksResult] =
        await Promise.all([
          unreadQuery,
          supabase
            .from('teacher_assignments')
            .select(
              'id,class_id,section_id,subject_id,is_class_teacher,classes(name,grade),sections(name),subjects(name)'
            )
            .eq('teacher_id', userId),
          pendingQuery(),
          // Mark sheets waiting for this teacher (only for exams that are open).
          supabase
            .from('exam_mark_sheets')
            .select('id,examinations!inner(status)', { count: 'exact', head: true })
            .in('status', ['draft', 'changes_requested'])
            .eq('examinations.status', 'open'),
        ]);

      unreadNotifications = unreadResult.count || 0;
      assignments = assignmentsResult.data || [];
      pending = pendingResult.count || 0;
      marksPending = marksResult.count || 0;
    } else if (role === 'admin') {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });
      const count = (table: string) => supabase.from(table).select('id', { count: 'exact', head: true });
      const attendanceOn = (status: string) =>
        supabase
          .from('attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('attendance_date', today)
          .eq('status', status);

      // Every number on the admin dashboard is fetched at the same time.
      const [
        unreadResult, studentCountResult, pendingResult,
        teachersResult, classesResult,
        presentResult, absentResult, lateResult,
        submittedResult, correctionsResult, publishedResult,
      ] = await Promise.all([
        unreadQuery,
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'student')
          .eq('is_active', true),
        pendingQuery(),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'teacher')
          .eq('is_active', true),
        count('classes'),
        attendanceOn('present'),
        attendanceOn('absent'),
        attendanceOn('late'),
        supabase.from('exam_mark_sheets').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('exam_mark_sheets').select('id', { count: 'exact', head: true }).eq('status', 'changes_requested'),
        supabase.from('exam_results').select('id', { count: 'exact', head: true }).eq('is_published', true),
      ]);

      unreadNotifications = unreadResult.count || 0;
      studentCount = studentCountResult.count || 0;
      pending = pendingResult.count || 0;
      overview = {
        teachers: teachersResult.count || 0,
        classes: classesResult.count || 0,
        present: presentResult.count || 0,
        absent: absentResult.count || 0,
        late: lateResult.count || 0,
        submitted: submittedResult.count || 0,
        corrections: correctionsResult.count || 0,
        published: publishedResult.count || 0,
      };

    } else {
      unreadNotifications = (await unreadQuery).count || 0;
    }
  }

  const first =
    displayName.split(' ')[0];

  const initials =
    displayName
      .split(' ')
      .map(
        (x) => x[0]
      )
      .slice(0, 2)
      .join('');

  return (
    <div className="app-shell">
      <Sidebar role={role} />

      <main className="main">
        <header className="topbar">
          <div className="top-actions">
            <NotificationBell
              initialUnread={unreadNotifications}
            />

            {role === 'admin' && (
              <SignOut />
            )}

            <div className="top-profile">
              <div className="avatar">
                {initials}
              </div>

              <span>
                {role === 'admin'
                  ? 'Admin'
                  : displayName}
              </span>

              <ChevronDown size={16} />
            </div>
          </div>
        </header>

        <div className="content">
          {role === 'admin' ? (
            <AdminDashboard
              first={first}
              pending={pending}
              overview={overview}
              studentCount={
                studentCount
              }
            />
          ) : role === 'teacher' ? (
            <TeacherDashboard
              first={first}
              assignments={
                assignments
              }
              pending={pending}
              marksPending={marksPending}
            />
          ) : (
            <StudentDashboard
              first={first}
              enrollment={
                enrollment
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}

type Overview = {
  teachers: number;
  classes: number;
  present: number;
  absent: number;
  late: number;
  submitted: number;
  corrections: number;
  published: number;
};

function Bars({ rows }: { rows: [string, number, string][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="bars">
      {rows.map(([label, value, color]) => (
        <div className="bar-row" key={label}>
          <span>{label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(value / max) * 100}%`, background: color }} />
          </div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function AdminDashboard({
  first,
  pending,
  studentCount,
  overview,
}: {
  first: string;
  pending: number;
  studentCount: number;
  overview: Overview;
}) {
  return (
    <>
      <section className="welcome">
        <div>
          <span className="section-kicker">
            SCHOOL ADMINISTRATION
          </span>

          <h1>
            Good afternoon, {first}{' '}
            <span>👋</span>
          </h1>

          <p>
            Here’s what is happening
            across Champion English
            School today.
          </p>
        </div>

        <div className="security-chip">
          <ShieldCheck size={16} />
          Secure admin workspace
        </div>
      </section>

      <section className="stat-grid">
        {(
          [
            [
              'Active students',
              String(
                studentCount
              ),
              'Live from Supabase',
              GraduationCap,
              'blue',
            ],

            [
              'Pending approvals',
              String(pending),
              'Needs review',
              UserRoundCheck,
              'rose',
            ],

            [
              'Teachers',
              String(overview.teachers),
              'Active teachers',
              Users,
              'violet',
            ],

            [
              'Classes',
              String(overview.classes),
              'Manage academic structure',
              BookOpen,
              'amber',
            ],
          ] as [
            string,
            string,
            string,
            typeof GraduationCap,
            string
          ][]
        ).map(
          ([
            label,
            value,
            delta,
            Icon,
            tone,
          ]) => (
            <div
              className={
                'stat-card'
              }
              key={String(label)}
            >
              <div
                className={
                  'stat-icon ' +
                  tone
                }
              >
                <Icon size={20} />
              </div>

              <div className="stat-copy">
                <span>
                  {label}
                </span>

                <strong>
                  {value}
                </strong>

                <small>
                  {delta}
                </small>
              </div>

              <ArrowUpRight
                className="stat-arrow"
                size={17}
              />
            </div>
          )
        )}
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Today&apos;s attendance</h3>
              <p>Students marked so far today.</p>
            </div>
            <Link className="ghost-btn" href="/reports">Reports <ArrowUpRight size={15} /></Link>
          </div>
          <Bars
            rows={[
              ['Present', overview.present, '#2ea86b'],
              ['Absent', overview.absent, '#e0566f'],
              ['Late', overview.late, '#e6a23c'],
            ]}
          />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Examinations</h3>
              <p>Marks waiting for you.</p>
            </div>
            <Link className="ghost-btn" href="/examinations">Open <ArrowUpRight size={15} /></Link>
          </div>
          <Bars
            rows={[
              ['Waiting to verify', overview.submitted, '#e6a23c'],
              ['Correction requested', overview.corrections, '#e0566f'],
              ['Published results', overview.published, '#2ea86b'],
            ]}
          />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>
                Student management
              </h3>

              <p>
                Register, assign and
                maintain student records.
              </p>
            </div>

            <Link
              className="ghost-btn"
              href="/students"
            >
              Open directory
              <ArrowUpRight size={15} />
            </Link>
          </div>

          <div className="quick-grid">
            <Link href="/students">
              <GraduationCap size={18} />

              <strong>
                Students
              </strong>

              <span>
                Registration & enrollment
              </span>
            </Link>

            <Link href="/classes">
              <BookOpen size={18} />

              <strong>
                Classes
              </strong>

              <span>
                Sections & subjects
              </span>
            </Link>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>
                Security model
              </h3>

              <p>
                Authorization is
                enforced in PostgreSQL.
              </p>
            </div>

            <ShieldCheck size={18} />
          </div>

          <div className="security-list">
            <div>
              <ShieldCheck size={16} />

              <span>
                Admin actions
              </span>

              <strong>
                RLS + role check
              </strong>
            </div>

            <div>
              <ShieldCheck size={16} />

              <span>
                Class teacher approvals
              </span>

              <strong>
                Class/section scoped
              </strong>
            </div>

            <div>
              <ShieldCheck size={16} />

              <span>
                Student data
              </span>

              <strong>
                Teaching-scope read
              </strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function TeacherDashboard({
  first,
  assignments,
  pending,
  marksPending,
}: {
  first: string;
  assignments: any[];
  pending: number;
  marksPending: number;
}) {
  return (
    <>
      <section className="welcome">
        <div>
          <span className="section-kicker">
            TEACHER PORTAL
          </span>

          <h1>
            Welcome, {first}{' '}
            <span>👋</span>
          </h1>

          <p>
            Your workspace is limited
            to classes and sections
            assigned to you.
          </p>
        </div>

        <div className="security-chip">
          <ShieldCheck size={16} />
          Teaching scope enforced
        </div>
      </section>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <BookOpen size={20} />
          </div>

          <div className="stat-copy">
            <span>
              My assignments
            </span>

            <strong>
              {assignments.length}
            </strong>

            <small>
              Classes / subjects
            </small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon rose">
            <UserRoundCheck
              size={20}
            />
          </div>

          <div className="stat-copy">
            <span>
              Pending approvals
            </span>

            <strong>
              {pending}
            </strong>

            <small>
              Only requests visible by
              RLS
            </small>
          </div>
        </div>

        <Link
          href="/examinations"
          className="stat-card"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="stat-icon blue">
            <FileCheck2 size={20} />
          </div>

          <div className="stat-copy">
            <span>Marks to enter</span>

            <strong>{marksPending}</strong>

            <small>
              {marksPending > 0
                ? 'Open Examinations to enter marks'
                : 'No mark sheets waiting'}
            </small>
          </div>
        </Link>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>
              My classes & subjects
            </h3>

            <p>
              Only your assigned
              teaching scope is shown.
            </p>
          </div>
        </div>

        <div className="assignment-list">
          {assignments.map((a) => (
            <div
              className="assignment-row"
              key={a.id}
            >
              <div className="avatar student">
                <BookOpen size={15} />
              </div>

              <div className="person">
                <strong>
                  {a.classes
                    ? `Class ${a.classes.grade} · ${
                        a.sections?.name ||
                        'Whole class'
                      }`
                    : 'Assigned class'}
                </strong>

                <span>
                  {a.subjects?.name ||
                    'Class teacher'}

                  {a.is_class_teacher
                    ? ' · Class teacher'
                    : ''}
                </span>
              </div>
            </div>
          ))}

          {!assignments.length && (
            <div className="empty-mini">
              No teaching assignments
              have been configured yet.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function StudentDashboard({
  first,
  enrollment,
}: {
  first: string;
  enrollment: any;
}) {
  const c =
    enrollment?.classes;

  const sec =
    enrollment?.sections;

  const year =
    enrollment?.academic_years;

  return (
    <>
      <section className="welcome">
        <div>
          <span className="section-kicker">
            STUDENT PORTAL
          </span>

          <h1>
            Hello, {first}{' '}
            <span>👋</span>
          </h1>

          <p>
            Your school information,
            attendance, assignments and
            results will appear here.
          </p>
        </div>

        <div className="security-chip">
          <ShieldCheck size={16} />
          Account secured
        </div>
      </section>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <GraduationCap size={20} />
          </div>

          <div className="stat-copy">
            <span>
              Current class
            </span>

            <strong>
              {c
                ? `Class ${c.grade}`
                : '—'}
            </strong>

            <small>
              {sec?.name
                ? `Section ${sec.name}`
                : 'Not assigned'}
            </small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon violet">
            <BookOpen size={20} />
          </div>

          <div className="stat-copy">
            <span>
              Academic year
            </span>

            <strong>
              {year?.name || '—'}
            </strong>

            <small>
              {enrollment?.admission_no
                ? `Admission ${enrollment.admission_no}`
                : 'Enrollment pending'}
            </small>
          </div>
        </div>
      </section>

      <section className="quick-grid big">
        <Link href="/attendance">
          <CalendarCheck2 size={20} />

          <strong>
            Attendance
          </strong>

          <span>
            View your attendance record
          </span>
        </Link>

        <Link href="/assignments">
          <ClipboardList size={20} />

          <strong>
            Assignments
          </strong>

          <span>
            See work given by teachers
          </span>
        </Link>

        <Link href="/discussions">
          <MessageSquareText size={20} />

          <strong>
            Discussions
          </strong>

          <span>
            Talk with your class
          </span>
        </Link>

        <Link href="/results">
          <GraduationCap size={20} />

          <strong>
            Results
          </strong>

          <span>
            View published exam results
          </span>
        </Link>
      </section>
    </>
  );
}
