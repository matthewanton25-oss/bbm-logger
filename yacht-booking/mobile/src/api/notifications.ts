import { supabase, unwrap } from '@/lib/supabase';
import type { AppNotification, NotificationPreferences } from '@/types/models';

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  return unwrap(
    await supabase
      .from('notifications')
      .select('id, type, title, body, booking_id, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
  ) as AppNotification[];
}

export async function markAllRead(userId: string) {
  unwrap(
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null),
  );
}

export async function markRead(id: string) {
  unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id));
}

export async function fetchPreferences(userId: string): Promise<NotificationPreferences> {
  const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data as NotificationPreferences;
  return unwrap(
    await supabase.from('notification_preferences').insert({ user_id: userId }).select().single(),
  ) as NotificationPreferences;
}

export async function updatePreferences(userId: string, patch: Partial<NotificationPreferences>) {
  unwrap(await supabase.from('notification_preferences').update(patch).eq('user_id', userId));
}

export async function savePushToken(userId: string, token: string, platform: string) {
  unwrap(
    await supabase
      .from('push_tokens')
      .upsert({ token, user_id: userId, platform, updated_at: new Date().toISOString() }),
  );
}
