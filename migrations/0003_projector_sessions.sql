-- Projector-mode team tournaments: one row per finished tournament plus one row per participating student.
-- XP awarded here is added to students.xp; per-kid rows also feed daily goal / weekly leaderboard (by `day`).
CREATE TABLE projector_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
  nonce TEXT NOT NULL,                 -- client-generated id, makes saving idempotent
  xp_budget INTEGER NOT NULL,          -- max XP a single student could earn
  puzzles_played INTEGER NOT NULL,
  seconds INTEGER NOT NULL,
  teams_json TEXT NOT NULL,            -- [{ name, emoji, color, score }]
  day TEXT NOT NULL,                   -- YYYY-MM-DD (Madrid)
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_projector_sessions_nonce ON projector_sessions(class_id, nonce);
CREATE INDEX idx_projector_sessions_class ON projector_sessions(class_id, id);

CREATE TABLE projector_results (
  session_id INTEGER NOT NULL REFERENCES projector_sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  team INTEGER NOT NULL,               -- index into teams_json
  picks INTEGER NOT NULL DEFAULT 0,    -- times chosen by the dice
  solved INTEGER NOT NULL DEFAULT 0,   -- puzzles solved while chosen
  points INTEGER NOT NULL DEFAULT 0,   -- team points scored while chosen
  xp_earned INTEGER NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (session_id, student_id)
);
CREATE INDEX idx_projector_results_student ON projector_results(student_id, day);
