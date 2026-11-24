CREATE TABLE product_publications (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  sku_key TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  image_count INTEGER NOT NULL CHECK (image_count BETWEEN 1 AND 20),
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER product_publications_verify
BEFORE INSERT ON product_publications
BEGIN
  SELECT RAISE(ABORT, 'Incomplete publication') WHERE NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = NEW.product_id AND p.active = 0
      AND p.import_seo_json IS NOT NULL
      AND EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id AND i.position = 0 AND i.image_key = p.image_key)
      AND (SELECT COUNT(*) FROM product_images i WHERE i.product_id = p.id) = NEW.image_count
      AND (SELECT COUNT(*) FROM product_images i JOIN media m ON m.image_key = i.image_key
           WHERE i.product_id = p.id AND i.content_sha256 IS NOT NULL) = NEW.image_count
  );
  SELECT RAISE(ABORT, 'Duplicate imported SKU') WHERE EXISTS (
    SELECT 1 FROM product_import_sources s
    WHERE s.product_id <> NEW.product_id AND lower(trim(s.source_sku)) = NEW.sku_key
  );
END;

CREATE TABLE product_slug_redirects (
  old_slug TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

CREATE TRIGGER products_reserve_old_slug_insert
BEFORE INSERT ON products WHEN EXISTS (SELECT 1 FROM product_slug_redirects WHERE old_slug = NEW.slug)
BEGIN
  SELECT RAISE(ABORT, 'Product slug is reserved by a redirect');
END;

CREATE TRIGGER products_reserve_old_slug_update
BEFORE UPDATE OF slug ON products WHEN OLD.slug <> NEW.slug
  AND EXISTS (SELECT 1 FROM product_slug_redirects WHERE old_slug = NEW.slug AND product_id <> OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Product slug is reserved by another product');
END;

CREATE TRIGGER products_keep_old_slug
AFTER UPDATE OF slug ON products WHEN OLD.slug <> NEW.slug
BEGIN
  DELETE FROM product_slug_redirects WHERE old_slug = NEW.slug AND product_id = OLD.id;
  INSERT INTO product_slug_redirects (old_slug, product_id)
    SELECT OLD.slug, OLD.id WHERE OLD.active = 1 OR EXISTS (SELECT 1 FROM product_publications WHERE product_id = OLD.id);
END;
