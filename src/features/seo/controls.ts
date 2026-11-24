export const crawlerGroups = {
  googleSearch: { label: 'Google 搜索', agents: ['Googlebot', 'Googlebot-Image'], note: '用于 Google 网页与图片搜索。Google 搜索中的 AI 摘要和 AI 模式也使用 Googlebot。' },
  bingSearch: { label: 'Microsoft Bing 搜索', agents: ['bingbot'], note: '用于 Bing 抓取，支持 Bing 搜索及基于其搜索索引的 Copilot 体验。' },
  openai: { label: 'OpenAI / ChatGPT 搜索', agents: ['OAI-SearchBot'], note: '用于 ChatGPT 搜索发现和引用公开网页。' },
  openaiUser: { label: 'ChatGPT 用户访问声明', agents: ['ChatGPT-User'], note: '表示站长偏好。OpenAI 说明用户发起的访问可能不受 robots.txt 规则限制。' },
  claude: { label: 'Claude 搜索与访问', agents: ['Claude-SearchBot', 'Claude-User'], note: '用于 Claude 搜索和用户请求的网页检索。' },
  perplexity: { label: 'Perplexity 搜索入口', agents: ['PerplexityBot'], note: '用于 Perplexity 搜索索引。' },
  perplexityUser: { label: 'Perplexity 用户访问声明', agents: ['Perplexity-User'], note: '表示站长偏好。Perplexity 说明用户发起的访问通常不遵守 robots.txt 规则。' },
  googleExtended: { label: 'Google Gemini 内容使用', agents: ['Google-Extended'], note: '用于 Gemini 训练及 Google 官方说明的部分检索用途，独立于 Google 搜索。' },
  openaiTraining: { label: 'OpenAI 模型训练', agents: ['GPTBot'], note: '用于模型训练数据收集。' },
  claudeTraining: { label: 'Claude 模型训练', agents: ['ClaudeBot'], note: '用于 Anthropic 模型训练数据收集。' },
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
    const legacyTraining = parsed?.crawlers?.training;
    if (typeof legacyTraining === 'boolean') {
      data.crawlers.openaiTraining ??= legacyTraining;
      data.crawlers.claudeTraining ??= legacyTraining;
    }
    data.crawlers.perplexityUser ??= data.crawlers.perplexity;
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
  const privatePaths = ['/admin', '/api/', '/login', '/account', '/order/', '/pay/', '/payment-setup', '/checkout', '/cart', '/express', '/partials/']
    .map((path) => 'Disallow: ' + path);
  const publicRules = ['Allow: /', ...privatePaths];
  const groups = [['User-agent: *', ...publicRules].join('\n')];
  for (const key of crawlerKeys) {
    const allow = settings.crawlers[key] !== false;
    groups.push([
      ...crawlerGroups[key].agents.map((agent) => 'User-agent: ' + agent),
      ...(allow ? publicRules : ['Disallow: /']),
    ].join('\n'));
  }
  groups.push('Sitemap: ' + origin + '/sitemap.xml');
  return groups.join('\n\n') + '\n';
}
