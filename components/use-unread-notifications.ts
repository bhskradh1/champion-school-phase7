'use client';

import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/*
 * LIVE unread-notification count.
 *
 * - Loads the current number once when the page opens.
 * - Then listens (Supabase Realtime) for any change to MY notifications
 *   and updates the number instantly - no refresh needed.
 */
export function useUnreadNotifications(initial = 0) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let active = true;
    let channel: RealtimeChannel | null = null;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;
      if (!userId || !active) return;

      const load = async () => {
        const { count: unread } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', userId)
          .is('read_at', null);

        if (active && unread != null) setCount(unread);
      };

      await load();
      if (!active) return;

      // Unique name so several components can listen at the same time.
      channel = supabase
        .channel(`unread-${userId}-${Math.random().toString(36).slice(2)}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${userId}`,
          },
          () => {
            load();
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
