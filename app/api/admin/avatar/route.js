import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* File upload — can't go through guardedRoute (it assumes a JSON body via
   request.json(), which throws on multipart/form-data), so the session +
   admin check here mirrors what guardedRoute does internally instead.
   Storage write uses the service-role client since apprentices have no
   write access to the `avatars` bucket at all (see schema.sql). */
async function requireAdmin() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { error: Response.json({ error: "Admin only" }, { status: 403 }) };
  return { user };
}

const MAX_BYTES = 5_000_000; // 5MB — a phone photo, not a print file
const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const form = await request.formData();
  const userId = form.get("userId");
  const file = form.get("file");
  if (!userId || typeof userId !== "string") return Response.json({ error: "Missing userId" }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Image too large (5MB max)" }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return Response.json({ error: "Use a JPG, PNG, or WEBP image" }, { status: 400 });

  const admin = createAdminClient();
  const path = userId + "." + ext;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("avatars").upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) return Response.json({ error: "Could not upload" }, { status: 400 });

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  const url = pub.publicUrl + "?v=" + Date.now(); // cache-bust so a re-upload shows immediately

  const { error: dbErr } = await admin.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (dbErr) return Response.json({ error: "Could not save" }, { status: 400 });

  return Response.json({ ok: true, url });
}

export async function DELETE(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { userId } = await request.json();
  if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });

  const admin = createAdminClient();
  await admin.storage.from("avatars").remove([userId + ".jpg", userId + ".png", userId + ".webp"]);
  const { error: dbErr } = await admin.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (dbErr) return Response.json({ error: "Could not remove" }, { status: 400 });

  return Response.json({ ok: true });
}
