-- Learning data: per-item results, practice sessions (review / daily puzzle / training),
-- puzzle rating, weekly class goal and idempotent attempts (offline queue).

-- One row per puzzle / question / level a student played. Tenant scope: through the student.
--  * source 'activity': item = index inside activities.content_json (attempt_id set)
--  * source 'repaso'  : a failed activity item played again (activity_id + item of the original)
--  * source 'diario' / 'entrena': a Lichess puzzle (lichess_id set, activity_id NULL)
CREATE TABLE item_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  item INTEGER,
  lichess_id TEXT,
  attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  ok INTEGER NOT NULL,            -- 1 = solved without help, 0 = failed / needed hints
  mistakes INTEGER NOT NULL DEFAULT 0,
  seconds INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL,              -- YYYY-MM-DD (Madrid)
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_item_results_student ON item_results(student_id, activity_id, item);
CREATE INDEX idx_item_results_activity ON item_results(activity_id, item);
CREATE INDEX idx_item_results_source ON item_results(student_id, source, day);

-- Puzzles served by the server for practice; results are only accepted for these.
CREATE TABLE practice_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- 'repaso' | 'diario' | 'entrena'
  puzzles_json TEXT NOT NULL,     -- [{ puzzle, src: { activityId, item } | { lichessId, rating } }]
  day TEXT NOT NULL,
  finished_at INTEGER,
  solved INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  seconds INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_practice_student ON practice_sessions(student_id, kind, day);

-- Tactics rating for the "Entrena" mode (0 = not placed yet; the start depends on the age group).
ALTER TABLE students ADD COLUMN puzzle_rating INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN puzzle_games INTEGER NOT NULL DEFAULT 0;

-- Cooperative weekly goal in puzzles solved by the whole class (0 = automatic).
ALTER TABLE classes ADD COLUMN weekly_goal INTEGER NOT NULL DEFAULT 0;

-- Client-generated id so a result queued offline and sent twice is saved once.
ALTER TABLE attempts ADD COLUMN nonce TEXT;
CREATE UNIQUE INDEX idx_attempts_nonce ON attempts(student_id, nonce) WHERE nonce IS NOT NULL;

-- Coach dashboards read attempts per activity for a class.
CREATE INDEX idx_attempts_activity ON attempts(activity_id, student_id);
