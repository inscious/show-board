import { guardedRoute } from "@/lib/apiGuard";
import { adminCompletedClassSchema, adminCompletedClassDeleteSchema } from "@/lib/schemas";

/* Which of the 61 curriculum classes (JATC_CURRICULUM in lib/core.ts) an
   apprentice has completed — admin-entered off the official JATC Student
   Progress Report, same reasoning as certifications/ojt_months: the
   training center is the record of truth, apprentices only ever read
   their own. */
export async function POST(request) {
  return guardedRoute(request, "admin:completed-classes:post", { schema: adminCompletedClassSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("completed_classes").upsert({
      user_id: data.userId,
      course_id: data.courseId,
      completed_on: data.completedOn || new Date().toISOString().slice(0, 10),
    });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  return guardedRoute(request, "admin:completed-classes:delete", { schema: adminCompletedClassDeleteSchema, requireAdmin: true }, async ({ supabase, data }) => {
    const { error } = await supabase.from("completed_classes").delete().eq("user_id", data.userId).eq("course_id", data.courseId);
    if (error) return Response.json({ error: "Could not remove" }, { status: 400 });
    return Response.json({ ok: true });
  });
}
