import { guardedRoute } from "@/lib/apiGuard";
import { adminDoNotHireSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email";

/* plain profiles update — RLS's "admin update all" policy is what actually
   allows this; requireAdmin here is belt-and-suspenders. do_not_hire_at /
   _reason are locked against self-edit by protect_profile_privilege_columns
   in supabase/schema.sql, same as is_admin and archived_at, so an apprentice
   can't clear their own status from the browser console. Notifies either
   direction — going on the list and coming off both matter to know about.

   Accepts userId (single) or userIds (batch) — one request either way, so
   BulkDnhForm putting several apprentices on the list at once spends 1 unit
   of the rate limit instead of one per apprentice. */
export async function POST(request) {
  return guardedRoute(request, "admin:do-not-hire", { schema: adminDoNotHireSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const ids = data.userIds || [data.userId];

    const { data: targets } = await supabase.from("profiles").select("id, email").in("id", ids);
    const emailById = Object.fromEntries((targets || []).map((t) => [t.id, t.email]));

    const { error } = await supabase.from("profiles").update({
      do_not_hire_at: data.onList ? new Date().toISOString() : null,
      do_not_hire_reason: data.onList ? (data.reason || null) : null,
    }).in("id", ids);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    const message = data.onList
      ? "You've been placed on the do-not-hire list" + (data.reason ? " — " + data.reason : "")
      : "You've been removed from the do-not-hire list";
    await supabase.from("notifications").insert(
      ids.map((id) => ({ id: "ndnh" + Date.now().toString(36) + id.slice(0, 4), user_id: id, type: "dnh", message }))
    );

    // best-effort, same as the notifications — a missing/failed email
    // shouldn't undo the status change itself
    for (const id of ids) {
      const email = emailById[id];
      if (!email) continue;
      await sendEmail({
        to: email,
        subject: data.onList ? "L831 Tracker — do-not-hire status" : "L831 Tracker — do-not-hire status cleared",
        html: data.onList
          ? `<p>You've been placed on the union's do-not-hire list${data.reason ? ": " + data.reason : "."}</p><p>Contact the JATC office to resolve it.</p>`
          : `<p>You've been removed from the do-not-hire list.</p>`,
      });
    }

    for (const id of ids) {
      await logAudit(supabase, {
        actorEmail: user.email, targetEmail: emailById[id],
        action: data.onList ? "dnh_add" : "dnh_remove",
        message: (data.onList ? "Put " : "Removed ") + (emailById[id] || id) + (data.onList ? " on do-not-hire" : " from do-not-hire")
          + (data.onList && data.reason ? " — " + data.reason : ""),
      });
    }

    return Response.json({ ok: true });
  });
}
