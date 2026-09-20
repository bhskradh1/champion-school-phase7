'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!configured) { window.location.href = '/dashboard'; return; }
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    window.location.href = '/dashboard';
  }

  return <main className="login-page">
    <div className="login-glow glow-one"/><div className="login-glow glow-two"/>
    <section className="login-card">
      <div className="login-brand"><img src="/school-logo.jpg" alt="Champion English School" width={47} height={47} decoding="async"/><div><strong>Champion</strong><span>English School</span></div></div>
      <div className="login-copy"><span className="section-kicker">SCHOOL MANAGEMENT PORTAL</span><h1>Welcome back.</h1><p>Sign in to manage your school workspace securely.</p></div>
      <form onSubmit={submit} className="login-form">
        <label>Email address<div className="input-wrap"><Mail size={18}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@championschool.edu.np"/></div></label>
        <label>Password<div className="input-wrap"><LockKeyhole size={18}/><input type={show?'text':'password'} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/><button type="button" className="input-action" onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        {error && <div className="form-error">{error}</div>}
        <button className="login-btn" disabled={loading}>{loading?'Signing in…':configured?'Sign in securely':'Open Phase 1 preview'} <ArrowRight size={18}/></button>
      </form>
      <div className="secure-note"><ShieldCheck size={17}/><span>Role-based access · Database-level security · Audit-ready</span></div>
      {!configured && <div className="setup-note"><strong>Supabase not connected yet.</strong><span>Copy <code>.env.example</code> to <code>.env.local</code> and add your Supabase project values to activate real authentication.</span></div>}
      <p className="login-foot">Champion English School · Dharan-15, Sunsari, Nepal</p>
    </section>
  </main>;
}
