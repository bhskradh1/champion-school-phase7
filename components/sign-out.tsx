'use client';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
export default function SignOut() {
  async function out() { const supabase = createClient(); if (supabase) await supabase.auth.signOut(); window.location.href='/login'; }
  return <button className="logout" onClick={out}><LogOut size={17}/> Sign out</button>;
}
