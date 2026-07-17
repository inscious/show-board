/* zod schemas for every mutation route. Bounds on every string field so a
   malformed/oversized payload gets rejected before it ever reaches the DB. */
import { z } from "zod";

const id = z.string().trim().min(1).max(64);
const shortText = z.string().trim().max(200).optional().nullable();
const note = z.string().trim().max(2000).optional().nullable();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const monthStr = z.string().regex(/^\d{4}-\d{2}$/, "expected YYYY-MM");
const mdStr = z.string().trim().max(20).optional().nullable(); // "M/D" off the union sheet

export const showSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  mi: mdStr,
  start: mdStr,
  end: mdStr,
  loc: shortText,
  booth: shortText,
  co: shortText,
  region: z.enum(["SD", "LA", "LB", "OC", "PS", "OTHER"]).optional().nullable(),
  src: z.string().trim().max(20).optional().nullable(),
  sheetMonth: monthStr.optional().nullable(),
});

export const showImportSchema = z.object({ shows: z.array(showSchema).max(500) });
export const showDeleteSchema = z.object({ id });

export const showFlagSchema = z.object({
  showId: id,
  status: z.enum(["working", "target", "passed"]).optional().nullable(),
  note,
});

export const entrySchema = z.object({
  id,
  dayKey: dateStr,
  co: z.string().trim().min(1).max(200),
  cat: z.enum(["A", "B", "C", "D"]),
  note,
  hrs: z.number().min(0).max(24).optional().nullable(),
  in: z.number().int().min(0).max(2880).optional().nullable(),
  out: z.number().int().min(0).max(2880).optional().nullable(),
  brk: z.number().int().min(0).max(480).optional().nullable(),
  showId: id.optional().nullable(),
  // pay math (entrySplit/rateFor in lib/core.js) is computed client-side, same
  // as the on-screen display — this is the user's own data, not a security
  // boundary, so the route just bounds-checks rather than re-deriving it.
  clock: z.number().min(0).max(24),
  st: z.number().min(0).max(24),
  ot: z.number().min(0).max(24),
  dt: z.number().min(0).max(24),
  payRate: z.number().min(0).max(200).optional().nullable(),
});
export const entryDeleteSchema = z.object({ id });

export const ojtMonthSchema = z.object({
  m: monthStr,
  a: z.number().min(0).max(1000),
  b: z.number().min(0).max(1000),
  c: z.number().min(0).max(1000),
  d: z.number().min(0).max(1000),
});
export const ojtMonthDeleteSchema = z.object({ m: monthStr });

export const bookingSchema = z.object({
  id,
  co: z.string().trim().min(1).max(200),
  show: shortText,
  note,
  dates: z.array(dateStr).min(1).max(60),
  dayNotes: z.record(dateStr, z.string().trim().max(200)).optional(),
});
export const bookingDeleteSchema = z.object({ id });

export const rateSchema = z.object({
  co: z.string().trim().min(1).max(200),
  level: z.enum(["L1", "L2", "L3", "L4", "L5", "L6", "EJ", "CJ"]),
});
export const rateDeleteSchema = z.object({ co: z.string().trim().min(1).max(200) });

export const pinSchema = z.object({ name: z.string().trim().min(1).max(200), pinned: z.boolean() });

export const customCompanySchema = z.object({ name: z.string().trim().min(1).max(200) });

/* -------- auth / admin -------- */
const password = z.string().min(8).max(200);
const userId = z.string().uuid();

export const setPasswordSchema = z.object({ password });

export const createApprenticeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password,
  name: z.string().trim().max(200).optional(),
});

export const adminSetPasswordSchema = z.object({ userId, password });

export const adminArchiveApprenticeSchema = z.object({ userId, archived: z.boolean() });
export const adminDeleteApprenticeSchema = z.object({ userId });
export const adminApproveSignupSchema = z.object({ userId });
export const adminDoNotHireSchema = z.object({ userId, onList: z.boolean(), reason: z.string().trim().max(300).optional().nullable() });

export const adminCertReminderSchema = z.object({
  reminders: z.array(z.object({ userId, certName: z.string().trim().min(1).max(200), exp: dateStr })).min(1).max(200),
});

export const adminCompanySchema = z.object({
  name: z.string().trim().min(1).max(200),
  city: shortText, state: shortText, laborLine: shortText, foreman: shortText,
});
export const adminCompanyDeleteSchema = z.object({ name: z.string().trim().min(1).max(200) });

export const adminJatcContactSchema = z.object({
  id, name: z.string().trim().min(1).max(200), tel: shortText, ext: shortText, email: shortText, sms: shortText,
});
export const adminJatcContactDeleteSchema = z.object({ id });

export const adminRevokeAdminSchema = z.object({ userId });

export const adminProfileSchema = z.object({
  userId,
  name: shortText,
  memberId: shortText,
  // both of these have the same shape of bug fixed here: the admin profile
  // form always sends every field, so clearing an input sends "" rather
  // than omitting the key or sending null — but a bare regex still rejects
  // "" even wrapped in .optional().nullable(), since neither of those
  // exempts an empty string from matching the pattern. The route
  // (app/api/admin/profile/route.js) already normalizes falsy last4/joined
  // to null on write; the schema just needs to actually let "" reach it.
  last4: z.union([z.string().trim().regex(/^\d{4}$/, "expected 4 digits"), z.literal("")]).optional().nullable(),
  local: shortText,
  joined: z.union([dateStr, z.literal("")]).optional().nullable(),
  rsiCredits: z.number().min(0).max(1000).optional().nullable(),
  city: shortText,
});

export const adminOjtMonthSchema = z.object({
  userId, m: monthStr,
  a: z.number().min(0).max(1000), b: z.number().min(0).max(1000),
  c: z.number().min(0).max(1000), d: z.number().min(0).max(1000),
});
export const adminOjtMonthDeleteSchema = z.object({ userId, m: monthStr });
export const adminOjtStatusSchema = z.object({ userId, m: monthStr, status: z.enum(["approved", "rejected", "pending"]) });

export const adminClassEditSchema = z.object({
  items: z.array(z.object({ id, userId })).min(1).max(200),
  name: z.string().trim().min(1).max(200),
  start: z.number().int().min(0).max(1440).optional().nullable(),
  loc: shortText,
  note,
  dates: z.array(dateStr).min(1).max(60),
});

export const adminClassAssignSchema = z.object({
  userIds: z.array(userId).min(1).max(200),
  name: z.string().trim().min(1).max(200),
  start: z.number().int().min(0).max(1440).optional().nullable(),
  loc: shortText,
  note,
  dates: z.array(dateStr).min(1).max(60),
});
export const adminClassDeleteSchema = z.object({ userId, id });
export const adminClassAttendanceSchema = z.object({ userId, id, missedDates: z.array(dateStr).max(60) });

export const adminCertSchema = z.object({ userId, id, name: z.string().trim().min(1).max(200), exp: dateStr });
export const adminCertDeleteSchema = z.object({ userId, id });

export const notificationDeleteSchema = z.object({ id: z.union([id, z.literal("all")]) });

/* -------- inferred types --------
   Real TS types generated from the schemas above, not hand-duplicated —
   if a bound or field changes here, every consumer's type updates with it.
   Only the shapes other lib/ modules actually need typed against so far;
   add more as lib/core.ts, lib/store.ts, etc. pick up real types. */
export type EntryInput = z.infer<typeof entrySchema>;
export type OjtMonthInput = z.infer<typeof ojtMonthSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
