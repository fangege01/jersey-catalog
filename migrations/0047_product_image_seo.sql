ALTER TABLE product_images ADD COLUMN title TEXT;
ALTER TABLE product_images ADD COLUMN caption TEXT;
ALTER TABLE product_images ADD COLUMN angle TEXT;
ALTER TABLE product_images ADD COLUMN content_sha256 TEXT;
ALTER TABLE products ADD COLUMN import_seo_json TEXT;
