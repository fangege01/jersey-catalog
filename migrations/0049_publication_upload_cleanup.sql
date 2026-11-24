CREATE TABLE publication_upload_objects (
  object_key TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  delete_after INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'attached', 'deleting', 'deleted')),
  claim_token TEXT,
  claim_until INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  last_error TEXT
);
CREATE INDEX publication_upload_sweep ON publication_upload_objects (state, delete_after);
CREATE INDEX publication_upload_task ON publication_upload_objects (task_id);

CREATE TRIGGER publication_upload_gallery_fence
BEFORE INSERT ON product_images
WHEN EXISTS (
  SELECT 1 FROM publication_upload_objects j WHERE j.object_key = NEW.image_key AND j.state IN ('deleting', 'deleted')
)
BEGIN
  SELECT RAISE(ABORT, 'Publication image is being cleaned up');
END;

CREATE TRIGGER publication_upload_media_fence
BEFORE INSERT ON media
WHEN EXISTS (
  SELECT 1 FROM publication_upload_objects j WHERE j.object_key = NEW.image_key
    AND (j.state <> 'pending' OR j.delete_after <= unixepoch())
)
BEGIN
  SELECT RAISE(ABORT, 'Publication image lease expired');
END;
