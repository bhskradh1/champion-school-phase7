# Champion English School - Production Deployment Checklist

## Pre-Deployment Verification

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env.local`
- [ ] Set all required environment variables:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `JWT_SECRET` (minimum 32 characters)
  - [ ] `NEXT_PUBLIC_APP_URL`
- [ ] Configure optional services:
  - [ ] Firebase credentials (for push notifications)
  - [ ] S3/Storage credentials (for file uploads)
  - [ ] Redis connection (for enhanced caching)

### 2. Database Setup
- [ ] Create PostgreSQL database (or Supabase project)
- [ ] Run all migrations in order:
  ```bash
  psql -f database/migrations/001_initial.sql
  psql -f database/migrations/002_admin_management.sql
  psql -f database/migrations/003_student_management.sql
  psql -f database/migrations/004_attendance.sql
  psql -f database/migrations/005_assignments.sql
  psql -f database/migrations/006_discussions.sql
  psql -f database/migrations/007_examinations_results.sql
  psql -f database/migrations/008_announcements_notifications.sql
  psql -f database/migrations/009_result_pdf_assignment_submission.sql
  ```
- [ ] Run seed data:
  ```bash
  psql -f database/seed.sql
  ```
- [ ] Verify all tables and functions exist
- [ ] Test Row Level Security (RLS) policies
- [ ] Configure backup automation (see `scripts/backup.sh`)

### 3. Security Hardening
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure secure cookies:
  ```typescript
  // next.config.ts
  module.exports = {
    headers: async () => [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ],
  }
  ```
- [ ] Enable rate limiting in middleware
- [ ] Configure CORS for API routes
- [ ] Set up firewall rules
- [ ] Rotate all default passwords
- [ ] Enable audit logging
- [ ] Configure session timeout (default: 24 hours)

### 4. File Storage
- [ ] Create storage bucket (Supabase Storage or S3)
- [ ] Configure bucket policies:
  - Private by default
  - Signed URLs for access
  - Max file size: 10MB (assignments)
- [ ] Test file upload/download
- [ ] Configure CDN for static assets

### 5. Push Notifications (Optional)
- [ ] Create Firebase project
- [ ] Enable Cloud Messaging
- [ ] Download service account key
- [ ] Set Firebase environment variables
- [ ] Update `system_settings.fcm_enabled = true`
- [ ] Test notification delivery

### 6. Docker Deployment
- [ ] Build Docker image:
  ```bash
  docker build -t champion-school:latest .
  ```
- [ ] Test locally:
  ```bash
  docker-compose up -d
  ```
- [ ] Verify all services are healthy:
  ```bash
  docker-compose ps
  docker-compose logs app
  ```
- [ ] Configure production profile:
  ```bash
  docker-compose --profile production up -d
  ```

### 7. Nginx Configuration
- [ ] Obtain SSL certificate (Let's Encrypt recommended):
  ```bash
  certbot certonly --standalone -d champion-school.example.com
  ```
- [ ] Copy certificates to `nginx/ssl/`:
  - `fullchain.pem`
  - `privkey.pem`
- [ ] Test nginx configuration:
  ```bash
  docker-compose exec nginx nginx -t
  ```
- [ ] Verify HTTPS redirect works
- [ ] Test security headers

### 8. Monitoring & Logging
- [ ] Set up error tracking (Sentry recommended):
  ```bash
  npm install @sentry/nextjs
  ```
- [ ] Configure log rotation
- [ ] Set up uptime monitoring
- [ ] Configure alerts for:
  - High error rates
  - Slow response times
  - Database connection failures
  - Backup failures
  - Disk space warnings

### 9. Backup Strategy
- [ ] Schedule daily backups:
  ```bash
  # crontab -e
  0 2 * * * /opt/champion-school/scripts/backup.sh full /backups
  ```
- [ ] Configure off-site backup storage (S3/GCS)
- [ ] Test backup restoration:
  ```bash
  pg_restore -d champion_school backup.dump
  ```
- [ ] Document recovery procedure
- [ ] Set backup retention policy (30 days minimum)

### 10. Performance Optimization
- [ ] Enable database indexing (already in migrations)
- [ ] Configure query caching
- [ ] Enable gzip compression (nginx)
- [ ] Set up CDN for static assets
- [ ] Optimize images
- [ ] Enable HTTP/2 (nginx)
- [ ] Configure browser caching

### 11. Testing
- [ ] Run smoke tests:
  - [ ] Login as Admin
  - [ ] Login as Teacher
  - [ ] Login as Student
  - [ ] Create class
  - [ ] Enroll student
  - [ ] Approve student
  - [ ] Take attendance
  - [ ] Create assignment
  - [ ] Enter marks
  - [ ] Generate result
  - [ ] Download PDF
- [ ] Load testing (optional):
  ```bash
  npm install -g artillery
  artillery quick --count 10 --num 100 https://champion-school.example.com
  ```
- [ ] Security scan (optional):
  ```bash
  npm audit
  ```

### 12. Documentation
- [ ] Update system documentation
- [ ] Create user manuals for:
  - Admin staff
  - Teachers
  - Students
- [ ] Document API endpoints
- [ ] Create troubleshooting guide
- [ ] Document emergency procedures

### 13. Go-Live Preparation
- [ ] Final backup before deployment
- [ ] Notify stakeholders of maintenance window
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Verify all critical features work
- [ ] Send launch announcement
- [ ] Schedule training sessions

### 14. Post-Deployment
- [ ] Monitor error rates for 48 hours
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Address critical issues immediately
- [ ] Plan iterative improvements

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| System Administrator | | |
| Database Administrator | | |
| Network Administrator | | |
| School IT Coordinator | | |

---

## Rollback Procedure

If deployment fails:

1. **Stop the application:**
   ```bash
   docker-compose down
   ```

2. **Restore previous version:**
   ```bash
   git checkout <previous-commit>
   docker-compose up -d
   ```

3. **Restore database (if needed):**
   ```bash
   pg_restore -d champion_school backup_YYYYMMDD.dump
   ```

4. **Verify rollback:**
   - Test login
   - Check critical features
   - Notify stakeholders

---

## Maintenance Schedule

- **Daily:** Automated backups at 2 AM
- **Weekly:** Security updates, log review
- **Monthly:** Performance review, cleanup old data
- **Quarterly:** Full security audit, disaster recovery test
- **Yearly:** Major version upgrades, architecture review

---

## Support Resources

- **Documentation:** `/docs` directory
- **API Reference:** See blueprint section 38
- **Database Schema:** See blueprint sections 8-13
- **Troubleshooting:** See PRODUCTION_GUIDE.md
