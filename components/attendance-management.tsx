'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Loader2,
  Save,
  ShieldCheck,
  UserRoundX,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

type Student = {
  id: string;
  full_name: string;
  admission_no: string | null;
  roll_no: number | null;
};

type Scope = {
  class_id: string;
  section_id: string;
  class_name: string;
  grade: number;
  section_name: string;
};

type RecordRow = {
  student_id: string;
  status:
    | 'present'
    | 'absent'
    | 'late'
    | 'excused';
  note: string | null;
};

const statusMeta = {
  present: {
    label: 'Present',
    icon: Check,
  },
  absent: {
    label: 'Absent',
    icon: UserRoundX,
  },
  late: {
    label: 'Late',
    icon: Clock3,
  },
  excused: {
    label: 'Excused',
    icon: FileCheck2,
  },
} as const;

const PAGE_SIZE = 50;

export default function AttendanceManagement({
  role,
  scopes,
  classes,
  sections,
  studentsByScope,
  initialRecords,
  initialDate,
}: {
  role: string;
  scopes: Scope[];
  classes: any[];
  sections: any[];
  studentsByScope: Record<
    string,
    Student[]
  >;
  initialRecords: Record<
    string,
    RecordRow[]
  >;
  initialDate: string;
}) {
  const canMark =
    role === 'admin' || scopes.length > 0;

  const [
    scopeKey,
    setScopeKey,
  ] = useState(
    scopes[0]
      ? `${scopes[0].class_id}:${scopes[0].section_id}`
      : ''
  );

  const [
    date,
    setDate,
  ] = useState(initialDate);

  const [
    records,
    setRecords,
  ] = useState(initialRecords);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState('');

  const [
    page,
    setPage,
  ] = useState(1);

  const selected = useMemo(
    () =>
      scopes.find(
        (scope) =>
          `${scope.class_id}:${scope.section_id}` ===
          scopeKey
      ),
    [scopes, scopeKey]
  );

  const roster = selected
    ? studentsByScope[scopeKey] || []
    : [];

  const recordKey = selected
    ? `${selected.class_id}:${selected.section_id}:${date}`
    : '';

  /*
   * PERFORMANCE: the server only sends TODAY's attendance. When the teacher
   * picks another date or class, we fetch just that one day for that one
   * section. (Before, the page downloaded up to 5,000 rows on every visit,
   * and any older date outside those rows silently showed everyone as
   * "present" - which could then be saved by mistake.)
   */
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(
    () =>
      new Set(
        scopes.map(
          (scope) =>
            `${scope.class_id}:${scope.section_id}:${initialDate}`
        )
      )
  );

  const loadingRecords =
    Boolean(recordKey) &&
    Boolean(date) &&
    !loadedKeys.has(recordKey);

  useEffect(() => {
    if (
      !selected ||
      !date ||
      !recordKey ||
      loadedKeys.has(recordKey)
    ) {
      return;
    }

    const supabase = createClient();

    if (!supabase) {
      setLoadedKeys((previous) =>
        new Set(previous).add(recordKey)
      );
      return;
    }

    let cancelled = false;

    supabase
      .from('attendance_records')
      .select('student_id,status,note')
      .eq('class_id', selected.class_id)
      .eq('section_id', selected.section_id)
      .eq('attendance_date', date)
      .then(({ data, error: loadError }) => {
        if (cancelled) {
          return;
        }

        if (loadError) {
          setError(loadError.message);
          return;
        }

        if (data && data.length > 0) {
          setRecords((previous) => ({
            ...previous,
            [recordKey]: data as unknown as RecordRow[],
          }));
        }

        setLoadedKeys((previous) =>
          new Set(previous).add(recordKey)
        );
      });

    return () => {
      cancelled = true;
    };
  }, [selected, recordKey, date, loadedKeys]);

  const current = useMemo(() => {
    const saved =
      records[recordKey];

    if (saved) {
      return saved;
    }

    return roster.map((student) => ({
      student_id: student.id,
      status: 'present' as const,
      note: null,
    }));
  }, [
    records,
    recordKey,
    roster,
  ]);

  /*
   * IMPORTANT:
   *
   * Build this map once.
   *
   * OLD:
   * roster.map(student => current.find(...))
   *
   * That becomes very expensive with larger classes.
   */
  const recordByStudentId = useMemo(() => {
    return new Map(
      current.map((record) => [
        record.student_id,
        record,
      ])
    );
  }, [current]);

  /*
   * Only render 50 students at a time.
   */
  const pageCount = Math.max(
    1,
    Math.ceil(
      roster.length / PAGE_SIZE
    )
  );

  useEffect(() => {
    setPage(1);
  }, [scopeKey, date]);

  const effectivePage = Math.min(
    page,
    pageCount
  );

  const visibleRoster = useMemo(() => {
    const start =
      (effectivePage - 1) * PAGE_SIZE;

    return roster.slice(
      start,
      start + PAGE_SIZE
    );
  }, [
    roster,
    effectivePage,
  ]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;

    for (const record of current) {
      if (record.status === 'present') {
        present++;
      } else if (
        record.status === 'absent'
      ) {
        absent++;
      } else if (
        record.status === 'late'
      ) {
        late++;
      }
    }

    return {
      present,
      absent,
      late,
      total: current.length,
    };
  }, [current]);

  function setStatus(
    studentId: string,
    status: RecordRow['status']
  ) {
    const next = current.map(
      (record) =>
        record.student_id === studentId
          ? {
              ...record,
              status,
            }
          : record
    );

    setRecords((previous) => ({
      ...previous,
      [recordKey]: next,
    }));
  }

  function markAll(
    status: RecordRow['status']
  ) {
    const next = current.map(
      (record) => ({
        ...record,
        status,
      })
    );

    setRecords((previous) => ({
      ...previous,
      [recordKey]: next,
    }));
  }

  async function save() {
    if (!selected) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    const supabase = createClient();

    if (!supabase) {
      setError(
        'Connect Supabase to save attendance.'
      );
      setBusy(false);
      return;
    }

    const {
      data,
      error: saveError,
    } = await supabase.rpc(
      'save_class_attendance',
      {
        p_class_id:
          selected.class_id,
        p_section_id:
          selected.section_id,
        p_attendance_date: date,
        p_records: current,
      }
    );

    if (saveError) {
      setError(saveError.message);
      setBusy(false);
      return;
    }

    setMessage(
      `${data || current.length} attendance records saved.`
    );

    setBusy(false);
  }

  if (!canMark) {
    return (
      <div className="empty-panel">
        <div className="empty-icon">
          <ShieldCheck size={25} />
        </div>

        <h3>
          Attendance is restricted to
          class teachers
        </h3>

        <p>
          You can view attendance assigned to
          you, but only the designated class
          teacher can record it.
        </p>
      </div>
    );
  }

  return (
    <div className="attendance-space">
      <section className="panel attendance-editor">
        <div className="panel-head">
          <div>
            <span className="section-kicker">
              DAILY REGISTER
            </span>

            <h3>
              Take attendance
            </h3>

            <p>
              Only class teachers and admins
              can save attendance.
            </p>
          </div>

          <div className="security-chip">
            <ShieldCheck size={15} />
            RLS + RPC protected
          </div>
        </div>

        <div className="attendance-controls">
          <label>
            Class & section

            <select
              value={scopeKey}
              onChange={(event) =>
                setScopeKey(
                  event.target.value
                )
              }
            >
              <option value="">
                Select class
              </option>

              {scopes.map((scope) => (
                <option
                  key={`${scope.class_id}:${scope.section_id}`}
                  value={`${scope.class_id}:${scope.section_id}`}
                >
                  Class {scope.grade} ·{' '}
                  {scope.section_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date

            <input
              type="date"
              max={initialDate}
              value={date}
              onChange={(event) =>
                setDate(
                  event.target.value
                )
              }
            />
          </label>

          <div className="attendance-actions">
            <button
              className="secondary-btn"
              onClick={() =>
                markAll('present')
              }
              disabled={!selected || loadingRecords}
            >
              <Check size={15} />
              Mark all present
            </button>

            <button
              className="primary-btn"
              disabled={
                !selected ||
                busy ||
                loadingRecords ||
                !roster.length
              }
              onClick={save}
            >
              {busy ? (
                <Loader2
                  size={15}
                  className="spin"
                />
              ) : (
                <Save size={15} />
              )}

              Save attendance
            </button>
          </div>
        </div>

        {loadingRecords && (
          <div className="loading-row">
            Loading saved attendance…
          </div>
        )}

        {message && (
          <div className="form-success">
            {message}
          </div>
        )}

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        {selected && (
          <div className="attendance-summary">
            <strong>
              {counts.total}
            </strong>

            <span>students</span>

            <i />

            <strong>
              {counts.present}
            </strong>

            <span>present</span>

            <i />

            <strong>
              {counts.absent}
            </strong>

            <span>absent</span>

            <i />

            <strong>
              {counts.late}
            </strong>

            <span>late</span>
          </div>
        )}

        <div className="attendance-list">
          {!selected && (
            <div className="loading-row">
              Choose a class and section to
              load the register.
            </div>
          )}

          {selected &&
            visibleRoster.map(
              (student) => {
                const record =
                  recordByStudentId.get(
                    student.id
                  ) || {
                    student_id: student.id,
                    status:
                      'present' as const,
                    note: null,
                  };

                return (
                  <div
                    className="attendance-row"
                    key={student.id}
                  >
                    <div className="person-inline">
                      <div className="avatar student">
                        {student.full_name
                          .split(' ')
                          .map(
                            (part) => part[0]
                          )
                          .slice(0, 2)
                          .join('')}
                      </div>

                      <div>
                        <strong>
                          {student.full_name}
                        </strong>

                        <span>
                          {student.admission_no ||
                            'No admission no.'}

                          {student.roll_no !=
                          null
                            ? ` · Roll ${student.roll_no}`
                            : ''}
                        </span>
                      </div>
                    </div>

                    <div className="attendance-buttons">
                      {(
                        Object.keys(
                          statusMeta
                        ) as RecordRow['status'][]
                      ).map((status) => {
                        const Icon =
                          statusMeta[
                            status
                          ].icon;

                        const active =
                          record.status ===
                          status;

                        return (
                          <button
                            key={status}
                            type="button"
                            className={
                              active
                                ? `attendance-pill ${status} selected`
                                : `attendance-pill ${status}`
                            }
                            onClick={() =>
                              setStatus(
                                student.id,
                                status
                              )
                            }
                          >
                            <Icon size={13} />

                            {
                              statusMeta[
                                status
                              ].label
                            }
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }
            )}
        </div>

        {selected &&
          roster.length >
            PAGE_SIZE && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'space-between',
                gap: 12,
                padding:
                  '14px 18px',
                borderTop:
                  '1px solid #edf0f5',
              }}
            >
              <span
                className="muted"
                style={{
                  fontSize: 11,
                }}
              >
                Showing{' '}
                {(effectivePage -
                  1) *
                  PAGE_SIZE +
                  1}
                –
                {Math.min(
                  effectivePage *
                    PAGE_SIZE,
                  roster.length
                )}{' '}
                of {roster.length}
              </span>

              <div
                style={{
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: 8,
                }}
              >
                <button
                  className="secondary-btn"
                  disabled={
                    effectivePage <= 1
                  }
                  onClick={() =>
                    setPage(
                      (value) =>
                        Math.max(
                          1,
                          value - 1
                        )
                    )
                  }
                >
                  <ChevronLeft
                    size={15}
                  />
                  Previous
                </button>

                <span
                  style={{
                    fontSize: 11,
                    minWidth: 70,
                    textAlign:
                      'center',
                  }}
                >
                  Page{' '}
                  {effectivePage} of{' '}
                  {pageCount}
                </span>

                <button
                  className="secondary-btn"
                  disabled={
                    effectivePage >=
                    pageCount
                  }
                  onClick={() =>
                    setPage(
                      (value) =>
                        Math.min(
                          pageCount,
                          value + 1
                        )
                    )
                  }
                >
                  Next
                  <ChevronRight
                    size={15}
                  />
                </button>
              </div>
            </div>
          )}
      </section>
    </div>
  );
}

const PERIODS = [
  ['month', 'This month'],
  ['last_month', 'Last month'],
  ['three_months', 'Last 3 months (term)'],
  ['year', 'This academic year'],
  ['all', 'All time'],
] as const;

function periodRange(period: string, yearStart?: string | null) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });
  const [y, m] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const first = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;

  if (period === 'month') return { from: `${y}-${pad(m)}-01`, to: today };
  if (period === 'last_month') {
    const start = new Date(y, m - 2, 1);
    const end = new Date(y, m - 1, 0);
    return { from: first(start), to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}` };
  }
  if (period === 'three_months') return { from: first(new Date(y, m - 4, 1)), to: today };
  if (period === 'year') return { from: yearStart || `${y}-01-01`, to: today };
  return { from: '', to: '' };
}

export function AttendanceStudentView({
  records: allRecords,
  yearStart,
}: {
  records: any[];
  yearStart?: string | null;
}) {
  const [period, setPeriod] = useState('month');

  const records = useMemo(() => {
    const { from, to } = periodRange(period, yearStart);
    return allRecords.filter(
      (r) => (!from || r.attendance_date >= from) && (!to || r.attendance_date <= to)
    );
  }, [allRecords, period, yearStart]);

  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
  };

  for (const record of records) {
    if (
      record.status in counts
    ) {
      counts[
        record.status as keyof typeof counts
      ]++;
    }
  }

  const attended = counts.present + counts.late;
  const percentage = records.length ? Math.round((attended / records.length) * 1000) / 10 : null;
  const absentDays = records.filter((r) => r.status === 'absent');

  return (
    <div className="attendance-space">
      <div className="row-actions" style={{ marginBottom: 12 }}>
        {PERIODS.map(([key, label]) => (
          <button key={key} className={period === key ? 'primary-btn small' : 'secondary-btn'} onClick={() => setPeriod(key)}>
            {label}
          </button>
        ))}
      </div>

      <section className="stat-grid">
        <Stat icon={CalendarDays} label="Attendance" value={percentage === null ? '—' : `${percentage}%`} />

        <Stat
          icon={Check}
          label="Present"
          value={counts.present}
        />

        <Stat
          icon={UserRoundX}
          label="Absent"
          value={counts.absent}
        />

        <Stat
          icon={Clock3}
          label="Late"
          value={counts.late}
        />

        <Stat
          icon={FileCheck2}
          label="Excused"
          value={counts.excused}
        />
      </section>

      {absentDays.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <div><h3>Absent days</h3><p>{absentDays.length} day{absentDays.length === 1 ? '' : 's'} in this period.</p></div>
          </div>
          <div className="row-actions">
            {absentDays.map((r) => (
              <span className="status pending" key={r.id}>
                {new Date(`${r.attendance_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>
              Attendance history
            </h3>

            <p>
              Exact attendance dates are
              shown below.
            </p>
          </div>

          <div className="security-chip">
            <CalendarDays size={15} />
            {records.length} recorded
            days
          </div>
        </div>

        <div className="attendance-history">
          {records.map((record) => (
            <div
              className="history-row"
              key={record.id}
            >
              <div>
                <strong>
                  {new Date(
                    `${record.attendance_date}T00:00:00`
                  ).toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  )}
                </strong>

                <span>
                  {record.classes?.name ||
                    `Class ${
                      record.classes?.grade ||
                      ''
                    }`}

                  {record.sections?.name
                    ? ` · Section ${record.sections.name}`
                    : ''}
                </span>
              </div>

              <span
                className={`status ${
                  record.status ===
                  'present'
                    ? 'approved'
                    : record.status ===
                      'absent'
                    ? 'pending'
                    : 'neutral'
                }`}
              >
                {record.status}
              </span>
            </div>
          ))}

          {!records.length && (
            <div className="loading-row">
              No attendance has been
              recorded yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: number | string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon blue">
        <Icon size={19} />
      </div>

      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>
          Recorded attendance
        </small>
      </div>
    </div>
  );
}
