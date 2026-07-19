import { guardedRoute } from "@/lib/apiGuard";
import { completedClassSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

/* Apprentice self-reporting which of the 61 curriculum classes (
   JATC_CURRICULUM in lib/core.ts) they've already taken — added on
   request since apprentices already have this info and re-entering it
   through an admin is needless friction. This is separate from the
   official JATC Student Progress Report an admin cross-checks against
   (app/api/admin/completed-classes) — same table, two ways in, so a
   self-reported row looks identical to an admin-entered one once saved.

   completed_classes only has an "own rows" SELECT policy for apprentices
   (see supabase/schema.sql) — no self-write policy exists, and this repo
   has no DB migration tooling available to add one. Routes through the
   service-role admin client instead, same as the ojt-months notification
   fix; the userId is taken from the authenticated session, never the
   request body, so this can only ever touch the caller's own rows. */
export async function POST(request) {
  return guardedRoute(request, "completed-classes:post", { schema: completedClassSchema }, async ({ user, data }) => {
    const admin = createAdminClient();
    const { error } = await admin.from("completed_classes").upsert({
      user_id: user.id,
      course_id: data.courseId,
      completed_on: new Date().toISOString().slice(0, 10),
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "completed-classes:delete", { schema: completedClassSchema }, async ({ user, data }) => {
    const admin = createAdminClient();
    const { error } = await admin.from("completed_classes").delete().eq("user_id", user.id).eq("course_id", data.courseId);
    if (error) return Response.json({ error: "Could not remove" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
