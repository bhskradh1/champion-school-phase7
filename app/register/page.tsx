'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/*
 * STUDENT REGISTRATION (public)
 *
 * A student creates an account and chooses their class + section.
 * The account is created as a normal student, and a request is sent to the
 * class teacher (or admin - see Settings). Until it is approved the student
 * has no class and sees nothing of the school's data.
 */
export default function RegisterPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', confirm: '',
    requested_class: '', requested_section: '',
    date_of_birth: '', gender: '', student_code: '',
    guardian_name: '', guardian_relation: '', guardian_phone: '', address: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'confirm' | 'signedin' | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setLoadingOptions(false); return; }
    supabase.rpc('registration_options').then(({ data }) => {
      setClasses((data as any)?.classes || []);
      setSections((data as any)?.sections || []);
      setLoadingOptions(false);
    });
  }, []);

  const classSections = useMemo(() => sections.filter((s) => s.class_id === form.requested_class), [sections, form.requested_class]);
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) return setError('Your password must be at least 8 characters long.');
    if (form.password !== form.confirm) return setError('The two passwords do not match.');
    if (!form.requested_class || !form.requested_section) return setError('Please choose your class and section.');

    const supabase = createClient();
    if (!supabase) return setError('The website is not connected to Supabase yet.');

    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          self_registration: true,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          requested_class: form.requested_class,
          requested_section: form.requested_section,
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          student_code: form.student_code.trim(),
          guardian_name: form.guardian_name.trim(),
          guardian_relation: form.guardian_relation.trim(),
          guardian_phone: form.guardian_phone.trim(),
          address: form.address.trim(),
        },
      },
    });
    setBusy(false);

    if (signUpError) return setError(signUpError.message);
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return setError('This email is already registered. Please sign in instead.');
    }
    setDone(data.session ? 'signedin' : 'confirm');
  }

  return (
    <main className="login-page">
      <div className="login-glow glow-one" />
      <div className="login-glow glow-two" />

      <section className="login-card" style={{ maxWidth: 560 }}>
        <div className="login-brand">
          <img src="/school-logo.jpg" alt="Champion English School" width={47} height={47} decoding="async" />
          <div><strong>Champion</strong><span>English School</span></div>
        </div>

        {done ? (
          <>
            <div className="login-copy">
              <span className="section-kicker">REGISTRATION SENT</span>
              <h1>Thank you, {form.full_name.split(' ')[0]}.</h1>
              <p>
                {done === 'confirm'
                  ? 'Please open the confirmation link we emailed to you, then sign in. '
                  : ''}
                Your class teacher must approve your account before you get full access. You will get a notification when it is approved.
              </p>
            </div>
            <Link className="login-btn" href={done === 'signedin' ? '/dashboard' : '/login'}>
              {done === 'signedin' ? 'Open dashboard' : 'Go to sign in'} <ArrowRight size={18} />
            </Link>
          </>
        ) : (
          <>
            <div className="login-copy">
              <span className="section-kicker">NEW STUDENT</span>
              <h1>Register.</h1>
              <p>Create your account and choose your class. Your class teacher will approve it.</p>
            </div>

            <form onSubmit={submit} className="login-form">
              <label>Full name<div className="input-wrap"><input required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></div></label>
              <label>Email address<div className="input-wrap"><input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></div></label>
              <label>Phone<div className="input-wrap"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+977 …" /></div></label>

              <div className="form-grid">
                <label>Class
                  <select required value={form.requested_class} onChange={(e) => { set('requested_class', e.target.value); set('requested_section', ''); }}>
                    <option value="">{loadingOptions ? 'Loading…' : 'Select class'}</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>Section
                  <select required value={form.requested_section} onChange={(e) => set('requested_section', e.target.value)} disabled={!form.requested_class}>
                    <option value="">Select section</option>
                    {classSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label>Date of birth<input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} /></label>
                <label>Gender
                  <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </label>
                <label>Student ID (if you have one)<input value={form.student_code} onChange={(e) => set('student_code', e.target.value)} /></label>
                <label>Address<input value={form.address} onChange={(e) => set('address', e.target.value)} /></label>
                <label>Guardian name<input value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} /></label>
                <label>Relation<input value={form.guardian_relation} onChange={(e) => set('guardian_relation', e.target.value)} placeholder="Father, Mother…" /></label>
                <label>Guardian phone<input value={form.guardian_phone} onChange={(e) => set('guardian_phone', e.target.value)} /></label>
              </div>

              <label>Password<div className="input-wrap"><input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 8 characters" /></div></label>
              <label>Confirm password<div className="input-wrap"><input type="password" required minLength={8} autoComplete="new-password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} /></div></label>

              {error && <div className="form-error">{error}</div>}
              <button className="login-btn" disabled={busy}>{busy ? 'Sending…' : 'Register'} <ArrowRight size={18} /></button>
            </form>
          </>
        )}

        <div className="secure-note"><ShieldCheck size={17} /><span>Your class teacher approves every new student</span></div>
        <p className="login-foot">
          Already have an account? <Link href="/login">Sign in</Link> · Champion English School · Dharan-15, Sunsari
        </p>
      </section>
    </main>
  );
}
