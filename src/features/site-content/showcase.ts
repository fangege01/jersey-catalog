import type { D1Database } from '@cloudflare/workers-types';

export const factorySlots = { factory: '工厂环境', documents: '资料展示', customize: '定制展示' } as const;
export type ShowcaseSection = 'cases' | 'factory';
export type FactorySlot = keyof typeof factorySlots;

export interface ShowcaseItem {
  id: number;
  slot: FactorySlot | null;
  position: number;
  visible: number;
  imageKey: string;
  width: number | null;
  height: number | null;
  title_en: string;
  title_zh: string;
  body_en: string;
  body_zh: string;
  alt_en: string;
  alt_zh: string;
}

export async function listShowcase(db: D1Database, section: ShowcaseSection, publicOnly = false) {
  const result = await db.prepare(`
    SELECT s.id, s.slot, s.position, s.visible, m.image_key AS imageKey, m.width, m.height,
           s.title_en, s.title_zh, s.body_en, s.body_zh, s.alt_en, s.alt_zh
    FROM storefront_showcase_items s JOIN media m ON m.id = s.image_id
    WHERE s.section = ? ${publicOnly ? 'AND s.visible = 1' : ''}
    ORDER BY s.position, s.id
  `).bind(section).all<ShowcaseItem>();
  return section === 'cases' ? result.results.map((item, index) => ({
    ...item,
    title_en: cleanCaseText(item.title_en) || `Customer Case ${index + 1}`,
    title_zh: cleanCaseText(item.title_zh) || `客户案例 ${index + 1}`,
    body_en: cleanCaseText(item.body_en),
    body_zh: cleanCaseText(item.body_zh),
    alt_en: cleanCaseText(item.alt_en) || 'Customer case photos',
    alt_zh: cleanCaseText(item.alt_zh) || '客户案例照片',
  })) : result.results;
}

export function cleanCaseText(value: string): string {
  return value.replace(/凯云\s*(?:服饰|服装)|\bkai[\s_-]*yun(?:[\s_-]+apparel)?\b/giu, '').trim();
}

export const showcaseLimits = { title_en:120, title_zh:120, body_en:600, body_zh:600, alt_en:160, alt_zh:160 } as const;

export const caseCopyLimits = { label: 60, title: 120, description: 600 } as const;
export const caseCopyFields = ['label', 'title', 'description'] as const;
type CaseCopy = Record<keyof typeof caseCopyLimits, string>;

const caseDefaults = {
  autoplay: false, interval: 5000, arrows: true, dots: true,
  copy: {
    en: { label: '', title: 'Customer Cases', description: '' },
    'zh-CN': { label: '', title: '客户案例', description: '' },
  },
};

export function readCaseOptions(raw: string | null) {
  if (!raw) return caseDefaults;
  try {
    const options = JSON.parse(raw) as typeof caseDefaults;
    const clean = (locale: keyof typeof caseDefaults.copy) => {
      const defaults = caseDefaults.copy[locale];
      const copy = options?.copy?.[locale];
      return {
        label: cleanCaseText(typeof copy?.label === 'string' ? copy.label : defaults.label),
        title: cleanCaseText(typeof copy?.title === 'string' ? copy.title : defaults.title) || defaults.title,
        description: cleanCaseText(typeof copy?.description === 'string' ? copy.description : defaults.description),
      };
    };
    return { ...caseDefaults, ...options, copy: { en: clean('en'), 'zh-CN': clean('zh-CN') } };
  } catch {
    return caseDefaults;
  }
}

export function readCaseOptionsForm(form: FormData) {
  const seconds = form.get('interval');
  if (typeof seconds !== 'string' || !/^\d{1,2}$/.test(seconds) || Number(seconds) < 2 || Number(seconds) > 30) return null;
  const copy: CaseCopy = { ...caseDefaults.copy['zh-CN'] };
  for (const key of caseCopyFields) {
    const raw = form.get(key);
    if (typeof raw !== 'string' || raw.trim().length > caseCopyLimits[key]) return null;
    copy[key] = cleanCaseText(raw) || caseDefaults.copy['zh-CN'][key];
  }
  return {
    copy, interval: Number(seconds) * 1000, autoplay: form.get('autoplay') === '1',
    arrows: form.get('arrows') === '1', dots: form.get('dots') === '1',
  };
}

export function readShowcaseItem(form: FormData, section: ShowcaseSection) {
  const text = (key: string) => {
    const value = form.get(key);
    return section === 'cases' && typeof value === 'string' ? cleanCaseText(value) : value;
  };
  const title = text('title_zh');
  const body = text('body_zh');
  const alt = text('alt_zh');
  if (typeof title !== 'string' || !title.trim() || title.trim().length > showcaseLimits.title_zh ||
      typeof body !== 'string' || body.trim().length > showcaseLimits.body_zh ||
      typeof alt !== 'string' || !alt.trim() || alt.trim().length > showcaseLimits.alt_zh) return null;
  const imageKey = form.get('image_key');
  const rank = form.get('position');
  if (typeof imageKey !== 'string' || !imageKey || imageKey.length > 512 ||
      typeof rank !== 'string' || !/^\d{1,5}$/.test(rank) || Number(rank) > 10000) return null;
  return { title_zh: title.trim(), body_zh: body.trim(), alt_zh: alt.trim(), imageKey, position: Number(rank),
    visible: form.get('visible') === '1' ? 1 : 0 };
}
