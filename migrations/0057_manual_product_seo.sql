-- Nullable overrides preserve imported SEO and existing product URLs.
ALTER TABLE products ADD COLUMN seo_title TEXT;
ALTER TABLE products ADD COLUMN meta_description TEXT;

-- 0002 already backfilled historic rows. Repair only any legacy imports that
-- still have no URL. Existing Slugs and reserved redirects take precedence.
WITH RECURSIVE
  chars(id, remaining, output) AS (
    SELECT id, lower(substr(name, 1, 240)), '' FROM products WHERE slug IS NULL OR slug = ''
    UNION ALL
    SELECT id, substr(remaining, 2),
      CASE
        WHEN substr(remaining, 1, 1) GLOB '[a-z0-9]' THEN output || substr(remaining, 1, 1)
        WHEN substr(remaining, 1, 1) IN ('''', '’', '`') THEN output
        WHEN output = '' OR substr(output, -1) = '-' THEN output
        ELSE output || '-'
      END
    FROM chars WHERE remaining <> '' AND length(output) < 80
  ),
  names AS MATERIALIZED (
    SELECT id, COALESCE(NULLIF(rtrim(output, '-'), ''), 'product') AS base FROM chars
    WHERE remaining = '' OR length(output) = 80
  ),
  preferred AS MATERIALIZED (
    SELECT min(n.id) AS id, n.base AS slug FROM names n
    WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = n.base)
      AND NOT EXISTS (SELECT 1 FROM product_slug_redirects r WHERE r.old_slug = n.base)
    GROUP BY n.base
  ),
  fallback(id, stem, attempt, slug) AS (
    SELECT id, rtrim(substr(base, 1, 48), '-') || '-legacy-' || id, 1,
      rtrim(substr(base, 1, 48), '-') || '-legacy-' || id || '-1'
    FROM names WHERE id NOT IN (SELECT id FROM preferred)
    UNION ALL
    SELECT id, stem, attempt + 1, stem || '-' || (attempt + 1)
    FROM fallback f
    WHERE EXISTS (SELECT 1 FROM products p WHERE p.slug = f.slug)
       OR EXISTS (SELECT 1 FROM product_slug_redirects r WHERE r.old_slug = f.slug)
       OR EXISTS (SELECT 1 FROM preferred p WHERE p.slug = f.slug)
  ),
  resolved AS MATERIALIZED (
    SELECT id, slug FROM preferred
    UNION ALL
    SELECT id, slug FROM fallback f
    WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = f.slug)
      AND NOT EXISTS (SELECT 1 FROM product_slug_redirects r WHERE r.old_slug = f.slug)
      AND NOT EXISTS (SELECT 1 FROM preferred p WHERE p.slug = f.slug)
  )
UPDATE products SET slug = (SELECT slug FROM resolved WHERE resolved.id = products.id)
WHERE slug IS NULL OR slug = '';
