-- Refresh the machine-translated English hero as a unit. An editor's newer
-- wording or other site content takes precedence over this one-time update.
UPDATE settings
SET value = json_set(value,
  '$.eyebrow', 'FXF Teamwear',
  '$.heroTitle', 'Soccer Jerseys',
  '$.heroAccent', 'for Players & Teams',
  '$.heroIntro', 'Shop for yourself or outfit your club. Add custom names, numbers, and team logos, or request a quote for a bulk order.'),
  updated_at = datetime('now')
WHERE key = 'site_content:home:en'
  AND json_extract(value, '$.eyebrow') = 'Football clothes and team sports clothes.'
  AND json_extract(value, '$.heroTitle') = 'For individuals, teams and football clubs.'
  AND json_extract(value, '$.heroAccent') = 'Selection · Customization · Mass Procurement'
  AND json_extract(value, '$.heroIntro') = 'FXF provides football shirts and team equipment to individual consumers, teams and football clubs, supporting name, number and team logo customization to meet individual and team purchasing needs.';
