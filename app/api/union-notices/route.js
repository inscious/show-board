import { guardedRoute } from "@/lib/apiGuard";
import { unionNoticeSchema, unionNoticeDeleteSchema } from "@/lib/schemas";

/* Admin-only: each union's own "union dates & dues" list — same shape as
   app/api/shows/route.js, including organization_id: stamped from the
   admin's own server-derived profile, never client input, so an admin can
   only ever write into their own union's list (RLS on union_notices
   requires the same match — see supabase/stage8_union_notices_org_scoping.sql
   — this is belt-and-suspenders on top of that, not the only thing
   enforcing it). */
export async function POST(request) {
  return guardedRoute(request, "union-notices:post", { schema: unionNoticeSchema, requireAdmin: true }, async ({ supabase, user, profile, data }) => {
    const { error } = await supabase.from("union_notices").upsert({
      id: data.id,
      date_label: data.dateLabel,
      notice_date: data.noticeDate || null,
      body: data.body,
      kind: data.kind,
      sort_order: data.sortOrder ?? 0,
      sheet_month: data.sheetMonth || null,
      created_by: user.id,
      organization_id: profile.organization_id,
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "union-notices:delete", { schema: unionNoticeDeleteSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("union_notices").delete().eq("id", data.id);
    if (error) return Response.json({ error: "Could not delete" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
