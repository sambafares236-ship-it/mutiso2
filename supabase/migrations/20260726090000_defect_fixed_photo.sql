-- defect_log.photo_url already exists (report-time evidence) but was
-- never written by the frontend - the "Mark Fixed" action needs its own
-- slot for a proof-of-fix photo, separate from the original report
-- photo, since both can legitimately exist on the same defect.

alter table public.defect_log
  add column fixed_photo_url text;
