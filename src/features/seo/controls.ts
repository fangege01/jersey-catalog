export const crawlerGroups = {
  openai: { label: 'OpenAI / ChatGPT 搜索', agents: ['OAI-SearchBot'] },
  googleExtended: { label: 'Google-Extended', agents: ['Google-Extended'] },
  claude: { label: 'Claude 搜索与访问', agents: ['Claude-SearchBot', 'Claude-User'] },
  perplexity: { label: 'Perplexity 搜索与访问', agents: ['PerplexityBot', 'Perplexity-User'] },
  training: { label: 'AI 模型训练爬虫', agents: ['GPTBot', 'ClaudeBot'] },
} as const;

export const verificationTags = {
  google: { label: 'Google Search Console', meta: 'google-site-verification' },
  bing: { label: 'Bing Webmaster Tools', meta: 'msvalidate.01' },
  yandex: { label: 'Yandex Webmaster', meta: 'yandex-verification' },
} as const;

type Crawler = keyof typeof crawlerGroups;
type Verification = keyof typeof verificationTags;
export const crawlerKeys = Object.keys(crawlerGroups) as Crawler[];
export const verificationKeys = Object.keys(verificationTags) as Verification[];
export type SeoControls = {
  crawlers: Partial<Record<Crawler, boolean>>;
  verification: Partial<Record<Verification, string>>;
};

export const verificationPattern = /^[A-Za-z0-9_-]{3,200}$/;

export function seoControls(raw?: string): SeoControls {
  const data: SeoControls = { crawlers: {}, verification: {} };
  if (!raw) return data;
  try {
    const parsed = JSON.parse(raw);
    for (const key of crawlerKeys) {
      const value = parsed?.crawlers?.[key];
      if (typeof value === 'boolean') data.crawlers[key] = value;
    }
    for (const key of verificationKeys) {
      const value = parsed?.verification?.[key];
      if (typeof value === 'string' && verificationPattern.test(value)) data.verification[key] = value;
    }
  } catch {
    // An absent or damaged setting falls back to the original public crawl policy.
  }
  return data;
}

export function robotsContent(origin: string, settings: SeoControls) {
  const privatePaths = ['Disallow: /admin', 'Disallow: /api/', 'Disallow: /login'];
  const publicRules = ['Allow: /', ...privatePaths];
  const groups = [['User-agent: *', ...publicRules].join('\n')];
  for (const key of crawlerKeys) {
    const allow = settings.crawlers[key];
    if (allow === undefined) continue;
    groups.push([
      ...crawlerGroups[key].agents.map((agent) => 'User-agent: ' + agent),
      ...(allow ? publicRules : ['Disallow: /']),
    ].join('\n'));
  }
  groups.push('Sitemap: ' + origin + '/sitemap.xml');
  return groups.join('\n\n') + '\n';
}
