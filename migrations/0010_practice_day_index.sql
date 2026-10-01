-- Weekly league / class challenge sum practice_sessions by (student_id, day >= monday)
-- without filtering by kind: give that range its own index.
CREATE INDEX idx_practice_student_day ON practice_sessions(student_id, day);
