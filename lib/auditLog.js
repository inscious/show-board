/* Shared insert for admin_audit_log — best-effort, same reasoning as the
   notification inserts elsewhere: a log entry that doesn't land shouldn't
   fail the action it's describing. Call with whichever Supabase client the
   route already has in scope (RLS-scoped or service-role, both work). */
export async function logAudit(client, { actorEmail, targetEmail, action, message }) {
  await client.from("admin_audit_log").insert({
    actor_email: actorEmail || null,
    target_email: targetEmail || null,
    action,
    message,
  });
}
