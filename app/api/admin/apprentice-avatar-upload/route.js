import { guardedRoute } from "@/lib/apiGuard";
import { adminApprenticeAvatarUploadSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/auditLog";

/* Live on/off switch for apprentice self-upload of their own profile
   picture — one row per union org in app_settings (same shape as
   self_signup_enabled/ojt_auto_approve), org-scoped, only admin-writable.
   app/api/profile/avatar (the apprentice's own upload route) checks this
   before allowing a write; turning it off here doesn't touch avatars
   already uploaded, just blocks new ones and re-uploads. */
export async function POST(request) {
  return guardedRoute(request, "admin:apprentice-avatar-upload", { schema: adminApprenticeAvatarUploadSchema, requireAdmin: true }, async ({ supabase, user, profile, data }) => {
    const { error } = await supabase.from("app_settings").update({ apprentice_avatar_upload_enabled: data.enabled }).eq("organization_id", profile.organization_id);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });

    await logAudit(supabase, {
      actorEmail: user.email,
      action: data.enabled ? "apprentice_avatar_upload_enable" : "apprentice_avatar_upload_disable",
      message: data.enabled ? "Turned apprentice profile picture upload ON" : "Turned apprentice profile picture upload OFF",
    });

    return Response.json({ ok: true });
  });
}
