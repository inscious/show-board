import { guardedRoute } from "@/lib/apiGuard";
import { portfolioSettingsSchema } from "@/lib/schemas";

/* Whole-portfolio settings — display name, bio, and the whole-portfolio
   share toggle. One row per apprentice, upserted, same "shared flips the
   token, unshared clears it" logic as the per-project route. */
export async function POST(request) {
  return guardedRoute(request, "portfolio:settings:post", { schema: portfolioSettingsSchema }, async ({ supabase, user, data }) => {
    const patch = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    if (data.displayName !== undefined) patch.display_name = data.displayName || null;
    if (data.bio !== undefined) patch.bio = data.bio || null;
    if (data.contactEmail !== undefined) patch.contact_email = data.contactEmail || null;
    if (data.contactPhone !== undefined) patch.contact_phone = data.contactPhone || null;

    if (data.shared !== undefined) {
      if (data.shared) {
        patch.share_token = crypto.randomUUID();
      } else {
        patch.share_token = null;
      }
    }

    const { error } = await supabase.from("portfolio_settings").upsert(patch, { onConflict: "user_id" });
    if (error) return Response.json({ error: "Could not save" }, { status: 400 });

    const { data: row } = await supabase.from("portfolio_settings").select("*").eq("user_id", user.id).maybeSingle();
    return Response.json({ ok: true, settings: row });
  });
}
