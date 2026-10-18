-- Saved verification reports are written only by the server (src/lib/reports.ts, with the secret key), never with a
-- user's session. Otherwise a student could store a made-up report through the API, which admins would then review
-- as if Maqsad had produced it. Owners still read and delete their own reports; admins read all.

drop policy "Students save their own reports" on public.verification_reports;
revoke insert on public.verification_reports from authenticated;
