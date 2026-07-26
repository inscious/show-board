import { guardedRoute } from "@/lib/apiGuard";
import { portfolioProjectDaySchema, portfolioProjectDayDeleteSchema } from "@/lib/schemas";

/* Links one logged work_entries row to a project, tagged install/dismantle —
   the DaySheet "Add Project" entry point. RLS on portfolio_project_days
   joins through portfolio_projects.user_id, so this can only ever attach to
   a project the caller owns; work_entries' own "own rows" RLS separately
   means work_entry_id has to be a row the caller owns too (upsert on the
   project_id+work_entry_id row fails RLS otherwise, not silently attaches
   to someone else's entry). */
export async function POST(request) {
  return guardedRoute(request, "portfolio:project-days:post", { schema: portfolioProjectDaySchema }, async ({ supabase, data }) => {
    const { error } = await supabase.from("portfolio_project_days").upsert(
      { project_id: data.projectId, work_entry_id: data.workEntryId, work_type: data.workType },
      { onConflict: "project_id,work_entry_id" }
    );
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "portfolio:project-days:delete", { schema: portfolioProjectDayDeleteSchema }, async ({ supabase, data }) => {
    const { error } = await supabase.from("portfolio_project_days")
      .delete().eq("project_id", data.projectId).eq("work_entry_id", data.workEntryId);
    if (error) return Response.json({ error: "Could not remove" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
