import { redirect } from 'next/navigation';
import PageShell from '@/components/page-shell';
import SettingsForm from '@/components/settings-form';
import { getCurrentUser } from '@/lib/auth/current-user';

export default async function SettingsPage() {
  const { supabase, userId, profile } = await getCurrentUser();

  if (supabase) {
    if (!userId) redirect('/login');
    if (profile?.role !== 'admin') redirect('/dashboard');
  }

  let values: Record<string, any> = {};
  if (supabase) {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_key,setting_value')
      .in('setting_key', ['discussion_thread_limit', 'discussion_message_limit', 'class_teacher_can_publish_results']);
    for (const row of data || []) values[row.setting_key] = row.setting_value;
  }

  return (
    <PageShell role="admin" title="Settings" subtitle="Rules that the system enforces for everyone." chip="Admin only">
      <SettingsForm
        initial={{
          threads: Number(values.discussion_thread_limit ?? 1),
          replies: Number(values.discussion_message_limit ?? 20),
          classTeacherPublish: values.class_teacher_can_publish_results !== false,
        }}
      />
    </PageShell>
  );
}
