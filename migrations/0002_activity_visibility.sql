-- Public vs private activities.
--   'public'  : club library, visible to every coach of the club. Only club admins create/edit them.
--   'private' : belongs to one coach (created_by). Editing a public activity as a non-admin forks it into one of these.
-- source_id points to the public activity a private copy was forked from.
ALTER TABLE activities ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE activities ADD COLUMN source_id INTEGER REFERENCES activities(id) ON DELETE SET NULL;
CREATE INDEX idx_activities_owner ON activities(created_by, visibility);
