import { guardedRoute } from "@/lib/apiGuard";
import { createApprenticeSchema, adminArchiveApprenticeSchema, adminDeleteApprenticeSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

/* creating an account is an Admin API operation (auth.admin.createUser) —
   there's no self-serve signup in this app, admin hands out the first
   password directly (see app/login and lib/store.js setPassword). */
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
    // what we know and mark a password as already set.
    await admin.from("profiles").update({ name: data.name || null, has_password: true }).eq("id", created.user.id);

    return Response.json({ ok: true });
  });
}

/* archive = soft-remove from the active roster (hidden from Roster/class-
   assignment lists, everything else stays on file, reversible). This is a
   plain profiles column, so it goes through the normal RLS-scoped client
   (the "admin update all" policy already covers it) — no Admin API needed. */
export async function PATCH(request) {
  return guardedRoute(request, "admin:apprentices:patch", { schema: adminArchiveApprenticeSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("profiles")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.userId);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

/* permanent delete only runs through the Admin API (auth.admin.deleteUser) —
   every per-user table cascades off auth.users (see supabase/schema.sql), so
   this one call removes hours, classes, certs, bookings, everything. Only
   allowed once already archived, so it's never a one-click accident off the
   live roster — archive first, delete later, matches the two-step UI. */
export async function DELETE(request) {
  return guardedRoute(request, "admin:apprentices:delete", { schema: adminDeleteApprenticeSchema, requireAdmin: true }, async ({ data }) => {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("archived_at").eq("id", data.userId).single();
    if (!profile?.archived_at) return Response.json({ error: "Archive the apprentice before deleting them." }, { status: 400 });

    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
