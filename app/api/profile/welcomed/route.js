import { guardedRoute } from "@/lib/apiGuard";

/* marks the first-login welcome modal as seen — self-scoped, no body, same
   shape as set-password's own profile update. Once welcomed_at is set it
   never shows again for this apprentice. */
export async function POST(request) {
  return guardedRoute(request, "profile:welcomed", {}, async ({ supabase, user }) => {
    const { error } = await supabase
      .from("profiles")
      .update({ welcomed_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
