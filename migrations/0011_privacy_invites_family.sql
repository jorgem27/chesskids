-- Privacy (parental consent), coach password reset, club invites, family reports, starter content
-- and opt-in push reminders. All additive.

-- Parental consent recorded by the coach when the student is created (NULL = not recorded yet,
-- for students created before this migration). consent_by = coach who recorded it.
ALTER TABLE students ADD COLUMN consent_at INTEGER;
ALTER TABLE students ADD COLUMN consent_by INTEGER REFERENCES coaches(id) ON DELETE SET NULL;

-- Read-only family report link (/familia/<token>). NULL = no link; the coach creates or revokes it.
ALTER TABLE students ADD COLUMN family_token TEXT;
CREATE UNIQUE INDEX idx_students_family_token ON students(family_token) WHERE family_token IS NOT NULL;

-- Starter content pack imported into the club (0 = never). Bumped when a newer pack is imported.
ALTER TABLE clubs ADD COLUMN starter_version INTEGER NOT NULL DEFAULT 0;

-- One-time password reset links for coaches. Only the SHA-256 of the token is stored.
-- created_by: club admin who generated it (NULL = requested by the coach by email).
CREATE TABLE coach_password_resets (
  token_hash TEXT PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
) WITHOUT ROWID;
CREATE INDEX idx_password_resets_coach ON coach_password_resets(coach_id);

-- Invitations to join a club as a coach. Registration requires one (or the platform signup code).
-- Only the SHA-256 of the code is stored; the club admin sees it once when it is created.
CREATE TABLE club_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'coach',     -- 'coach' | 'admin'
  note TEXT NOT NULL DEFAULT '',          -- e.g. who it is for
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_club_invites_club ON club_invites(club_id, id);

-- Web Push subscriptions (opt-in, off by default) for streak reminders. Scoped through the student.
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_sent_day TEXT
) WITHOUT ROWID;
CREATE INDEX idx_push_student ON push_subscriptions(student_id);

-- Coach pages look clubs and classes up by coach (menu, dashboard): index the second PK column.
CREATE INDEX IF NOT EXISTS idx_club_coaches_coach ON club_coaches(coach_id, role);
CREATE INDEX IF NOT EXISTS idx_class_permissions_coach ON class_permissions(coach_id);
