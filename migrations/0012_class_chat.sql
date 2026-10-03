-- Class chat: a group chat per class plus private chats between classmates. Text and chess only
-- (puzzles, games, positions): no images, stickers or links. Coaches can read every message.
-- All additive.

-- 'on' = group + private chats, 'group' = only the class chat, 'off' = no chat for this class.
ALTER TABLE classes ADD COLUMN chat_mode TEXT NOT NULL DEFAULT 'on';

-- Scoped through the class (classes.club_id). thread = 'clase' or 'dm:<low id>-<high id>' (student ids).
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  thread TEXT NOT NULL,
  sender_type TEXT NOT NULL,              -- 'student' | 'coach'
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER,                   -- private chats: the other student (for unread counts)
  kind TEXT NOT NULL DEFAULT 'text',      -- 'text' | 'puzzle' | 'game'
  body TEXT NOT NULL DEFAULT '',
  chess_json TEXT,                        -- puzzle: {fen, moves, prompt}; game: {start, moves, fen}
  hidden INTEGER NOT NULL DEFAULT 0,      -- hidden by a coach (students no longer see it)
  flagged INTEGER NOT NULL DEFAULT 0,     -- 1 = a student reported it, 2 = the word filter caught it
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_messages_thread ON messages(class_id, thread, id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id, id) WHERE recipient_id IS NOT NULL;
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id, created_at);
CREATE INDEX idx_messages_flagged ON messages(class_id, id) WHERE flagged > 0;
CREATE INDEX idx_messages_created ON messages(created_at);

-- Last message each student has seen per thread (unread badges).
CREATE TABLE message_reads (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  thread TEXT NOT NULL,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, thread)
) WITHOUT ROWID;
