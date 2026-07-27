import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* An apprentice uploading their OWN profile picture — the counterpart to
   app/api/admin/avatar (admin setting anyone's). Same multipart-body
   reasoning as that route (guardedRoute assumes JSON, so auth is hand-
   rolled here too), but two differences: userId always comes from the
   session, never the client, so there's no way to overwrite someone
   else's avatar; and it checks apprentice_avatar_upload_enabled first,
   since admin can turn this capability off. Storage write still goes
   through the service-role client — apprentices have no direct write
   access to the `avatars` bucket (schema.sql), same as the admin route. */
async function requireUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  return { supabase, user };
}

const MAX_BYTES = 5_000_000; // 5MB — a phone photo, not a print file
const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request) {
  const { supabase, user, error } = await requireUser();
  if (error) return error;

  const { data: settings } = await supabase.from("app_settings").select("apprentice_avatar_upload_enabled").eq("id", 1).single();
  if (!settings?.apprentice_avatar_upload_enabled) {
    return Response.json({ error: "Profile picture upload is turned off right now" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Image too large (5MB max)" }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return Response.json({ error: "Use a JPG, PNG, or WEBP image" }, { status: 400 });

  const admin = createAdminClient();
  const path = user.id + "." + ext;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("avatars").upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) return Response.json({ error: "Could not upload" }, { status: 400 });

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  const url = pub.publicUrl + "?v=" + Date.now(); // cache-bust so a re-upload shows immediately

  const { error: dbErr } = await admin.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (dbErr) return Response.json({ error: "Could not save" }, { status: 400 });

  return Response.json({ ok: true, url });
}

export async function DELETE() {
  const { supabase, user, error } = await requireUser();
  if (error) return error;

  const admin = createAdminClient();
  await admin.storage.from("avatars").remove([user.id + ".jpg", user.id + ".png", user.id + ".webp"]);
  const { error: dbErr } = await admin.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (dbErr) return Response.json({ error: "Could not remove" }, { status: 400 });

  return Response.json({ ok: true });
}
