import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';
import { hashPassword } from '../../src/features/auth/password.ts';
import { richProductValue } from '../../src/features/products/richFormat.ts';

const site = 'https://www.fxfsource.com';
const path = (name) => fileURLToPath(new URL('../../' + name, import.meta.url));
const mf = new Miniflare({
  host: '127.0.0.1', port: 0, modules: true,
  scriptPath: path('dist/server/entry.mjs'), modulesRoot: path('dist/server'),
  assets: { directory: path('dist/client'), binding: 'ASSETS', routerConfig: { has_user_worker: true } },
  compatibilityDate: '2026-07-20', compatibilityFlags: ['nodejs_compat'],
  d1Databases: ['DB'], r2Buckets: ['BUCKET', 'FILES'], kvNamespaces: ['SESSION'],
  bindings: { AUTH_SECRET: randomUUID(), CANONICAL_ORIGIN: site },
});

try {
  const db = await mf.getD1Database('DB');
  for (const name of readdirSync(path('migrations')).filter(name => name.endsWith('.sql')).sort()) {
    if (name === '0057_manual_product_seo.sql') {
      await db.prepare(`INSERT INTO products (name, slug, description, price_cents, active, public_id)
        VALUES ('Legacy Jersey', 'legacy-jersey', 'A **navy** soccer jersey.', 1200, 1, 'prod_aaaaaaaaaaaaaaaaaaaa')`).run();
      await db.prepare(`INSERT INTO products (name, slug, price_cents, active, public_id) VALUES
        ('2026 Club Home Jersey!', NULL, 1200, 1, 'prod_bbbbbbbbbbbbbbbbbbbb'),
        ('2026 Club Home Jersey?', NULL, 1200, 1, 'prod_cccccccccccccccccccc')`).run();
    }
    await db.batch(unstable_splitSqlQuery(readFileSync(path('migrations/' + name), 'utf8')).map(sql => db.prepare(sql)));
  }
  const password = randomUUID();
  await db.prepare("INSERT INTO settings (key,value) VALUES ('setup_complete','1'), ('admin_password_hash',?), ('store_name','FXF')").bind(await hashPassword(password)).run();
  await db.prepare("INSERT INTO settings (key,value) VALUES ('whatsapp_number','12025550123'), ('site_content:contact:en',?)")
    .bind(JSON.stringify({ contactEmail: 'sales@example.test' })).run();
  const origin = (await mf.ready).origin;
  const read = (url, headers) => fetch(origin + url, { redirect: 'manual', headers });
  const post = (url, body, cookie) => fetch(origin + url, {
    redirect: 'manual', method: 'POST', body, headers: { origin, ...(cookie && { cookie }) },
  });
  const login = await post('/admin/login', new URLSearchParams({ password }));
  const cookie = login.headers.getSetCookie().find(value => value.startsWith('admin_session='))?.split(';')[0];
  assert.ok(cookie);
  const saved = (response) => {
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/admin/products');
  };
  const meta = 'Argentina home jersey with a sky-blue and white design. '.repeat(4).trim();
  const fields = { name: 'Argentina Home Jersey', description: 'A **sky-blue** soccer jersey.', active: 'on',
    price: '14', wholesale_10: '12', wholesale_50: '10', wholesale_200: '9',
    slug: ' Argentina & HOME 2026 ', seo_title: 'Argentina Home Jersey | FXF', meta_description: meta };
  const form = (overrides = {}) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ ...fields, ...overrides })) data.set(key, value);
    return data;
  };
  const create = form();
  const png = new File([Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X8pAAAAABJRU5ErkJggg==', 'base64',
  )], 'IMG_001.PNG', { type: 'image/png' });
  create.set('image', png);
  create.set('image_filename', 'Argentina Jersey FRONT.webp');
  create.set('alt', 'Argentina home jersey front view');
  create.set('image_title', 'Argentina jersey front');
  create.set('image_caption', 'Sky-blue and white jersey viewed from the front.');
  const newForm = await (await read('/admin/products/new', { cookie })).text();
  for (const field of ['seo_title', 'meta_description', 'slug']) assert.ok(newForm.includes(`name="${field}"`));
  for (const field of ['image_filename', 'alt']) assert.ok(newForm.includes(`name="${field}"`));
  assert.doesNotMatch(newForm, /name="image_(?:title|caption)"/);
  saved(await post('/api/admin/products', create, cookie));
  const row = await db.prepare("SELECT * FROM products WHERE slug='argentina-home-2026'").first();
  assert.equal(row.seo_title, fields.seo_title);
  assert.equal(row.meta_description, meta);
  assert.deepEqual(JSON.parse(row.wholesale_prices), [1200, 1000, 900]);
  const home = await (await read('/')).text();
  assert.match(home.match(/href="\/products\/argentina-home-2026" class="card-link"[^]*?<\/li>/)?.[0] ?? '', /From \$9\.00/);
  const chineseHome = await (await read('/zh')).text();
  assert.match(chineseHome.match(/href="\/zh\/products\/argentina-home-2026" class="card-link"[^]*?<\/li>/)?.[0] ?? '', /\$9\.00 起/);
  const gallery = async () => (await db.prepare('SELECT * FROM product_images WHERE product_id=? ORDER BY position')
    .bind(row.id).all()).results;
  const [primary] = await gallery();
  assert.match(primary.seo_alias, /\/argentina-jersey-front\.(?:png|webp)$/);
  assert.equal(primary.alt, 'Argentina home jersey front view');
  assert.equal(primary.title, 'Argentina jersey front');
  assert.equal(primary.caption, 'Sky-blue and white jersey viewed from the front.');
  const api = '/api/admin/products/' + row.public_id;
  const editForm = await (await read('/admin/products/' + row.public_id + '/edit', { cookie })).text();
  assert.ok(editForm.includes(`value="${fields.seo_title}"`));
  assert.ok(editForm.includes(meta));
  assert.match(editForm, /<textarea\b[^>]*name="image_filename"[^>]*wrap="soft"/);
  assert.match(editForm, /<textarea\b[^>]*name="alt"[^>]*wrap="soft"/);
  assert.doesNotMatch(editForm, /name="image_(?:title|caption)"/);
  assert.ok(editForm.includes(primary.alt));
  const detail = '/products/' + row.slug;
  const html = await (await read(detail + '?utm_source=test')).text();
  assert.ok(html.includes(`<title>${fields.seo_title}</title>`));
  assert.ok(html.includes(`name="description" content="${meta}"`));
  assert.ok(html.includes(`rel="canonical" href="${site}${detail}"`));
  assert.ok(html.includes(`property="og:url" content="${site}${detail}"`));
  assert.ok(html.includes('property="og:type" content="product"'));
  assert.ok(html.includes(`property="og:title" content="${fields.seo_title}"`));
  assert.ok(html.includes(`property="og:description" content="${meta}"`));
  assert.ok(html.includes(`property="og:image" content="${site}/images/${primary.seo_alias}"`));
  assert.match(html, /<img[^>]*alt="Argentina home jersey front view"[^>]*title="Argentina jersey front"[^>]*loading="eager"/);
  assert.ok(html.includes(primary.caption));
  assert.match(html, /<h1\b[^>]*>Argentina Home Jersey<\/h1>/);
  const quoteLinks = html.match(/class="product-quote-links"[^]*?<\/div>/)?.[0] ?? '';
  assert.equal((quoteLinks.match(/<a\b/gu) ?? []).length, 2);
  assert.match(quoteLinks, /href="https:\/\/wa\.me\/12025550123[^"]*"[^]*?Get a quote on WhatsApp/);
  assert.match(quoteLinks, /href="mailto:sales@example\.test[^"]*"[^]*?Email for a quote/);
  assert.match(quoteLinks, /quote-icon-whatsapp[\s\S]*quote-icon-email/);
  assert.doesNotMatch(html, /Ask about quantities, available sizes, or delivery\./);
  for (const price of ['$14.00', '$12.00', '$10.00', '$9.00']) assert.ok(html.includes(price), price);
  const schema = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(\{"@context":"https:\/\/schema.org","@type":"Product".*?\})<\/script>/s)[1]);
  assert.equal(schema.name, fields.name);
  assert.equal(schema.description, 'A sky-blue soccer jersey.');
  assert.equal(schema.url, site + detail);
  assert.deepEqual(schema.image, [site + '/images/' + primary.seo_alias]);
  for (const key of ['offers', 'brand', 'sku', 'review', 'aggregateRating', 'gtin', 'mpn']) assert.ok(!(key in schema));
  assert.equal((await read('/images/' + row.image_key)).status, 200);
  const oldImage = '/images/' + primary.seo_alias;
  assert.deepEqual(await (await read(oldImage)).arrayBuffer(), await (await read('/images/' + row.image_key)).arrayBuffer());

  const upload = new FormData();
  upload.set('_action', 'add');
  upload.append('images', png);
  const imageApi = api + '/images';
  assert.match((await post(imageApi, upload, cookie)).headers.get('location'), /\/edit#gallery$/);
  const [, second] = await gallery();
  assert.match(second.image_key, /\/argentina-home-jersey-photo\.(?:png|webp)$/);
  assert.equal(second.alt, fields.name);
  const editImage = (image, values) => post(imageApi, new URLSearchParams({ _action: 'seo', image_id: image.public_id, ...values }), cookie);
  const badImage = await editImage(second, { image_filename: '***' });
  assert.match(badImage.headers.get('location'), /\/edit\?error=/);
  assert.match((await editImage(second, { image_filename: 'Back View', alt: 'Argentina home jersey back view',
    image_title: 'Back of the jersey', image_caption: 'Back panel of the Argentina jersey.' })).headers.get('location'), /\/edit#gallery$/);
  assert.match((await editImage(primary, { image_filename: 'Home Shirt Front', alt: '' })).headers.get('location'), /\/edit#gallery$/);
  const [renamedImage, editedSecond] = await gallery();
  assert.equal(renamedImage.alt, null);
  assert.notEqual(renamedImage.seo_alias, primary.seo_alias);
  assert.equal(renamedImage.image_key, primary.image_key);
  assert.match(renamedImage.seo_alias, /\/home-shirt-front\.(?:png|webp)$/);
  assert.equal(renamedImage.title, primary.title);
  assert.equal(renamedImage.caption, primary.caption);
  assert.equal(editedSecond.alt, 'Argentina home jersey back view');
  assert.equal(editedSecond.title, 'Back of the jersey');
  assert.equal(editedSecond.caption, 'Back panel of the Argentina jersey.');
  assert.equal((await read(oldImage)).status, 200);
  assert.equal((await read('/images/' + renamedImage.seo_alias)).status, 200);
  assert.equal((await read('/images/' + editedSecond.seo_alias)).status, 200);
  const galleryHtml = await (await read(detail)).text();
  assert.match(galleryHtml, /<img[^>]*alt="Argentina Home Jersey"[^>]*loading="eager"/);
  assert.match(galleryHtml, /<img[^>]*alt="Argentina home jersey back view"[^>]*title="Back of the jersey"[^>]*loading="lazy"/);
  assert.match(galleryHtml, /<figcaption[^>]*>Back panel of the Argentina jersey\.<\/figcaption>/);
  const legacy = await (await read('/products/legacy-jersey')).text();
  assert.ok(legacy.includes('<title>Legacy Jersey</title>'));
  assert.ok(legacy.includes('name="description" content="A navy soccer jersey."'));
  const repaired = (await db.prepare("SELECT slug FROM products WHERE name LIKE '2026 Club Home Jersey%' ORDER BY id").all()).results;
  assert.equal(repaired[0].slug, '2026-club-home-jersey');
  assert.match(repaired[1].slug, /^2026-club-home-jersey-legacy-\d+-1$/);
  for (const { slug } of repaired) assert.equal((await read('/products/' + slug)).status, 200);

  const sitemap = async () => (await read('/sitemap.xml')).text();
  assert.ok((await sitemap()).includes(site + detail));
  assert.ok((await sitemap()).includes(site + '/images/' + renamedImage.seo_alias));
  assert.ok((await sitemap()).includes(site + '/images/' + editedSecond.seo_alias));
  const duplicate = await post('/api/admin/products', form(), cookie);
  assert.match(duplicate.headers.get('location'), /\/new\?error=/);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM products WHERE name=?").bind(fields.name).first()).count, 1);
  const invalid = await post(api, form({ slug: '***' }), cookie);
  assert.match(invalid.headers.get('location'), /\/edit\?error=/);
  const draftDescription = richProductValue('**Brazil newly created**');
  const automatic = form({ name: 'Brazil Home Jersey', description: draftDescription, slug: '', seo_title: '', meta_description: '' });
  automatic.delete('active');
  saved(await post('/api/admin/products', automatic, cookie));
  assert.equal((await read('/products/brazil-home-jersey')).status, 404);
  assert.ok(!(await sitemap()).includes('/products/brazil-home-jersey'));
  assert.match((await post(api, form({ slug: 'brazil-home-jersey' }), cookie)).headers.get('location'), /\/edit\?error=/);
  const draft = await db.prepare("SELECT public_id, description FROM products WHERE slug='brazil-home-jersey'").first();
  assert.equal(draft.description, draftDescription);
  saved(await post('/api/admin/products/' + draft.public_id, form({
    name: 'Brazil Home Jersey', slug: '', seo_title: '', meta_description: '',
  }), cookie));
  assert.equal((await read('/products/brazil-home-jersey')).status, 200);
  assert.ok((await sitemap()).includes(site + '/products/brazil-home-jersey'));

  const renamed = '/products/argentina-home-player-jersey';
  saved(await post(api, form({ slug: 'argentina-home-player-jersey', seo_title: 'Edited Search Title', meta_description: 'Edited search description.' }), cookie));
  const old = await read(detail + '?utm_source=test');
  assert.equal(old.status, 301);
  assert.equal(new URL(old.headers.get('location'), origin).pathname, renamed);
  assert.equal(new URL(old.headers.get('location'), origin).search, '?utm_source=test');
  assert.match((await post('/api/admin/products', form(), cookie)).headers.get('location'), /\/new\?error=/);
  const newPage = await (await read(renamed)).text();
  assert.ok(newPage.includes('<title>Edited Search Title</title>'));
  assert.ok(newPage.includes('name="description" content="Edited search description."'));
  assert.ok(newPage.includes(`rel="canonical" href="${site}${renamed}"`));
  assert.ok((await sitemap()).includes(site + renamed));
  assert.ok(!(await sitemap()).includes(site + detail));

  saved(await post(api, form({ slug: '', seo_title: '', meta_description: '' }), cookie));
  const cleared = await db.prepare('SELECT slug, seo_title, meta_description FROM products WHERE id=?').bind(row.id).first();
  assert.deepEqual(cleared, { slug: 'argentina-home-player-jersey', seo_title: null, meta_description: null });
  const defaults = await (await read(renamed)).text();
  assert.ok(defaults.includes('<title>Argentina Home Jersey</title>'));
  assert.ok(defaults.includes('name="description" content="A sky-blue soccer jersey."'));
  const richFields = {
    description: richProductValue('## Training kit\n\n### Textile\n\n**Lightweight** fabric and ++care instructions++.\n\n[Contact us](/contact)\n\n| Size | Chest |\n| --- | --- |\n| S | 94 cm |'),
    quoteNote: richProductValue('**Bulk orders**\n\n- First tier\n- Second tier'),
    specifications: richProductValue('**Product Specifications**\n\n✅ Adult XS–4XL\n\n✓ Youth sizes 16–28'),
    shippingPayment: richProductValue('## Shipping & Payment\n\n1. PayPal\n2. Bank transfer'),
  };
  saved(await post(api, form({ slug: '', ...richFields }), cookie));
  const richSaved = await db.prepare('SELECT description, detail_sections FROM products WHERE id=?').bind(row.id).first();
  assert.equal(richSaved.description, richFields.description);
  for (const key of ['quoteNote', 'specifications', 'shippingPayment']) {
    assert.equal(JSON.parse(richSaved.detail_sections).source[key], richFields[key]);
    assert.equal(JSON.parse(richSaved.detail_sections).english[key], richFields[key]);
  }
  const rendered = await (await read(renamed)).text();
  assert.ok(rendered.includes('<h2>Training kit</h2>'));
  assert.ok(rendered.includes('<h3>Textile</h3>'));
  assert.ok(rendered.includes('<strong>Lightweight</strong>'));
  assert.ok(rendered.includes('<u>care instructions</u>'));
  assert.ok(rendered.includes('<a href="/contact">Contact us</a>'));
  assert.ok(rendered.includes('<strong>Bulk orders</strong>'));
  assert.equal((rendered.match(/>Product specifications</giu) ?? []).length, 1);
  assert.doesNotMatch(rendered, /<h2>Shipping &amp; Payment<\/h2>/);
  assert.equal((rendered.match(/>Shipping and payment</giu) ?? []).length, 1);
  assert.match(rendered, /<ul class="fxf-checklist">\s*<li>Adult XS–4XL<\/li>/);
  assert.match(rendered, /<td>94 cm<\/td>/);
  assert.match(rendered, /<ol>\s*<li>PayPal<\/li>/);
  assert.ok(rendered.includes('<title>Argentina Home Jersey | FXF</title>'));
  assert.ok(rendered.includes('$12.00'));
  assert.ok(rendered.includes('Argentina home jersey back view'));
  assert.ok(!rendered.includes('ProductRichEditor.astro'));
  const reopened = await (await read('/admin/products/' + row.public_id + '/edit', { cookie })).text();
  assert.match(reopened, /<template[^>]*>\s*<h2>Training kit<\/h2>/);
  assert.match(reopened, /<template[^>]*>\s*<p><strong>Product Specifications<\/strong><\/p>/);
  const richEndpoint = '/api/admin/products/rich-text';
  assert.notEqual((await read(richEndpoint)).status, 200);
  const richApi = payload => fetch(origin + richEndpoint, {
    redirect: 'manual', method: 'POST', body: JSON.stringify(payload), headers: { origin, cookie, 'content-type': 'application/json' },
  });
  const preview = await richApi({ action: 'preview', content: richFields.description });
  assert.equal(preview.status, 200);
  const publishedMarkup = (await preview.json()).html.trimEnd();
  assert.ok(rendered.includes(publishedMarkup));
  const unsafePreview = await richApi({ action: 'preview', content: '<script>alert(1)</script><a href="javascript:alert(1)">Safe text</a>' });
  assert.equal((await unsafePreview.json()).html.trim(), '<a>Safe text</a>');
  const template = await richApi({ action: 'save', name: 'Size table', content: richFields.description });
  assert.equal(template.status, 201);
  const { id } = await template.json();
  assert.ok(id);
  assert.equal((await richApi({ action: 'save', id, name: 'Updated size table', content: '### Measurement' })).status, 200);
  assert.deepEqual((await (await read(richEndpoint, { cookie })).json()).templates, [
    { id, name: 'Updated size table', content: '### Measurement' },
  ]);
  assert.equal((await richApi({ action: 'delete', id })).status, 200);
  assert.deepEqual((await (await read(richEndpoint, { cookie })).json()).templates, []);
  saved(await post(api, new URLSearchParams({ _action: 'delete' }), cookie));
  assert.equal((await read(renamed)).status, 404);
  assert.equal((await read(detail)).status, 404);
  assert.ok(!(await sitemap()).includes(site + renamed));
  const legacyRow = await db.prepare("SELECT id FROM products WHERE slug='legacy-jersey'").first();
  await db.prepare('UPDATE products SET import_seo_json=? WHERE id=?').bind(JSON.stringify({
    title: 'Imported search title', metaDescription: 'Imported description.', h1: 'Imported visible title',
  }), legacyRow.id).run();
  await db.prepare('INSERT INTO product_import_sources (source_hash, product_id, source_sku) VALUES (?, ?, ?)')
    .bind('test-fixture', legacyRow.id, 'FXF-ABC-1').run();
  const imported = await (await read('/products/legacy-jersey')).text();
  assert.ok(imported.includes('<title>Imported search title</title>'));
  assert.ok(imported.includes('"sku":"FXF-ABC-1"'));
  assert.ok(imported.includes('"name":"Imported visible title"'));
  console.log('Product SEO integration passed: legacy migration, admin forms, D1 writes, metadata, image, schema, slug conflicts, 301 and sitemap.');
} finally {
  await mf.dispose();
}
