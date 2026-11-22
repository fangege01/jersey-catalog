CREATE TABLE contact_inquiries (
  id TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  country TEXT NOT NULL,
  business_type TEXT NOT NULL,
  interest TEXT NOT NULL,
  estimated_quantity TEXT NOT NULL,
  order_type TEXT NOT NULL,
  message TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'zh-CN')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled'))
);

CREATE INDEX contact_inquiries_received_at ON contact_inquiries(received_at DESC, id DESC);
CREATE INDEX contact_inquiries_status_received_at ON contact_inquiries(status, received_at DESC, id DESC);
