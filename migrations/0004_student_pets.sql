CREATE TABLE student_pets (
  student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  base_pet TEXT NOT NULL DEFAULT 'peon',
  equipped_json TEXT NOT NULL DEFAULT '{}'
);
