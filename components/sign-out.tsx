'use client';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
export default function SignOut({ compact = false }: { compact?: boolean }) {
  async function out() { const supabase = createClient(); if (supabase) await supabase.auth.signOut(); window.location.href='/login'; }
  return <button type="button" className={compact ? 'logout compact' : 'logout'} onClick={out}><LogOut size={17}/>{compact ? '' : ' Sign out'}</button>;
}
