import { guardedRoute } from "@/lib/apiGuard";
import { createApprenticeSchema } from "@/lib/schemas";
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
