import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

/* Photo of the physical time ticket for one logged work_entries row —
   proof-of-work / accuracy record, private to the apprentice. Can't use
   guardedRoute for POST (multipart body, not JSON) — same hand-rolled
   auth + rate limit pattern as app/api/portfolio/photos/route.js and
   app/api/admin/avatar/route.js. Writes through the caller's own
   RLS-scoped client — the `time_tickets` bucket's own-folder policy and
   time_ticket_photos' own-rows RLS (joined through work_entry_id) already
   allow it, nothing here needs a service-role bypass. */

const MAX_BYTES = 8_000_000; // 8MB — a phone photo of a paper ticket
const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function requireUser(supabase) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  return { user };
}

export async function POST(request) {
  const supabase = createClient();
  const { user, error } = await requireUser(supabase);
  if (error) return error;

  const ok = await checkRateLimit(supabase, `api:time-tickets:photos:post:${user.id}`, 30, 3600);
  if (!ok) return Response.json({ error: "Too many uploads. Try again in a bit." }, { status: 429 });

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Malformed upload" }, { status: 400 });
  }

  const workEntryId = form.get("workEntryId");
  const file = form.get("file");
  if (!workEntryId || typeof workEntryId !== "string") return Response.json({ error: "Missing workEntryId" }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Image too large (8MB max)" }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return Response.json({ error: "Use a JPG, PNG, or WEBP image" }, { status: 400 });

  // confirms ownership of the entry via RLS before writing anything — a
  // workEntryId that isn't this user's (or doesn't exist) reads back null.
  const { data: entry } = await supabase.from("work_entries").select("id").eq("id", workEntryId).maybeSingle();
  if (!entry) return Response.json({ error: "Logged entry not found" }, { status: 404 });

  const photoId = crypto.randomUUID();
  const path = `${user.id}/${workEntryId}/${photoId}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from("time_tickets").upload(path, bytes, { contentType: file.type });
  if (upErr) return Response.json({ error: "Could not upload" }, { status: 400 });

  const { error: dbErr } = await supabase.from("time_ticket_photos").insert({
    id: photoId,
    work_entry_id: workEntryId,
    storage_path: path,
  });
  if (dbErr) {
    await supabase.storage.from("time_tickets").remove([path]);
    return Response.json({ error: "Could not save" }, { status: 400 });
  }

  const { data: signed } = await supabase.storage.from("time_tickets").createSignedUrl(path, 3600);
  return Response.json({ ok: true, id: photoId, url: signed?.signedUrl || null });
}

export async function DELETE(request) {
  const supabase = createClient();
  const { user, error } = await requireUser(supabase);
  if (error) return error;

  const ok = await checkRateLimit(supabase, `api:time-tickets:photos:delete:${user.id}`, 30, 3600);
  if (!ok) return Response.json({ error: "Too many requests. Slow down." }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }
  const id = body?.id;
  if (!id || typeof id !== "string") return Response.json({ error: "Missing id" }, { status: 400 });

  const { data: photo } = await supabase.from("time_ticket_photos").select("storage_path").eq("id", id).maybeSingle();
  if (!photo) return Response.json({ error: "Not found" }, { status: 404 });

  const { error: dbErr } = await supabase.from("time_ticket_photos").delete().eq("id", id);
  if (dbErr) return Response.json({ error: "Could not delete" }, { status: 400 });
  await supabase.storage.from("time_tickets").remove([photo.storage_path]);

  return Response.json({ ok: true });
}
