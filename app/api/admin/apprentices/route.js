import { guardedRoute } from "@/lib/apiGuard";
import { createApprenticeSchema, adminArchiveApprenticeSchema, adminDeleteApprenticeSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/auditLog";

/* creating an account this way is an Admin API operation (auth.admin.createUser),
   admin hands out the first password directly (see app/login and
   lib/store.js setPassword). Self-signup (app/api/auth/sign-up, gated behind
   SELF_SIGNUP_ENABLED) is the other way an account can appear — accounts
   created here are approved on arrival since admin already vetted them by
   creating the account directly; self-signups start unapproved. */
export async function POST(request) {
  return guardedRoute(request, "admin:apprentices:post", { schema: createApprenticeSchema, requireAdmin: true }, async ({ data }) => {
    const admin = createAdminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) return Response.json({ error: error.message || "Could not create account" }, { status: 400 });

    // handle_new_user() trigger already created the profiles row; fill in
    // what we know, mark a password as already set, and approve immediately.
    await admin.from("profiles").update({ name: data.name || null, has_password: true, approved_at: new Date().toISOString() }).eq("id", created.user.id);

    return Response.json({ ok: true });
  });
}

/* archive = soft-remove from the active roster (hidden from Roster/class-
   assignment lists, everything else stays on file, reversible). This is a
   plain profiles column, so it goes through the normal RLS-scoped client
   (the "admin update all" policy already covers it) — no Admin API needed.

   Accepts userId (single) or userIds (batch) — one request either way, so
   BulkArchiveForm doing 20 apprentices at once spends 1 unit of the rate
   limit instead of 20. */
export async function PATCH(request) {
  return guardedRoute(request, "admin:apprentices:patch", { schema: adminArchiveApprenticeSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const ids = data.userIds || [data.userId];

    const { data: targets } = await supabase.from("profiles").select("id, email").in("id", ids);
    const emailById = Object.fromEntries((targets || []).map((t) => [t.id, t.email]));

    const { error } = await supabase.from("profiles")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .in("id", ids);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    for (const id of ids) {
      await logAudit(supabase, {
        actorEmail: user.email, targetEmail: emailById[id],
        action: data.archived ? "archive" : "restore",
        message: (data.archived ? "Archived " : "Restored ") + (emailById[id] || id),
      });
    }

    return Response.json({ ok: true });
  });
}

/* permanent delete only runs through the Admin API (auth.admin.deleteUser) —
   every per-user table cascades off auth.users (see supabase/schema.sql), so
   this one call removes hours, classes, certs, bookings, everything. For a
   real (ever-approved) apprentice, only allowed once already archived, so
   it's never a one-click accident off the live roster — archive first,
   delete later, matches the two-step UI. A never-approved account (a
   rejected self-signup) skips that requirement: it never had a chance to
   accumulate real records the two-step flow is protecting, and rejecting a
   signup is meant to be one click, not archive-then-delete. */
export async function DELETE(request) {
  return guardedRoute(request, "admin:apprentices:delete", { schema: adminDeleteApprenticeSchema, requireAdmin: true }, async ({ user, data }) => {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("archived_at, approved_at, email").eq("id", data.userId).single();
    if (profile?.approved_at && !profile?.archived_at) return Response.json({ error: "Archive the apprentice before deleting them." }, { status: 400 });

    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });

    await logAudit(admin, {
      actorEmail: user.email, targetEmail: profile.email,
      action: "delete", message: "Permanently deleted " + (profile.email || data.userId),
    });

    return Response.json({ ok: true });
  });
}
