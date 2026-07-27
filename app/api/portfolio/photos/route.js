import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { guardedRoute } from "@/lib/apiGuard";
import { portfolioPhotoCoverSchema } from "@/lib/schemas";

/* Photo upload/delete — can't go through guardedRoute for POST (multipart
   body, not JSON), so auth + rate limit here mirror what it does internally,
   same pattern as app/api/admin/avatar/route.js and
   app/api/ojt-months/extract/route.js. Unlike the avatar route this writes
   through the caller's own RLS-scoped client, not the service-role one —
   the `portfolio` bucket's "own folder" storage policy already allows it,
   and the DB row's "own rows" RLS (joined through project_id) does too, so
   there's no privileged operation here that needs bypassing RLS for. */

const MAX_BYTES = 8_000_000; // 8MB — a phone photo off a modern camera
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

  const ok = await checkRateLimit(supabase, `api:portfolio:photos:post:${user.id}`, 30, 3600);
  if (!ok) return Response.json({ error: "Too many uploads. Try again in a bit." }, { status: 429 });

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Malformed upload" }, { status: 400 });
  }

  const projectId = form.get("projectId");
  const file = form.get("file");
  if (!projectId || typeof projectId !== "string") return Response.json({ error: "Missing projectId" }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Image too large (8MB max)" }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return Response.json({ error: "Use a JPG, PNG, or WEBP image" }, { status: 400 });

  // confirms ownership of the project via RLS before writing anything —
  // an id for a project that isn't this user's (or doesn't exist) reads
  // back null here rather than letting the upload proceed.
  const { data: project } = await supabase.from("portfolio_projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const photoId = crypto.randomUUID();
  const path = `${user.id}/${projectId}/${photoId}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from("portfolio").upload(path, bytes, { contentType: file.type });
  if (upErr) return Response.json({ error: "Could not upload" }, { status: 400 });

  const { error: dbErr } = await supabase.from("portfolio_project_photos").insert({
    id: photoId,
    project_id: projectId,
    storage_path: path,
  });
  if (dbErr) {
    await supabase.storage.from("portfolio").remove([path]);
    return Response.json({ error: "Could not save" }, { status: 400 });
  }

  const { data: signed } = await supabase.storage.from("portfolio").createSignedUrl(path, 3600);
  return Response.json({ ok: true, id: photoId, url: signed?.signedUrl || null });
}

/* Set-as-cover — a plain JSON body, so this one goes through guardedRoute
   unlike POST/DELETE above. "Cover" isn't its own column: it's just
   whichever photo has the lowest sort_order, since the shared route and
   every gallery already read photos in that order — making a photo the
   cover just means giving it a sort_order lower than anything else in the
   project, same "simple reorder, not drag-and-drop" convention as project
   ordering elsewhere in this feature. */
export async function PATCH(request) {
  return guardedRoute(request, "portfolio:photos:patch", { schema: portfolioPhotoCoverSchema }, async ({ supabase, data }) => {
    const { data: photos } = await supabase
      .from("portfolio_project_photos")
      .select("id, sort_order")
      .eq("project_id", data.projectId);
    if (!photos?.some((p) => p.id === data.id)) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }
    const minOrder = Math.min(0, ...photos.map((p) => p.sort_order));
    const { error } = await supabase
      .from("portfolio_project_photos")
      .update({ sort_order: minOrder - 1 })
      .eq("id", data.id);
    if (error) return Response.json({ error: "Could not update" }, { status: 400 });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request) {
  const supabase = createClient();
  const { user, error } = await requireUser(supabase);
  if (error) return error;

  const ok = await checkRateLimit(supabase, `api:portfolio:photos:delete:${user.id}`, 30, 3600);
  if (!ok) return Response.json({ error: "Too many requests. Slow down." }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }
  const id = body?.id;
  if (!id || typeof id !== "string") return Response.json({ error: "Missing id" }, { status: 400 });

  const { data: photo } = await supabase.from("portfolio_project_photos").select("storage_path").eq("id", id).maybeSingle();
  if (!photo) return Response.json({ error: "Not found" }, { status: 404 });

  const { error: dbErr } = await supabase.from("portfolio_project_photos").delete().eq("id", id);
  if (dbErr) return Response.json({ error: "Could not delete" }, { status: 400 });
  await supabase.storage.from("portfolio").remove([photo.storage_path]);

  return Response.json({ ok: true });
}
