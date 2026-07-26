import { guardedRoute } from "@/lib/apiGuard";
import { portfolioShareSchema } from "@/lib/schemas";

/* Toggles a single project's share_token on/off. Generating a fresh uuid on
   every "on" (rather than reusing one) means a previously-shared link stops
   working the moment the apprentice turns sharing off, even if they turn it
   back on later — no way to un-revoke an old link by guessing. */
export async function POST(request) {
  return guardedRoute(request, "portfolio:share:post", { schema: portfolioShareSchema }, async ({ supabase, data }) => {
    const { error } = await supabase.from("portfolio_projects")
      .update({ share_token: data.shared ? crypto.randomUUID() : null })
      .eq("id", data.projectId);
    if (error) return Response.json({ error: "Could not update sharing" }, { status: 400 });

    const { data: row } = await supabase.from("portfolio_projects").select("share_token").eq("id", data.projectId).maybeSingle();
    return Response.json({ ok: true, shareToken: row?.share_token || null });
  });
}
