import Link from 'next/link';
import {
  ArrowLeft,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';

import Sidebar from '@/components/sidebar';
import StudentResults from '@/components/student-results';
import { getCurrentUser } from '@/lib/auth/current-user';

export default async function ResultsPage() {
  const {
    supabase,
    userId,
    profile,
  } = await getCurrentUser();

  /*
   * Supabase is not configured.
   */
  if (!supabase) {
    return (
      <Shell>
        <div className="empty-panel">
          <GraduationCap size={28} />

          <h3>Preview results</h3>

          <p>
            Connect Supabase to view
            published student results.
          </p>
        </div>
      </Shell>
    );
  }

  /*
   * No authenticated user.
   */
  if (!userId) {
    return (
      <Shell>
        <div className="empty-panel">
          <h3>Please sign in</h3>
        </div>
      </Shell>
    );
  }

  const role =
    profile?.role || 'student';

  /*
   * Query published results ONCE.
   */
  const {
    data: results,
    error: resultsError,
  } = await supabase
    .from('exam_results')
    .select(`
      id,
      examination_id,
      total_marks,
      total_max_marks,
      percentage,
      grade,
      rank,
      is_published,
      generated_at,
      examinations(
        name,
        term,
        starts_on
      ),
      classes(
        name
      ),
      sections(
        name
      )
    `)
    .eq(
      'student_id',
      userId
    )
    .eq(
      'is_published',
      true
    )
    .order(
      'generated_at',
      {
        ascending: false,
      }
    );

  if (resultsError) {
    return (
      <Shell role={role}>
        <div className="empty-panel">
          <GraduationCap size={28} />

          <h3>
            Unable to load results
          </h3>

          <p>
            {resultsError.message}
          </p>
        </div>
      </Shell>
    );
  }

  const safeResults =
    results || [];

  /*
   * Extract result IDs from the results
   * we already fetched.
   *
   * No duplicate exam_results query.
   */
  const resultIds =
    safeResults.map(
      (result) => result.id
    );

  let items: any[] = [];

  /*
   * Only query result items when there
   * are actually published results.
   */
  if (resultIds.length > 0) {
    const {
      data: resultItems,
      error: itemsError,
    } = await supabase
      .from('exam_result_items')
      .select(`
        id,
        result_id,
        subject_id,
        marks,
        max_marks,
        percentage,
        grade,
        subjects(
          name,
          code
        )
      `)
      .in(
        'result_id',
        resultIds
      );

    if (itemsError) {
      return (
        <Shell role={role}>
          <div className="empty-panel">
            <GraduationCap size={28} />

            <h3>
              Unable to load result details
            </h3>

            <p>
              {itemsError.message}
            </p>
          </div>
        </Shell>
      );
    }

    items =
      resultItems || [];
  }

  return (
    <Shell role={role}>
      {safeResults.length === 0 ? (
        <div className="empty-panel">
          <GraduationCap size={28} />

          <h3>
            No published results yet
          </h3>

          <p>
            Your school will publish your
            result after marks are verified
            and generated.
          </p>
        </div>
      ) : (
        <StudentResults
          results={safeResults}
          items={items}
        />
      )}
    </Shell>
  );
}

function Shell({
  children,
  role = 'student',
}: {
  children: React.ReactNode;
  role?: string;
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

              <h1>My Results</h1>

              <p>
                Published examination results
                and subject-wise performance.
              </p>
            </div>

            <div className="security-chip">
              <ShieldCheck size={16} />
              Published only
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
