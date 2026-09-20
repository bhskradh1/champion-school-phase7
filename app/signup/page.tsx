'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/*
 * INVITATION-ONLY SIGN UP
 *
 * The admin invites a teacher/student by email. The email contains a link that
 * opens THIS page. The link carries a one-time login token; this page reads it,
 * signs the person in, and asks them to choose a password.
 *
 * Opening /signup without a valid invitation link does nothing - there is no
 * public registration.
 */
type Stage = 'checking' | 'ready' | 'invalid' | 'already';

export default function SignupPage() {
  const [stage, setStage] = useState<Stage>('checking');
  const [problem, setProblem] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // Run once only: the one-time invitation token can be used a single time.
    if (started.current) return;
    started.current = true;

    const supabase = createClient();

    if (!supabase) {
      setProblem('The website is not connected to Supabase yet.');
      setStage('invalid');
      return;
    }

    (async () => {
      try {
        // Let the Supabase client finish starting up first.
        await supabase.auth.getSession();

        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const query = new URLSearchParams(window.location.search);

        const linkError = hash.get('error_description') || query.get('error_description');
        if (linkError) {
          setProblem(
            'This invitation link is invalid or has expired. Please ask your school admin to send a new invitation.'
          );
          setStage('invalid');
          return;
        }

        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const tokenHash = query.get('token_hash');
        const code = query.get('code');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (tokenHash) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (query.get('type') as 'invite') || 'invite',
          });
          if (otpError) throw otpError;
        } else if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) throw codeError;
        }

        // Remove the token from the address bar.
        if (window.location.hash || window.location.search) {
          window.history.replaceState(null, '', '/signup');
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setProblem(
            'Sign up is by invitation only. Please open the link in the invitation email sent by your school admin.'
          );
          setStage('invalid');
          return;
        }

        setName((user.user_metadata?.full_name as string) || '');
        setEmail(user.email || '');
        setRole((user.user_metadata?.role as string) || '');
        setStage(user.user_metadata?.password_set ? 'already' : 'ready');
      } catch (e: any) {
        setProblem(
          e?.message
            ? `${e.message}. Please ask your school admin to send a new invitation.`
            : 'This invitation link could not be used. Please ask your school admin to send a new invitation.'
        );
        setStage('invalid');
      }
    })();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Your password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    });

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    // Full page load so the server sees the new session immediately.
    window.location.href = '/dashboard';
  }

  const roleLabel = role === 'teacher' ? 'Teacher' : role === 'student' ? 'Student' : role === 'admin' ? 'Admin' : '';

  return (
    <main className="login-page">
      <div className="login-glow glow-one" />
      <div className="login-glow glow-two" />

      <section className="login-card">
        <div className="login-brand">
          <img src="/school-logo.jpg" alt="Champion English School" width={47} height={47} decoding="async" />
          <div>
            <strong>Champion</strong>
            <span>English School</span>
          </div>
        </div>

        {stage === 'checking' && (
          <div className="login-copy">
            <span className="section-kicker">INVITATION</span>
            <h1>Checking your invitation…</h1>
            <p>Please wait a moment.</p>
          </div>
        )}

        {stage === 'invalid' && (
          <>
            <div className="login-copy">
              <span className="section-kicker">INVITATION</span>
              <h1>Invitation not valid</h1>
              <p>{problem}</p>
            </div>
            <Link className="login-btn" href="/login">
              Go to sign in <ArrowRight size={18} />
            </Link>
          </>
        )}

        {stage === 'already' && (
          <>
            <div className="login-copy">
              <span className="section-kicker">ACCOUNT READY</span>
              <h1>You are already set up.</h1>
              <p>Your password was already created. You can continue to your dashboard.</p>
            </div>
            <Link className="login-btn" href="/dashboard">
              Open dashboard <ArrowRight size={18} />
            </Link>
          </>
        )}

        {stage === 'ready' && (
          <>
            <div className="login-copy">
              <span className="section-kicker">
                {roleLabel ? `${roleLabel.toUpperCase()} INVITATION` : 'INVITATION'}
              </span>
              <h1>Welcome{name ? `, ${name.split(' ')[0]}` : ''}.</h1>
              <p>Create a password to finish setting up your school account.</p>
            </div>

            <form onSubmit={submit} className="login-form">
              {name && (
                <label>
                  Name
                  <div className="input-wrap">
                    <UserRound size={18} />
                    <input value={name} readOnly />
                  </div>
                </label>
              )}

              <label>
                Email address
                <div className="input-wrap">
                  <Mail size={18} />
                  <input value={email} readOnly />
                </div>
              </label>

              <label>
                Create password
                <div className="input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <button type="button" className="input-action" onClick={() => setShow(!show)}>
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              <label>
                Confirm password
                <div className="input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Type the password again"
                  />
                </div>
              </label>

              {error && <div className="form-error">{error}</div>}

              <button className="login-btn" disabled={busy}>
                {busy ? 'Creating account…' : 'Create my account'} <ArrowRight size={18} />
              </button>
            </form>
          </>
        )}

        <div className="secure-note">
          <ShieldCheck size={17} />
          <span>Invitation-only access · Secure one-time link</span>
        </div>

        <p className="login-foot">Champion English School · Dharan-15, Sunsari, Nepal</p>
      </section>
    </main>
  );
}
