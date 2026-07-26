import { guardedRoute } from "@/lib/apiGuard";
import { portfolioProjectSchema, portfolioProjectDeleteSchema } from "@/lib/schemas";

/* Apprentice's own portfolio projects — "own rows" RLS already covers this,
   same shape as work_entries/ojt_months. Upsert so create and edit share
   one route, matching entrySchema's pattern elsewhere in this app. */
export async function GET(request) {
  return guardedRoute(request, "portfolio:projects:get", {}, async ({ supabase, user }) => {
    const { data, error } = await supabase
      .from("portfolio_projects")
      .select("id, title, notes, sort_order, include_in_portfolio, share_token, created_at")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });
    if (error) return Response.json({ error: "Could not load" }, { status: 400 });
    return Response.json({ ok: true, projects: data });
  });
}

export async function POST(request) {
  return guardedRoute(request, "portfolio:projects:post", { schema: portfolioProjectSchema }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("portfolio_projects").upsert({
      id: data.id,
      user_id: user.id,
      title: data.title,
      notes: data.notes || null,
      ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
      ...(data.includeInPortfolio !== undefined ? { include_in_portfolio: data.includeInPortfolio } : {}),
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "portfolio:projects:delete", { schema: portfolioProjectDeleteSchema }, async ({ supabase, data }) => {
    // storage cleanup: pull the photo paths before the row (and its photo
    // rows, via on-delete-cascade) disappear.
    const { data: photos } = await supabase.from("portfolio_project_photos").select("storage_path").eq("project_id", data.id);
    const { error } = await supabase.from("portfolio_projects").delete().eq("id", data.id);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    if (photos?.length) {
      await supabase.storage.from("portfolio").remove(photos.map((p) => p.storage_path));
    }
    return Response.json({ ok: true });
  });
}
