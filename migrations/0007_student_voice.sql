-- Potróculo voice chosen by the student for their activities: a voice id from
-- src/lib/voice/coaches.ts, 'random' (a different one each session) or 'none' (sounds only).
-- Read through the student's own row (already scoped by the session), so no new index.
ALTER TABLE students ADD COLUMN voice TEXT NOT NULL DEFAULT 'random';
