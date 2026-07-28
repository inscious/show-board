import { guardedRoute } from "@/lib/apiGuard";
import { unionNoticeSchema, unionNoticeDeleteSchema } from "@/lib/schemas";

/* Admin-only: the shared "union dates & dues" list — same shape as
   app/api/shows/route.js. RLS on union_notices also restricts insert/
   update/delete to is_admin_user() — this check is belt-and-suspenders. */
export async function POST(request) {
  return guardedRoute(request, "union-notices:post", { schema: unionNoticeSchema, requireAdmin: true }, async ({ supabase, user, data }) => {
    const { error } = await supabase.from("union_notices").upsert({
      id: data.id,
      date_label: data.dateLabel,
      notice_date: data.noticeDate || null,
      body: data.body,
      kind: data.kind,
      sort_order: data.sortOrder ?? 0,
      sheet_month: data.sheetMonth || null,
      created_by: user.id,
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
