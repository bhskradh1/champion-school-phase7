import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

import Sidebar from '@/components/sidebar';
import AttendanceManagement, {
  AttendanceStudentView,
} from '@/components/attendance-management';

import { getCurrentUser } from '@/lib/auth/current-user';
import { getSchoolReferenceData } from '@/lib/supabase/cache';

export default async function AttendancePage() {
  /*
   * PERFORMANCE: getCurrentUser() verifies the login token locally and loads
   * the profile in ONE query. Before, this page made a network call to
   * Supabase Auth (getUser) and THEN a separate profile query.
   */
  const { supabase, userId, profile } = await getCurrentUser();

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  /*
   * Demo/fallback mode.
   */
  if (!supabase) {
    return (
      <Shell role="admin">
        <AttendanceManagement
          role="admin"
          scopes={demoScopes}
          classes={[]}
          sections={[]}
          studentsByScope={demoRoster}
          initialRecords={{}}
          initialDate={today}
        />
      </Shell>
    );
  }

  if (!userId) {
    return (
      <Shell role="student">
        <div className="empty-panel">
          <h3>Please sign in</h3>
        </div>
      </Shell>
    );
  }

  const role = profile?.role || 'student';

  /*
   * Students only need their own attendance.
   *
   * This is already a single query, so keep it simple.
   */
  if (role === 'student') {
    const { data: records } = await supabase
      .from('attendance_records')
      .select(
        `
          id,
          attendance_date,
          status,
          note,
          class_id,
          section_id,
          classes(name,grade),
          sections(name)
        `
      )
      .eq('student_id', userId)
      .order('attendance_date', {
        ascending: false,
      });

    return (
      <Shell role={role}>
        <AttendanceStudentView
          records={records || []}
        />
      </Shell>
    );
  }

  /*
   * Reference data and (for teachers) their class-teacher assignments
   * are independent, so load them at the same time.
   */
  const [reference, assignmentsResult] = await Promise.all([
    getSchoolReferenceData(),

    role === 'teacher'
      ? supabase
          .from('teacher_assignments')
          .select(
            `
              class_id,
              section_id,
              is_class_teacher,
              classes(name,grade),
              sections(name)
            `
          )
          .eq('teacher_id', userId)
          .eq('is_class_teacher', true)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const assignments: any[] =
    (assignmentsResult.data as any[] | null) || [];

  const { classes, sections } = reference;

  /*
   * Build the sections the current user is allowed to see.
   */
  const scopes = (
    role === 'admin'
      ? (sections || [])
          .map((section) => {
            const classInfo = (classes || []).find(
              (classItem) =>
                classItem.id === section.class_id
            );

            if (!classInfo) {
              return null;
            }

            return {
              class_id: classInfo.id,
              section_id: section.id,
              class_name: classInfo.name,
              grade: classInfo.grade,
              section_name: section.name,
            };
          })
          .filter(Boolean)
      : assignments
          .map((assignment) => {
            if (!assignment.sections) {
              return null;
            }

            return {
              class_id: assignment.class_id,
              section_id: assignment.section_id,
              class_name:
                assignment.classes?.name || '',
              grade:
                assignment.classes?.grade || 0,
              section_name:
                assignment.sections?.name || '',
            };
          })
          .filter(Boolean)
  ) as any[];

  /*
   * Nothing to load.
   */
  if (scopes.length === 0) {
    return (
      <Shell role={role}>
        <AttendanceManagement
          role={role}
          scopes={[]}
          classes={classes || []}
          sections={sections || []}
          studentsByScope={{}}
          initialRecords={{}}
          initialDate={today}
        />
      </Shell>
    );
  }

  /*
   * ============================================================
   * MAJOR PERFORMANCE FIX
   * ============================================================
   *
   * OLD:
   *
   * for every section:
   *   query enrollments
   *   query attendance
   *
   * If there were 10 sections:
   *
   *   10 enrollment queries
   *   10 attendance queries
   *   = 20 database queries
   *
   * NEW:
   *
   *   1 enrollment query
   *   1 attendance query
   *
   * Then we group everything in memory.
   */

  const sectionFilters = scopes
    .map(
      (scope) =>
        `and(class_id.eq.${scope.class_id},section_id.eq.${scope.section_id})`
    )
    .join(',');

  const [
    enrollmentsResult,
    recordsResult,
  ] = await Promise.all([
    /*
     * Get all active enrollments for the authorized
     * class/section combinations.
     */
    supabase
      .from('student_enrollments')
      .select(
        `
          student_id,
          class_id,
          section_id,
          admission_no,
          roll_no,
          profiles!student_enrollments_student_id_fkey(
            id,
            full_name
          )
        `
      )
      .eq('is_active', true)
      .or(sectionFilters),

    /*
     * Get TODAY's attendance for all authorized sections
     * in one request. Other dates are loaded on demand by the
     * component when the teacher picks a different date.
     */
    supabase
      .from('attendance_records')
      .select(
        `
          student_id,
          class_id,
          section_id,
          status,
          note,
          attendance_date
        `
      )
      .eq('attendance_date', today)
      .or(sectionFilters),
  ]);

  /*
   * ============================================================
   * Build student rosters by section.
   * ============================================================
   */
  const studentsByScope: Record<
    string,
    any[]
  > = {};

  for (const scope of scopes) {
    studentsByScope[
      `${scope.class_id}:${scope.section_id}`
    ] = [];
  }

  for (const enrollment of enrollmentsResult.data || []) {
    const key = `${enrollment.class_id}:${enrollment.section_id}`;

    if (!studentsByScope[key]) {
      studentsByScope[key] = [];
    }

    studentsByScope[key].push({
      id: enrollment.student_id,
      full_name:
        (enrollment.profiles as any)?.full_name ||
        'Student',
      admission_no: enrollment.admission_no,
      roll_no: enrollment.roll_no,
    });
  }

  /*
   * Sort each section once.
   */
  for (const key of Object.keys(
    studentsByScope
  )) {
    studentsByScope[key].sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  }

  /*
   * ============================================================
   * Build attendance records grouped by:
   *
   * class + section + date
   * ============================================================
   */
  const initialRecords: Record<
    string,
    any[]
  > = {};

  for (const record of recordsResult.data || []) {
    const key =
      `${record.class_id}:` +
      `${record.section_id}:` +
      `${record.attendance_date}`;

    if (!initialRecords[key]) {
      initialRecords[key] = [];
    }

    initialRecords[key].push({
      student_id: record.student_id,
      status: record.status,
      note: record.note,
    });
  }

  return (
    <Shell role={role}>
      <AttendanceManagement
        role={role}
        scopes={scopes}
        classes={classes || []}
        sections={sections || []}
        studentsByScope={studentsByScope}
        initialRecords={initialRecords}
        initialDate={today}
      />
    </Shell>
  );
}

function Shell({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <Sidebar role={role} />

      <main className="main">
        <div className="content">
          <div className="page-head">
            <div>
              <Link
                href="/dashboard"
                className="back-link"
              >
                <ArrowLeft size={16} />
                Dashboard
              </Link>

              <h1>Attendance</h1>

              <p>
                {role === 'student'
                  ? 'Your attendance history, including exact absence dates.'
                  : 'Record daily attendance for your authorized class sections.'}
              </p>
            </div>

            <div className="security-chip">
              <ShieldCheck size={16} />

              {role === 'admin'
                ? 'Admin access'
                : role === 'teacher'
                ? 'Class-teacher scope'
                : 'Personal record'}
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

/*
 * Demo/fallback data.
 */
const demoScopes = [
  {
    class_id: 'c8',
    section_id: 's8a',
    class_name: 'Grade 8',
    grade: 8,
    section_name: 'A',
  },
];

const demoRoster: Record<
  string,
  any[]
> = {
  'c8:s8a': [
    {
      id: 'demo-1',
      full_name: 'Aarav Sharma',
      admission_no: 'CES-001',
      roll_no: 1,
    },
    {
      id: 'demo-2',
      full_name: 'Saanvi Rai',
      admission_no: 'CES-002',
      roll_no: 2,
    },
  ],
};
