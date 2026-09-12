# Champion English School - Production Deployment Guide

## System Overview

Champion English School is a comprehensive school management platform built with Next.js, Supabase (PostgreSQL), and TypeScript. This guide covers the critical missing features and production requirements.

---

## Critical Features Implemented

### 1. Result PDF Generation ✅

**Database Migration:** `009_result_pdf_assignment_submission.sql`

**Features:**
- Individual result PDF download with professional formatting
- Bulk PDF generation for entire class/section
- Customizable PDF templates (header, footer, branding)
- Attendance summary inclusion
- Grade highlighting (A+, A, B, etc.)
- Signature lines for Class Teacher and Principal

**API Endpoints:**
- `GET /api/results/pdf/[resultId]` - Get PDF data for a result
- `POST /api/results/pdf` - Create bulk PDF generation job

**Component:** `components/result-pdf.tsx`
```tsx
<ResultPDF 
  resultId="uuid"
  studentName="Ram Thapa"
  examName="Final Examination 2083"
  className="Grade 8"
  isPublished={true}
  variant="button" // or 'card' or 'inline'
/>
```

**Usage Flow:**
1. Admin generates results via `generate_exam_results()` function
2. Results are published by class teacher or admin
3. Students/teachers can download individual PDFs
4. Admin can trigger bulk PDF generation for entire class

---

### 2. Assignment Submission System ✅

**Database Tables Added:**
- `assignment_submission_files` - File attachments stored in object storage
- `assignment_submission_history` - Audit trail for all submission actions

**Enhanced Fields:**
- `assignments.max_marks` - Maximum marks for grading
- `assignments.allow_late_submission` - Allow late submissions
- `assignments.late_penalty_percent` - Penalty for late submission
- `assignment_submissions.grade` - Assigned grade
- `assignment_submissions.feedback` - Teacher feedback
- `assignment_submissions.graded_at/by` - Grading metadata

**API Endpoints:**
- `GET /api/assignments/submissions?assignment_id=xxx` - List submissions
- `POST /api/assignments/submissions` - Submit assignment
- `PATCH /api/assignments/submissions/:id` - Grade submission

**Features:**
- Student submission with text response and file attachments
- File upload to object storage (S3, Cloudflare R2, Supabase Storage)
- Teacher grading with marks and feedback
- Submission history tracking
- Automatic notifications on submission and grading
- Deadline enforcement with late submission support

**Example Submission:**
```typescript
const response = await fetch('/api/assignments/submissions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    assignment_id: 'uuid',
    text_response: 'My answer...',
    files: [{
      name: 'solution.pdf',
      url: 'https://storage.example.com/file.pdf',
      mime_type: 'application/pdf',
      size: 102400
    }]
  })
});
```

---

### 3. Firebase Cloud Messaging (FCM) Integration ✅

**Library:** `lib/notifications/fcm.ts`

**Database Tables:**
- `fcm_tokens` - Store device tokens for push notifications
- Enhanced `notifications` table with `fcm_message_id`, `delivered_at`, `read_at`

**Features:**
- Token registration/unregistration
- Individual and bulk notifications
- Class-wide notifications
- Notification templates for common events
- Read/unread tracking
- Unread count API

**Notification Templates:**
```typescript
NotificationTemplates.assignmentCreated('Math Homework', 'Grade 8A')
NotificationTemplates.resultPublished('Final Exam', 'Grade 8A')
NotificationTemplates.studentApproved('Grade 8A')
NotificationTemplates.marksCorrectionRequired('Final Exam', 'English')
```

**Integration Example:**
```typescript
import { registerFCMToken, sendPushNotification } from '@/lib/notifications/fcm';

// Register token on client
await registerFCMToken(supabase, userId, token, 'web', 'Chrome');

// Send notification
await sendPushNotification(
  supabase,
  userId,
  { title: 'Result Published', body: 'Your results are available' },
  'RESULT_PUBLISHED',
  resultId
);
```

**Production Setup:**
1. Create Firebase project at console.firebase.google.com
2. Enable Cloud Messaging
3. Download service account key
4. Set environment variables:
   ```
   FIREBASE_PROJECT_ID=your-project
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY=...
   ```
5. Update `system_settings.fcm_enabled` to `true`

---

### 4. Rate Limiting & Security ✅

**Library:** `lib/utils/rate-limit.ts`

**Database Tables:**
- `rate_limit_logs` - Track API requests per user/IP
- `user_sessions` - Session management
- Enhanced `audit_logs` with IP address and user agent

**Features:**
- Sliding window rate limiting
- Role-based limits (student: 30/min, teacher: 100/min, admin: 200/min)
- Daily thread creation limit for students (1/day)
- Discussion message limits
- IP-based tracking
- Automatic cleanup of expired entries

**Configuration:**
```typescript
// Default limits
{
  student: { api: 30/min, discussion: 20/min, threads: 1/day },
  teacher: { api: 100/min, discussion: 50/min },
  admin: { api: 200/min, discussion: 100/min }
}
```

**Usage in API Routes:**
```typescript
import { checkRateLimit, getRateLimitForRole } from '@/lib/utils/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for');
  const result = checkRateLimit(`ip:${ip}`, { maxRequests: 60 });
  
  if (!result.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
    );
  }
  
  // Continue with request...
}
```

---

### 5. System Settings & Configuration ✅

**Database Table:** `system_settings`

**Default Settings:**
| Key | Value | Description |
|-----|-------|-------------|
| `student_approval_mode` | `"class_teacher"` | Who approves students |
| `discussion_thread_limit` | `1` | Max threads/day for students |
| `discussion_message_limit` | `20` | Max messages/day for students |
| `assignment_max_file_size_mb` | `10` | Max file size for submissions |
| `rate_limit_requests_per_minute` | `60` | Default API rate limit |
| `session_timeout_hours` | `24` | Session expiration |
| `result_pdf_enabled` | `true` | Enable PDF generation |
| `fcm_enabled` | `false` | Enable push notifications |

**Update Settings:**
```sql
UPDATE system_settings 
SET setting_value = '"admin"'::jsonb,
    updated_by = 'admin-user-id',
    updated_at = now()
WHERE setting_key = 'student_approval_mode';
```

---

## Production Deployment Checklist

### Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application
NEXT_PUBLIC_APP_URL=https://champion-school.example.com
NODE_ENV=production

# Firebase (optional)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# File Storage (Supabase Storage or S3)
NEXT_PUBLIC_STORAGE_BUCKET=champion-school-files
STORAGE_ACCESS_KEY=optional-for-s3
STORAGE_SECRET_KEY=optional-for-s3

# Security
JWT_SECRET=your-jwt-secret-min-32-chars
RATE_LIMIT_ENABLED=true
```

### Database Setup

1. **Run Migrations in Order:**
```bash
psql -h db.host -U postgres -d champion_school -f database/migrations/001_initial.sql
psql -h db.host -U postgres -d champion_school -f database/migrations/002_admin_management.sql
psql -h db.host -U postgres -d champion_school -f database/migrations/003_student_management.sql
psql -h db.host -U postgres -d champion_school -f database/migrations/004_attendance.sql
psql -h db.host -U postgres -d champion_school -f database/migrations/005_assignments.sql
psql -h db.host -U postgres -d champion_school -f database/migrations/006_discussions.sql
psql -h db.host -U postgres -d champion_school -f database/migrations/007_examinations_results.sql
psql -h db.host -U postgres -d champion_school -f database/migrations/008_announcements_notifications.sql
psql -h db.host -U postgres -d champion_school -f database/migrations/009_result_pdf_assignment_submission.sql
```

2. **Seed Initial Data:**
```bash
psql -h db.host -U postgres -d champion_school -f database/seed.sql
```

3. **Verify Functions:**
```sql
SELECT public.check_rate_limit('/api/test', 'GET', 60);
SELECT public.get_result_pdf_data('test-result-id');
SELECT * FROM system_settings;
```

### Build & Deploy

```bash
# Install dependencies
npm ci

# Run linting
npm run lint

# Build application
npm run build

# Start production server
npm start
```

### Security Hardening

1. **Enable HTTPS** (required for production)
2. **Set secure cookies** in Next.js config
3. **Configure CORS** for API routes
4. **Enable rate limiting** in middleware
5. **Set up backup automation** for database
6. **Monitor audit logs** regularly
7. **Rotate secrets** periodically

### Backup Strategy

**Automated Daily Backups:**
```sql
-- Insert backup log entry
INSERT INTO backup_logs(backup_type, tables_backed_up, status, started_at, created_by)
VALUES ('full', '["all"]'::jsonb, 'pending', now(), 'system');

-- Use pg_dump for actual backup
pg_dump -h db.host -U postgres champion_school > backup_$(date +%Y%m%d).sql
```

**Recommended Schedule:**
- Full backup: Daily at 2 AM
- Incremental: Every 6 hours
- Retention: 30 days

### Monitoring & Logging

**Key Metrics to Monitor:**
- API response times
- Error rates by endpoint
- Database query performance
- Rate limit violations
- Failed login attempts
- PDF generation jobs
- FCM delivery rates

**Audit Log Queries:**
```sql
-- Recent admin actions
SELECT action, entity_type, created_at 
FROM audit_logs 
WHERE actor_id IN (SELECT id FROM profiles WHERE role='admin')
ORDER BY created_at DESC 
LIMIT 50;

-- Failed operations
SELECT action, metadata->>'error' as error, COUNT(*)
FROM audit_logs
WHERE metadata ? 'error'
GROUP BY action, metadata->>'error'
ORDER BY COUNT(*) DESC;
```

---

## Performance Optimization

### Database Indexes

Critical indexes already created in migrations:
- `idx_exam_results_published` - For fast result queries
- `idx_notifications_unread` - For notification counts
- `idx_audit_logs_created_desc` - For audit log queries
- `idx_rate_limit_user` - For rate limiting

### Caching Strategy

**Client-side:**
- React Query or SWR for data fetching
- LocalStorage for preferences
- Service Worker for offline support

**Server-side:**
- Redis for session storage (recommended for scale)
- Database query caching for static data
- CDN for static assets

### File Storage

**Recommended:** Supabase Storage or AWS S3

```typescript
// Upload file before submission
const { data, error } = await supabase.storage
  .from('assignments')
  .upload(`${userId}/${file.name}`, file, {
    cacheControl: '3600',
    upsert: false
  });
```

---

## Troubleshooting

### Common Issues

**PDF Generation Fails:**
- Check `result_pdf_templates` table has active template
- Verify result is published (`is_published = true`)
- Ensure user has permission to access the result

**Assignment Submission Errors:**
- Verify student is enrolled in the class
- Check deadline hasn't passed (or late submission allowed)
- Validate file size and type against settings

**Rate Limit Too Strict:**
- Adjust in `system_settings` table
- Check user's role-based limits
- Review `rate_limit_logs` for patterns

**FCM Notifications Not Delivered:**
- Verify token is registered and active
- Check Firebase credentials
- Review `fcm_enabled` setting

---

## Next Steps

### Phase 9 - Advanced Features (Future)
- [ ] Parent accounts and guardian access
- [ ] Fee management system
- [ ] Timetable scheduling
- [ ] Library management
- [ ] Transport tracking
- [ ] SMS integration
- [ ] Advanced analytics dashboard
- [ ] Mobile app (Flutter/React Native)

### Production Launch
1. Complete security audit
2. Load testing with realistic data
3. User acceptance testing with teachers/students
4. Training sessions for staff
5. Phased rollout (start with single class)
6. Monitor and iterate based on feedback

---

## Support

For issues or questions:
- Check audit logs for error details
- Review database function permissions
- Verify RLS policies are correctly configured
- Test with different user roles

**System Architecture Reference:** See blueprint section 54 for complete architecture diagram.
