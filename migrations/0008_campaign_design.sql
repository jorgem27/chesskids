-- Campaigns v2: explicit node order, a visual theme per map, one assignment per class,
-- and rewards that are actually granted when a student finishes a campaign.

-- Node order on the map (was implicit by id). Existing nodes keep their current order.
ALTER TABLE campaign_nodes ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
UPDATE campaign_nodes SET position = id;
CREATE INDEX idx_campaign_nodes_order ON campaign_nodes(campaign_id, position);

-- Map look: 'bosque' | 'playa' | 'desierto' | 'nieve' | 'espacio' | 'volcan' (src/lib/campaigns.ts).
ALTER TABLE campaigns ADD COLUMN theme TEXT NOT NULL DEFAULT 'bosque';
ALTER TABLE campaigns ADD COLUMN emoji TEXT NOT NULL DEFAULT '🗺️';

-- A campaign could be assigned twice to the same class: drop duplicates, then forbid them.
DELETE FROM class_campaigns WHERE id NOT IN (SELECT MIN(id) FROM class_campaigns GROUP BY class_id, campaign_id);
CREATE UNIQUE INDEX idx_class_campaigns_unique ON class_campaigns(class_id, campaign_id);
CREATE INDEX idx_class_campaigns_campaign ON class_campaigns(campaign_id);

-- Progress lookups by node (coach view of a whole class).
CREATE INDEX idx_campaign_progress_node ON campaign_progress(node_id);

-- Unlockables a student owns that are not derived from XP (campaign rewards).
-- unlock_id is a reward id from CAMPAIGN_REWARDS. Scoped through the student (class -> club).
CREATE TABLE student_unlocks (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unlock_id TEXT NOT NULL,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (student_id, unlock_id)
) WITHOUT ROWID;

-- One row per campaign a student finished (all nodes done). Drives the "conquistador" stickers.
CREATE TABLE campaign_completions (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  completed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (student_id, campaign_id)
) WITHOUT ROWID;
