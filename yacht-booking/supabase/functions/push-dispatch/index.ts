// Delivers queued in-app notifications as Expo push notifications.
// Trigger it with a Database Webhook on INSERT into public.notifications
// (and/or a cron every minute as a safety net). It drains everything unpushed,
// so duplicate invocations are harmless.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { json } from '../_shared/cors.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
  if (secret && req.headers.get('x-dispatch-secret') !== secret) {
    return json({ error: 'Forbidden' }, 403);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: pending, error } = await db
    .from('notifications')
    .select('id, user_id, title, body, data, booking_id')
    .is('pushed_at', null)
    .gte('created_at', new Date(Date.now() - 6 * 3600_000).toISOString())
    .order('created_at')
    .limit(BATCH);
  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ sent: 0 });

  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const [{ data: tokens }, { data: prefs }] = await Promise.all([
    db.from('push_tokens').select('token, user_id').in('user_id', userIds),
    db.from('notification_preferences').select('user_id, push_enabled').in('user_id', userIds),
  ]);
  const pushOff = new Set((prefs ?? []).filter((p) => !p.push_enabled).map((p) => p.user_id));

  const messages = pending.flatMap((n) =>
    pushOff.has(n.user_id)
      ? []
      : (tokens ?? [])
          .filter((t) => t.user_id === n.user_id)
          .map((t) => ({
            to: t.token,
            title: n.title,
            body: n.body ?? undefined,
            sound: 'default',
            data: { ...(n.data ?? {}), notification_id: n.id, booking_id: n.booking_id },
          })),
  );

  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    const out = await res.json().catch(() => ({}));
    (out?.data ?? []).forEach((ticket: { status: string; details?: { error?: string } }, idx: number) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].to);
    });
  }

  await db.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', pending.map((n) => n.id));
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);

  return json({ notifications: pending.length, sent: messages.length, removed_tokens: dead.length });
});
