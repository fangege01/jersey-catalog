CREATE TABLE languages (
  locale TEXT PRIMARY KEY,
  path_prefix TEXT NOT NULL UNIQUE,
  language_name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  is_enabled INTEGER NOT NULL CHECK (is_enabled IN (0,1)),
  is_default INTEGER NOT NULL CHECK (is_default IN (0,1)),
  text_direction TEXT NOT NULL CHECK (text_direction IN ('ltr','rtl')),
  sort_order INTEGER NOT NULL
);
CREATE UNIQUE INDEX languages_one_default ON languages(is_default) WHERE is_default = 1;
INSERT INTO languages VALUES
  ('en','','English','English',1,1,'ltr',0),
  ('zh-CN','zh-cn','Simplified Chinese','简体中文',1,0,'ltr',1);

ALTER TABLE storefront_translations ADD COLUMN slug TEXT;
ALTER TABLE storefront_translations ADD COLUMN publication_json TEXT;
ALTER TABLE storefront_translations ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE storefront_translations ADD COLUMN updated_at TEXT;
CREATE UNIQUE INDEX storefront_translation_slugs ON storefront_translations(locale,entity,slug) WHERE slug IS NOT NULL;

CREATE TABLE product_image_translations (
  image_id INTEGER NOT NULL REFERENCES product_images(id) ON DELETE CASCADE,
  locale TEXT NOT NULL REFERENCES languages(locale),
  image_key TEXT NOT NULL,
  content_sha256 TEXT,
  alt_text TEXT NOT NULL,
  image_title TEXT NOT NULL,
  caption TEXT NOT NULL,
  PRIMARY KEY (image_id,locale)
);

CREATE TABLE storefront_translation_redirects (
  locale TEXT NOT NULL,
  entity TEXT NOT NULL,
  old_slug TEXT NOT NULL,
  public_id TEXT NOT NULL,
  PRIMARY KEY (locale,entity,old_slug),
  FOREIGN KEY (locale,entity,public_id) REFERENCES storefront_translations(locale,entity,public_id) ON DELETE CASCADE
);

CREATE TRIGGER storefront_translation_reserve_slug_insert
BEFORE INSERT ON storefront_translations
WHEN EXISTS (SELECT 1 FROM storefront_translation_redirects r WHERE r.locale=NEW.locale AND r.entity=NEW.entity
 AND r.old_slug=NEW.slug AND r.public_id<>NEW.public_id)
BEGIN
  SELECT RAISE(ABORT,'Localized slug reserved by a redirect');
END;

CREATE TRIGGER storefront_translation_reserve_slug_update
BEFORE UPDATE OF slug ON storefront_translations
WHEN EXISTS (SELECT 1 FROM storefront_translation_redirects r WHERE r.locale=NEW.locale AND r.entity=NEW.entity
 AND r.old_slug=NEW.slug AND r.public_id<>NEW.public_id)
BEGIN
  SELECT RAISE(ABORT,'Localized slug reserved by a redirect');
END;

CREATE TRIGGER storefront_translation_keep_slug
AFTER UPDATE OF slug ON storefront_translations
WHEN OLD.slug IS NOT NULL AND OLD.slug<>NEW.slug AND OLD.revision>0
BEGIN
  DELETE FROM storefront_translation_redirects
    WHERE locale=NEW.locale AND entity=NEW.entity AND old_slug=NEW.slug AND public_id=NEW.public_id;
  INSERT INTO storefront_translation_redirects VALUES (OLD.locale,OLD.entity,OLD.slug,OLD.public_id);
END;
