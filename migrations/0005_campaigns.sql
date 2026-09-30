-- Overworld Map Campaigns
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES coaches(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reward_type TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_campaigns_club ON campaigns(club_id);

-- Nodes in a campaign
CREATE TABLE campaign_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
  x_pos INTEGER NOT NULL DEFAULT 0,
  y_pos INTEGER NOT NULL DEFAULT 0,
  unlocks TEXT NOT NULL DEFAULT '[]', -- JSON array of node IDs that this node unlocks
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_campaign_nodes_campaign ON campaign_nodes(campaign_id);

-- Assign campaigns to classes
CREATE TABLE class_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES coaches(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_class_campaigns_class ON class_campaigns(class_id);

-- Track campaign node completions per student
CREATE TABLE campaign_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES campaign_nodes(id) ON DELETE CASCADE,
  completed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_campaign_progress_unique ON campaign_progress(student_id, node_id);
