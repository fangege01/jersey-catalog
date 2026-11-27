import type { D1Database } from '@cloudflare/workers-types';
import type { StoreSettings } from '../settings/db';
import { getProductBySlug, listProductImages, type Product } from '../products/db';
import { listVariants, listExtras } from '../products/variants';
import { categoriesForProduct, relatedProducts } from '../categories/db';
import { getRelatedStored, storeRelatedIds } from '../search';
import { enabledMethods } from '../payments';
import { markdownExcerpt, renderMarkdown } from '../pages/markdown.ts';
import { defaultProductMeta, importedProductSeo } from '../products/seo.ts';
import { imageAliasPath } from '../products/imageSeo.ts';
import { productImageSources, productImageUrl, type ImageDelivery } from '../products/image';
import { stockState } from '../products/stock';
import { catalogPath } from '../settings/home';
import { formatMoney, toMajorUnits, currencyDecimals } from '../../money';
import { requirePublicId } from '../catalog/serialize';
import { managedWhatsAppHref, whatsappInquiryUrl } from './catalogMode';
import { localizedProduct, translations } from '../i18n/db';
import { translatedPath, type StoreLocale } from '../i18n/locale';
import { buildProductCard } from './productCard';
import { readSiteCopy } from '../site-content/copy';
import { validContactEmail } from '../site-content/inquiry';
import { readWholesalePrices, wholesaleRanges } from '../products/wholesale';
import { detailSectionLines, readProductDetailSections } from '../products/detailSections';
import { releaseYearFromTitle } from '../products/releaseYear';
import type { ProductTranslationCopy } from '../i18n/productPublication';
import type {
  ProductDetailModel,
  ProductPurchaseModel,
  ProductSeoModel,
  StorefrontGalleryImage,
  StorefrontImage,
} from './models';

/**
 * The product-detail loader.
 *
 * This route was the densest in the storefront: parallel graph reads, a
 * background backfill, cache tagging, variant and extra availability, gallery
 * derivation, SEO, runtime payment toggles, and two different purchase forms.
 * All of it lives here, so the template receives three finished models and
 * decides only composition.
 *
 * The route keeps what is not presentation: the 404, the metadata tags, the
 * JSON-LD script, and cache tagging.
 */

const RELATED_TARGET = 4;
const HERO_SIZES = '(min-width: 768px) 528px, calc(100vw - 48px)';
const THUMBNAIL_SIZES = '64px';
const RELATED_CARD_SIZES = '(min-width: 1024px) 252px, calc(50vw - 36px)';

export type LoadedProductDetail =
  | { status: 'not_found' }
  | {
      status: 'ok';
      model: ProductDetailModel;
      seo: ProductSeoModel;
      purchase: ProductPurchaseModel;
      /** Cache tags for the response; the route attaches them. */
      cacheTagIds: (string | null)[];
      /** Set when the semantic-neighbour column was empty and should be
       *  backfilled after the response is sent. */
      backfillRelated: (() => Promise<void>) | null;
    };

export interface ProductDetailOptions {
  slug: string | undefined;
  searchParams: URLSearchParams;
  settings: StoreSettings | undefined;
  imageBaseUrl: string;
  delivery: ImageDelivery | undefined;
  currency: string;
  /** Absolute origin for SEO URLs. */
  origin: string;
  pathname: string;
  catalogOnly?: boolean;
  separateCatalog?: boolean;
  locale?: StoreLocale;
  canonicalPath?: string;
  sku?: string | null;
  reviewedCopy?: ProductTranslationCopy;
  reviewedImages?: ReadonlyMap<number, { alt_text: string }>;
}

function heroImage(
  product: Product,
  options: ProductDetailOptions,
): StorefrontImage {
  const sources = productImageSources(product.image_key, {
    baseUrl: options.imageBaseUrl,
    delivery: options.delivery,
    usage: 'detail',
    sizes: HERO_SIZES,
  });
  return {
    src: sources.src,
    ...(sources.srcset ? { srcset: sources.srcset } : {}),
    ...(sources.sizes ? { sizes: sources.sizes } : {}),
    alt: product.name,
    // The product hero is the page's LCP candidate.
    priority: true,
  };
}

export async function loadProductDetail(
  db: D1Database,
  options: ProductDetailOptions,
): Promise<LoadedProductDetail> {
  let product = options.slug ? await getProductBySlug(db, options.slug) : null;
  if (!product?.active) return { status: 'not_found' };

  // Independent once the product is known. Run together so an uncached render
  // pays one concurrent wait instead of a serial chain.
  const [categories, storedRelated, variants, extras, gallery] = await Promise.all([
    categoriesForProduct(db, product.id),
    getRelatedStored(product, RELATED_TARGET),
    listVariants(db, product.id),
    listExtras(db, product.id),
    listProductImages(db, product.id),
  ]);

  const semantic = storedRelated ?? [];
  let related = semantic;
  if (related.length < RELATED_TARGET) {
    const seen = new Set(related.map((p) => p.id));
    const byCategory = await relatedProducts(db, product.id, RELATED_TARGET + semantic.length);
    related = [...related, ...byCategory.filter((p) => !seen.has(p.id))].slice(0, RELATED_TARGET);
  }

  const [productText, categoryText] = await Promise.all([
    translations(db, options.locale, 'product', [product.public_id, ...related.map((p) => p.public_id)]),
    translations(db, options.locale, 'category', categories.map((c) => c.public_id)),
  ]);
  const year = product.release_year ?? releaseYearFromTitle(product.name);
  const categoryLink = (category: typeof categories[number]) => ({
    text: categoryText.get(category.public_id ?? '')?.title ?? category.name,
    href: `/categories/${category.slug}`,
  });
  const parentIds = new Set(categories.map(category => category.parent_id));
  const badgeCategory = categories.find(category => !parentIds.has(category.id));
  product = localizedProduct(product, productText.get(product.public_id ?? ''));
  const hasVariants = variants.length > 0;
  const state = stockState(product.stock);
  // With variants the inventory unit is the variant, so availability comes from
  // them; otherwise from the product's own stock.
  const soldOut = !options.catalogOnly && (hasVariants ? variants.every((v) => v.stock <= 0) : state === 'out');

  const variantPrices = variants.map((v) => v.price_cents);
  const displayPriceCents = hasVariants ? Math.min(...variantPrices) : product.price_cents;
  const priceVaries = hasVariants && Math.min(...variantPrices) !== Math.max(...variantPrices);

  // A variant's linked image reaches the markup as the gallery anchor — a pimg_
  // public ID, never the row FK and never the storage key. The old image_key
  // fallback published R2 object names into DOM ids and data-image-id, which is
  // the same boundary violation as leaking a row ID: a public page should say
  // nothing about how the store names its objects.
  const galleryAnchor = (imageId: number | null): string => {
    const image = imageId == null ? undefined : gallery.find((g) => g.id === imageId);
    return image ? requirePublicId(image.public_id, image.id, 'product image') : '';
  };
  const firstInStockIndex = variants.findIndex((v) => v.stock > 0);

  const images: StorefrontGalleryImage[] = gallery.map((image, index) => {
    const approved = options.reviewedImages?.get(image.id);
    const hero = productImageSources(image.image_key, {
      baseUrl: options.imageBaseUrl,
      delivery: options.delivery,
      usage: 'detail',
      sizes: HERO_SIZES,
    });
    const thumbnail = productImageSources(image.image_key, {
      baseUrl: options.imageBaseUrl,
      delivery: options.delivery,
      usage: 'thumbnail',
      sizes: THUMBNAIL_SIZES,
    });
    return {
      anchor: requirePublicId(image.public_id, image.id, 'product image'),
      // The first frame is what a shopper sees before scrolling, so it is the
      // page's LCP candidate. Saying so on the model keeps the rendered
      // attributes and the fade decision from drifting apart.
      hero: {
        ...hero,
        ...(image.seo_alias && { src: imageAliasPath(image.seo_alias) }),
        alt: options.reviewedCopy
          ? approved?.alt_text ?? options.reviewedCopy.name
          : image.alt?.trim() || product.name,
        title: options.locale === 'zh-CN' ? undefined : image.title || undefined,
        caption: options.locale === 'zh-CN' ? undefined : image.caption || undefined,
        priority: index === 0,
      },
      thumbnail: { ...thumbnail, alt: '', priority: false },
    };
  });

  const offered = !options.catalogOnly && options.settings ? enabledMethods(options.settings) : [];
  const canCheckout = offered.length > 0;
  const cartEnabled = options.settings?.cartEnabled ?? true;
  const buyNowEnabled = options.settings?.buyNowEnabled ?? true;

  const inquiryProduct = { name: options.reviewedCopy?.name ?? product.name,
    url: new URL(options.canonicalPath ?? translatedPath(options.pathname, options.locale ?? 'en'), options.origin).href };
  const inquiryNumber = options.settings?.whatsappNumber;
  const inquiryHref = options.catalogOnly ? whatsappInquiryUrl(inquiryNumber, inquiryProduct, undefined, options.locale) : null;
  const email = options.catalogOnly ? readSiteCopy(options.settings?.siteContent, 'contact', 'en').contactEmail.trim() : '';
  const zh = options.locale === 'zh-CN';
  const emailHref = validContactEmail(email)
    ? 'mailto:' + encodeURIComponent(email).replace('%40', '@') +
      '?subject=' + encodeURIComponent((zh ? '商品询价：' : 'Quote request: ') + inquiryProduct.name.replace(/\s+/g, ' ').trim()) +
      '&body=' + encodeURIComponent(inquiryProduct.name + '\r\n' + inquiryProduct.url)
    : null;
  const wholesalePrices = [product.price_cents, ...readWholesalePrices(product.wholesale_prices)];
  const details = readProductDetailSections(product.detail_sections);
  const detailCopy = options.reviewedCopy ?? (zh ? details.source : details.english);
  const detailSections = [
    { title: zh ? '产品规格' : 'Product specifications', items: detailSectionLines(detailCopy.specifications) },
    { title: zh ? '运输及付款' : 'Shipping and payment', items: detailSectionLines(detailCopy.shippingPayment) },
  ].filter(section => section.items.length > 0);
  const galleryByKey = new Map(gallery.map((image) => [image.image_key, image]));
  const imageKeys = [...new Set([...(product.image_key ? [product.image_key] : []), ...galleryByKey.keys()])];
  const imageUrls = imageKeys.map((key) => {
    const alias = galleryByKey.get(key)?.seo_alias;
    return new URL(alias ? imageAliasPath(alias) : productImageUrl(key, options.imageBaseUrl), options.origin).href;
  });
  const imagePath = imageUrls[0];
  const imageAlt = imageKeys[0] ? images.find((_, index) => gallery[index].image_key === imageKeys[0])?.hero.alt || inquiryProduct.name : undefined;
  const importedSeo = zh ? null : importedProductSeo(product);
  const visibleCopy = options.reviewedCopy ?? importedSeo;
  const detailDescription = [visibleCopy?.intro, visibleCopy?.description].filter(Boolean).join('\n\n') || product.description;
  const visibleName = visibleCopy?.h1 || product.name;
  const manualTitle = zh ? undefined : product.seo_title?.trim();
  const manualDescription = zh ? undefined : product.meta_description?.trim();
  const title = manualTitle || options.reviewedCopy?.name || importedSeo?.title || product.name;
  const description = manualDescription || importedSeo?.metaDescription || defaultProductMeta(detailDescription);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: visibleName,
    ...(options.sku && { sku: options.sku }),
    // Structured data wants prose, not Markdown syntax characters.
    ...(detailDescription ? { description: markdownExcerpt(detailDescription, 5000) } : {}),
    url: inquiryProduct.url,
    ...(imageUrls.length > 0 && { image: imageUrls }),
    ...(!options.catalogOnly && (!importedSeo || displayPriceCents > 0) && { offers: {
      '@type': 'Offer',
      // The SAME currency the page displays. These previously disagreed: the
      // header formatted in the store currency while JSON-LD and the live-price
      // script announced the product row's, so a legacy row advertised one
      // currency and rendered another, and picking a variant switched between
      // them mid-page.
      price: toMajorUnits(displayPriceCents, options.currency).toFixed(
        currencyDecimals(options.currency),
      ),
      priceCurrency: options.currency.toUpperCase(),
      availability: soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url: inquiryProduct.url,
    } }),
  };

  return {
    status: 'ok',
    cacheTagIds: [product.public_id, ...related.map((candidate) => candidate.public_id)],
    backfillRelated:
      storedRelated === null ? () => storeRelatedIds(product.id, RELATED_TARGET) : null,
    seo: {
      ogTitle: manualTitle || importedSeo?.ogTitle,
      ogDescription: manualDescription || importedSeo?.ogDescription,
      title,
      description,
      imagePath,
      imageAlt,
      // Escape "<" so a product name can't break out of the <script> tag.
      jsonLd: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
    },
    model: {
      ...(options.locale === 'zh-CN' && { locale: options.locale }),
      id: requirePublicId(product.public_id, product.id, 'product'),
      name: visibleName,
      description: detailDescription,
      descriptionHtml: detailDescription
        ? renderMarkdown(detailDescription, {
            baseUrl: options.imageBaseUrl,
            resolveLink: options.catalogOnly ? (href) => managedWhatsAppHref(href, inquiryNumber ?? null) : undefined,
          })
        : null,
      formattedPrice: formatMoney(displayPriceCents, options.currency),
      priceCents: product.price_cents,
      currency: options.currency,
      priceVaries,
      ...(options.catalogOnly && {
        catalogBadges: { category: badgeCategory ? categoryLink(badgeCategory) : null, year },
        quoteNote: detailCopy.quoteNote,
        detailSections,
        wholesale: {
          currency: product.currency.toUpperCase(),
          tiers: wholesaleRanges.map((range, index) => {
            const price = wholesalePrices[index];
            return { range, price: price && price > 0 ? formatMoney(price, product.currency) : null };
          }),
        },
      }),
      soldOut,
      // Deliberately never shown for a product with variants: the product-level
      // count means nothing when the variant is the inventory unit.
      lowStock: !options.catalogOnly && !hasVariants && state === 'low',
      digitalDelivery: !options.catalogOnly && Boolean(product.file_key),
      categories: categories.map(categoryLink),
      images,
      heroImage: images[gallery.findIndex(image => image.image_key === product.image_key)]?.hero ?? heroImage(product, options),
      related: related.map((candidate) =>
        buildProductCard(localizedProduct(candidate, productText.get(candidate.public_id ?? '')), {
          baseUrl: options.imageBaseUrl,
          delivery: options.delivery,
          currency: options.currency,
          catalogOnly: options.catalogOnly,
          sizes: RELATED_CARD_SIZES,
        }),
      ),
      backHref: options.separateCatalog ? '/products' : catalogPath(options.settings?.homePage),
      error: options.searchParams.get('error'),
    },
    purchase: {
      ...(options.locale === 'zh-CN' && { locale: options.locale }),
      productId: requirePublicId(product.public_id, product.id, 'product'),
      cartAction: '/api/cart',
      expressAction: '/express',
      hasOptions: hasVariants || extras.length > 0,
      soldOut,
      showAddToCart: !options.catalogOnly && cartEnabled,
      // Buy now is express (it skips the cart), so it survives the cart being
      // switched off — but not the absence of any rail that can take money.
      showBuyNow: buyNowEnabled && canCheckout,
      ...(options.catalogOnly && {
        inquiry: {
          href: inquiryHref,
          ...(emailHref && { emailHref }),
          options: inquiryHref ? variants.flatMap((variant) => {
            const href = whatsappInquiryUrl(inquiryNumber, inquiryProduct, variant, options.locale);
            return href ? [{ label: variant.label, href, soldOut: false }] : [];
          }) : [],
        },
      }),
      variantLabel: product.variant_label,
      variants: variants.map((variant, index) => ({
        id: requirePublicId(variant.public_id, variant.id, 'variant'),
        label: variant.label,
        formattedPrice: formatMoney(variant.price_cents, options.currency),
        priceCents: variant.price_cents,
        soldOut: variant.stock <= 0,
        defaultSelected: index === firstInStockIndex,
        imageAnchor: galleryAnchor(variant.image_id),
      })),
      extras: extras.map((extra) => ({
        id: requirePublicId(extra.public_id, extra.id, 'extra'),
        label: extra.label,
        formattedPriceDelta: formatMoney(extra.price_delta_cents, options.currency),
        priceDeltaCents: extra.price_delta_cents,
      })),
    },
  };
}
