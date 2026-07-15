import { guardedRoute } from "@/lib/apiGuard";
import { notificationDeleteSchema } from "@/lib/schemas";

/* clearing a notification is just deleting your own row — no separate
   read/unread state to manage. id: "all" clears everything at once. */
export async function DELETE(request) {
  return guardedRoute(request, "notifications:delete", { schema: notificationDeleteSchema }, async ({ supabase, user, data }) => {
    const q = supabase.from("notifications").delete().eq("user_id", user.id);
    const { error } = data.id === "all" ? await q : await q.eq("id", data.id);
    if (error) return Response.json({ error: "Could not clear" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
