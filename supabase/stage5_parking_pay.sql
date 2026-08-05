-- Parking reimbursement — same shape as the existing travel_pay column
-- (flat per-entry stipend, not rate x hours). See Entry type in lib/core.ts.
alter table work_entries add column if not exists parking_pay numeric(6,2) default 0;
