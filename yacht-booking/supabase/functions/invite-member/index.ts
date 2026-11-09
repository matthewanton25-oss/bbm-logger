// Invite a team member to an organization.
//  1. The invitation row is created through the `invite_member` RPC using the CALLER's JWT,
//     so the owner-only rule is enforced by Postgres, not by this function.
//  2. If the invitee has no account yet, Supabase Auth emails them a sign-up link.
//     Existing users see the invitation in-app (Profile → Invitations) after login.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  const { org_id, email, role, redirect_to } = await req.json().catch(() => ({}));
  if (!org_id || !email || !['owner', 'manager', 'viewer'].includes(role)) {
    return json({ error: 'org_id, email and role are required' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: invitation, error } = await userClient.rpc('invite_member', {
    p_org: org_id,
    p_email: String(email).trim().toLowerCase(),
    p_role: role,
  });
  if (error) return json({ error: error.message, code: error.code }, error.code === '42501' ? 403 : 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(invitation.email, {
    redirectTo: redirect_to,
    data: { invited_to_org: org_id },
  });
  // "already registered" is expected for existing users — they accept in-app.
  const emailed = !inviteError;

  return json({ invitation, emailed });
});
