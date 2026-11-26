export const footerLinkKeys = ['products', 'factory', 'about', 'contact'] as const;
export const footerFields = {
  productsTitle: { label: '产品栏标题', max: 48 },
  quickTitle: { label: '快速链接栏标题', max: 48 },
  contactTitle: { label: '联系方式栏标题', max: 48 },
  products: { label: '产品链接名称', max: 120 },
  factory: { label: '供应与质量链接名称', max: 120 },
  about: { label: '关于我们链接名称', max: 120 },
  contact: { label: '联系我们链接名称', max: 120 },
} as const;

type FooterField = keyof typeof footerFields;
type FooterCopy = Partial<Record<FooterField, string>>;
type FooterLinkKey = typeof footerLinkKeys[number];

export function readFooterSettings(raw?: string | null) {
  const copy = (value: unknown): FooterCopy => {
    if (!value || typeof value !== 'object') return {};
    const data = value as Partial<Record<FooterField, unknown>>;
    return Object.fromEntries(Object.entries(footerFields).flatMap(([key, limit]) => {
      const text = data[key as FooterField];
      return typeof text === 'string' && text.trim() && text.length <= limit.max ? [[key, text]] : [];
    }));
  };
  try {
    const settings = JSON.parse(raw ?? '{}');
    const syncStatus = settings?.sync?.status;
    return {
      source: copy(settings?.source),
      english: copy(settings?.english),
      hidden: Array.isArray(settings?.hidden)
        ? footerLinkKeys.filter(key => settings.hidden.includes(key)) : [],
      syncStatus: syncStatus === 'pending' || syncStatus === 'failed' ? syncStatus as 'pending' | 'failed' : null,
      retry: Array.isArray(settings?.sync?.keys) ? settings.sync.keys.filter((key: unknown): key is string => typeof key === 'string') as string[] : [],
    };
  } catch {
    return { source: {} as FooterCopy, english: {} as FooterCopy, hidden: [] as FooterLinkKey[], syncStatus: null, retry: [] };
  }
}
