-- ChessKids Academy schema (Cloudflare D1 / SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE coaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- A coach can belong to several clubs. role: 'admin' (manages club) | 'coach'
CREATE TABLE club_coaches (
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  coach_id INTEGER NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'coach',
  PRIMARY KEY (club_id, coach_id)
);

CREATE TABLE classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL DEFAULT '♞',
  color TEXT NOT NULL DEFAULT 'violet',
  created_by INTEGER REFERENCES coaches(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Granular per-class permissions between coaches.
CREATE TABLE class_permissions (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  coach_id INTEGER NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  is_owner INTEGER NOT NULL DEFAULT 0,
  can_view_progress INTEGER NOT NULL DEFAULT 1,
  can_create_content INTEGER NOT NULL DEFAULT 0,
  can_manage_students INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (class_id, coach_id)
);

CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🦁',
  age_group TEXT NOT NULL DEFAULT 'explorador',
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  login_token TEXT NOT NULL UNIQUE,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_active_day TEXT,
  total_seconds INTEGER NOT NULL DEFAULT 0,
  puzzles_solved INTEGER NOT NULL DEFAULT 0,
  games_completed INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_students_class ON students(class_id);

-- Content library (per club, reusable across classes).
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES coaches(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 30,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_activities_club ON activities(club_id);

-- Homework / class missions.
CREATE TABLE assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES coaches(id),
  starts_on TEXT NOT NULL,  -- YYYY-MM-DD
  due_on TEXT,              -- YYYY-MM-DD (nullable = no deadline)
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_assignments_class ON assignments(class_id);

CREATE TABLE attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL,
  stars INTEGER NOT NULL,
  xp_earned INTEGER NOT NULL,
  seconds INTEGER NOT NULL,
  mistakes INTEGER NOT NULL DEFAULT 0,
  puzzles_solved INTEGER NOT NULL DEFAULT 0,
  perfect INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL,
  completed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_attempts_student ON attempts(student_id, activity_id);
CREATE INDEX idx_attempts_day ON attempts(student_id, day);

CREATE TABLE student_stickers (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sticker_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (student_id, sticker_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,          -- SHA-256 of the cookie token
  user_type TEXT NOT NULL,      -- 'coach' | 'student'
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_sessions_user ON sessions(user_type, user_id);

CREATE TABLE login_failures (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
