-- Script para crear una campaña de prueba con 10 nodos (localmente)
INSERT INTO campaigns (id, club_id, created_by, title, description, reward_type) 
VALUES (999, 1, 1, 'Campaña de Prueba: 10 Retos', 'Supera estos 10 problemas para ganar.', 'sticker_dragon')
ON CONFLICT(id) DO UPDATE SET title=excluded.title;

-- Borrar nodos anteriores si los hay
DELETE FROM campaign_nodes WHERE campaign_id = 999;

-- Insertar 10 nodos apuntando a actividades existentes
-- Asumimos que hay actividades en la BD (tomamos las primeras 10)
INSERT INTO campaign_nodes (campaign_id, activity_id, x_pos, y_pos)
SELECT 999, id, 0, 0 FROM activities LIMIT 10;

-- Asignar la campaña a la clase 1 (por defecto en el seed)
INSERT INTO class_campaigns (class_id, campaign_id, assigned_by) 
VALUES (1, 999, 1);
