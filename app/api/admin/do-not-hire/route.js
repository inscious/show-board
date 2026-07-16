import { guardedRoute } from "@/lib/apiGuard";
import { adminDoNotHireSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email";

/* plain profiles update — RLS's "admin update all" policy is what actually
   allows this; requireAdmin here is belt-and-suspenders. do_not_hire_at /
   _reason are locked against self-edit by protect_profile_privilege_columns
   in supabase/schema.sql, same as is_admin and archived_at, so an apprentice
   can't clear their own status from the browser console. Notifies either
   direction — going on the list and coming off both matter to know about. */
export async function POST(request) {
  return guardedRoute(request, "admin:do-not-hire", { schema: adminDoNotHireSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const { data: target } = await supabase.from("profiles").select("email").eq("id", data.userId).single();
    const { error } = await supabase.from("profiles").update({
      do_not_hire_at: data.onList ? new Date().toISOString() : null,
      do_not_hire_reason: data.onList ? (data.reason || null) : null,
    }).eq("id", data.userId);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    const message = data.onList
      ? "You've been placed on the do-not-hire list" + (data.reason ? " — " + data.reason : "")
      : "You've been removed from the do-not-hire list";
    await supabase.from("notifications").insert({
      id: "ndnh" + Date.now().toString(36), user_id: data.userId, type: "dnh", message,
    });

    // best-effort, same as the notification — a missing/failed email
    // shouldn't undo the status change itself
    if (target?.email) {
      await sendEmail({
        to: target.email,
        subject: data.onList ? "L831 Tracker — do-not-hire status" : "L831 Tracker — do-not-hire status cleared",
        html: data.onList
          ? `<p>You've been placed on the union's do-not-hire list${data.reason ? ": " + data.reason : "."}</p><p>Contact the JATC office to resolve it.</p>`
          : `<p>You've been removed from the do-not-hire list.</p>`,
      });
    }

    await logAudit(supabase, {
      actorEmail: user.email, targetEmail: target?.email,
      action: data.onList ? "dnh_add" : "dnh_remove",
      message: (data.onList ? "Put " : "Removed ") + (target?.email || data.userId) + (data.onList ? " on do-not-hire" : " from do-not-hire")
        + (data.onList && data.reason ? " — " + data.reason : ""),
    });

    return Response.json({ ok: true });
  });
}
