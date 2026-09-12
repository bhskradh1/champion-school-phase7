# Champion English School — Phase 2 Student Management

A production-oriented Next.js + Supabase foundation for Champion English School, Dharan-15, Sunsari, Nepal.

## Included in this build

- Modern responsive school-branded UI using the supplied school logo
- Next.js 15 + TypeScript
- Supabase browser/server clients using `@supabase/ssr`
- Auth callback and session middleware
- Role model: `student`, `teacher`, `admin`
- PostgreSQL schema for profiles, academic years, classes, sections, subjects, teacher assignments, student enrollments, approval requests and audit logs
- Database-level authorization with Row Level Security (RLS)
- Secure class-teacher approval RPCs that verify class/section scope before approving or rejecting a student
- Admin dashboard shell
- Student directory shell
- Approval review screen
- Responsive navigation
- Environment template and seed SQL

## Connect Supabase

1. Create a Supabase project.
2. In Supabase SQL Editor, run:
   - `database/migrations/001_initial.sql`
   - `database/seed.sql` (optional)
3. Copy `.env.example` to `.env.local`.
4. Add your project's URL and publishable key.
5. Create an initial user through Supabase Auth.
6. Set that user's profile to admin:

```sql
update public.profiles
set role = 'admin'
where id = 'YOUR-AUTH-USER-UUID';
```

7. Run `npm install` and `npm run dev`.

## Security model

The frontend never receives a service-role/secret key. Authorization is enforced through Supabase RLS and security-definer functions. The class-teacher approval functions check the requested class and section against the teacher's authorized assignment before changing data.

## Current Phase 1 behavior

If Supabase environment variables are missing, the app intentionally opens a local preview dashboard so the UI can be inspected. Once environment variables are supplied, login uses real Supabase Auth and `/dashboard` reads the authenticated user's profile.

## Next implementation increment

- Full admin CRUD for academic years, classes, sections, subjects, teachers and students
- Class-teacher assignment UI
- Student registration + approval actions wired to the secure RPCs
- Attendance tables and workflows
- Assignments
- Examinations, marks workflow and results
- Discussions/polls and notification system
- PDF result generation
- FCM push notifications
- Automated tests and production deployment configuration

## Phase 1.1 — Admin management
Run `database/migrations/002_admin_management.sql` after the initial migration. The Teachers screen can invite staff through a server-only Supabase service-role key; never expose that key in client code.


## Phase 2 — Student Management

Run `database/migrations/003_student_management.sql` after migrations 001 and 002.

This phase adds:
- Real student directory backed by Supabase
- Admin student registration with secure email invitation
- Student profile fields: name, email, phone, admission number, roll number and active status
- Academic-year, class and section enrollment
- Admin enrollment upsert RPC with class/section/year integrity checks
- Admin editing of student profiles and enrollment
- Teacher directory visibility restricted by their teaching assignments through RLS
- Pending student approval cards on the student directory
- Class-teacher approval/rejection remains enforced by the existing security-definer RPCs
- Duplicate pending registration protection per student and academic year
- Responsive registration/edit modal and mobile-friendly student table
- Role-aware sidebar navigation for admin, teacher and student portals

### Supabase configuration

The registration form uses `SUPABASE_SERVICE_ROLE_KEY` only on the server to send invitation emails. Keep it in `.env.local` and never prefix it with `NEXT_PUBLIC_`.

For a new database, run migrations in this order:

1. `database/migrations/001_initial.sql`
2. `database/migrations/002_admin_management.sql`
3. `database/migrations/003_student_management.sql`

The admin must also have a configured Supabase Auth email provider if invitation emails are to be delivered.

### Phase 2 usage

1. Sign in as an admin.
2. Open **Students → Register student**.
3. Enter the student's details and choose academic year, class and section.
4. The account is created as a student and an invitation is sent by Supabase.
5. Admins can later edit enrollment or deactivate a student.
6. A student-created registration request appears only to admins or the class teacher authorized for its requested class/section.

If Supabase is not configured, the app continues to provide the original UI preview mode; real registration requires Supabase.


## Phase 3 — Attendance
Run `database/migrations/004_attendance.sql` after the previous migrations. Class-teacher attendance writes are authorization-checked by PostgreSQL through `save_class_attendance`; students can read only their own records.

## Phase 5 — Discussions & Polls

Run `database/migrations/006_discussions.sql` after the first five migrations.

This phase adds:
- school-wide and class/section discussions
- one top-level thread or poll per user per Nepal calendar day
- unlimited replies (no 20-message daily cap)
- polls with 2–10 options and one vote per user per poll
- teacher/student scope enforcement through RLS and security-definer RPCs
- admin locking and moderation
- discussion audit logging

The discussion page is available at `/discussions` for authenticated users.

## Phase 6 — Examinations & Results

Run `database/migrations/007_examinations_results.sql` after the Phase 5 migration.

Workflow: admin creates exam → opens mark entry → teacher enters/submits subject marks → admin verifies or requests corrections → admin generates results → class teacher/admin publishes or unpublishes class results. Students only see published results.

## Phase 7 — Announcements & Notifications

Run `database/migrations/008_announcements_notifications.sql` after the Phase 6 migration.

- Admins publish announcements to everyone or teachers only.
- Database delivery creates one notification per eligible active recipient; the browser never chooses recipients.
- The notification centre is private to each recipient and supports mark-read and mark-all-read actions through recipient-checked RPCs.
- Announcement audience, publication state, expiry, and admin mutations are enforced through RLS. Announcement changes are written to `audit_logs`.
- Navigation now includes **Announcements** and **Notifications**; the dashboard bell shows when unread messages exist.
