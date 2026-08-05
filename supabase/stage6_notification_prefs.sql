-- Self-editable notification channel preferences. Not privilege columns —
-- same tier as city/local/phone, not gated by protect_profile_privilege_columns().
-- Email defaults on (matches how DNH/approve-signup emails already behaved,
-- unconditionally, before this column existed). SMS defaults off (new
-- capability, real per-message cost, opt-in is correct for text messages).
alter table profiles add column if not exists notify_email boolean not null default true;
alter table profiles add column if not exists notify_sms boolean not null default false;
