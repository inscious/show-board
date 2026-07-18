import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { CATS_META } from "@/lib/core";

/* Reads uploaded OJT slips (PDF/photo) and turns them into draft
   {m,a,b,c,d} rows for the apprentice to review before anything is saved.
   Can't use guardedRoute (multipart body, not JSON) — auth + rate limit
   here mirror what it does internally, same pattern as
   app/api/admin/avatar/route.js, but for any signed-in user, not admin-only.
   Files are read into memory for this one request and never written to
   storage or disk — nothing to clean up, nothing extra retained. */

const MAX_FILES = 10;
const MAX_BYTES = 8_000_000; // 8MB/file — a phone photo or a scanned PDF page
const ALLOWED = { "application/pdf": true, "image/jpeg": true, "image/png": true, "image/webp": true };

const catLines = (["A", "B", "C", "D"])
  .map((k) => `${k} — ${CATS_META[k].name}: ${CATS_META[k].desc}`)
  .join("\n");

const SYSTEM_PROMPT = `You read scanned or photographed IUPAT OJT (on-the-job-training) monthly hour slips and extract the hours reported for each of the four work-process categories, for every month shown across all the documents given to you.

The four categories:
${catLines}

For each distinct month you find (a slip may show one month or several), report:
- month: the calendar month the hours were worked, as "YYYY-MM"
- cat_a, cat_b, cat_c, cat_d: hours reported for that category that month, as numbers (0 if the slip shows none/blank for that category — never leave a category out)
- confidence: "high" if the numbers are clearly printed/legible, "low" if handwriting, a smudge, glare, or a cut-off edge made you guess at a digit

If the same month appears more than once across the files (e.g. a duplicate photo), only report it once, using the clearer of the two readings. If a document has no readable OJT hours at all, don't invent a month for it — just omit it. Never fabricate a month or number that isn't actually shown.`;

const EXTRACT_TOOL = {
  name: "report_extracted_months",
  description: "Report every OJT month found across the provided documents.",
  input_schema: {
    type: "object",
    properties: {
      months: {
        type: "array",
        items: {
          type: "object",
          properties: {
            month: { type: "string", description: "YYYY-MM" },
            cat_a: { type: "number" },
            cat_b: { type: "number" },
            cat_c: { type: "number" },
            cat_d: { type: "number" },
            confidence: { type: "string", enum: ["high", "low"] },
          },
          required: ["month", "cat_a", "cat_b", "cat_c", "cat_d", "confidence"],
        },
      },
    },
    required: ["months"],
  },
};

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "OJT upload isn't available right now." }, { status: 503 });
  }

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ok = await checkRateLimit(supabase, `api:ojt-extract:${user.id}`, 8, 3600);
  if (!ok) {
    return Response.json({ error: "Too many uploads. Try again in a bit." }, { status: 429 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Malformed upload" }, { status: 400 });
  }

  const files = form.getAll("file").filter((f) => f instanceof File);
  if (files.length === 0) return Response.json({ error: "No files given" }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `Send at most ${MAX_FILES} files at a time` }, { status: 400 });

  const content = [];
  for (const file of files) {
    if (!ALLOWED[file.type]) {
      return Response.json({ error: `${file.name}: use a PDF, JPG, PNG, or WEBP` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: `${file.name}: too large (8MB max)` }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    content.push({
      type: file.type === "application/pdf" ? "document" : "image",
      source: { type: "base64", media_type: file.type, data: bytes },
    });
  }
  content.push({ type: "text", text: `${files.length} file(s) above — extract every OJT month you can find across all of them.` });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "report_extracted_months" },
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    console.error("ojt-months/extract Anthropic call failed:", err?.message || err);
    return Response.json({ error: "Couldn't read these files — try clearer photos or add months manually." }, { status: 502 });
  }

  const toolUse = message.content.find((c) => c.type === "tool_use");
  const months = Array.isArray(toolUse?.input?.months) ? toolUse.input.months : [];
  if (months.length === 0) {
    return Response.json({ error: "Couldn't find any OJT months in those files — try clearer photos or add months manually." }, { status: 422 });
  }

  return Response.json({ ok: true, months });
}
