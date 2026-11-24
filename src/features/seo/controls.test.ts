import { describe, expect, it } from 'vitest';
import { robotsContent, seoControls } from './controls';

function rulesFor(robots: string, agent: string) {
  return robots.split('\n\n').find((group) => group.split('\n').includes('User-agent: ' + agent));
}

describe('SEO crawler controls', () => {
  it('publishes actual rules for the supported search and AI platforms', () => {
    const robots = robotsContent('https://shop.example', seoControls());
    for (const agent of ['*', 'Googlebot', 'Googlebot-Image', 'bingbot', 'Google-Extended', 'OAI-SearchBot',
      'ChatGPT-User', 'GPTBot', 'Claude-SearchBot', 'Claude-User', 'ClaudeBot', 'PerplexityBot', 'Perplexity-User']) {
      const group = rulesFor(robots, agent);
      expect(group).toContain('Allow: /\n');
      expect(group).toContain('Disallow: /admin\n');
      expect(group).toContain('Disallow: /api/\n');
    }
    expect(robots).toContain('Sitemap: https://shop.example/sitemap.xml');
    expect(robots).not.toMatch(/^User-agent: .*Grok/im);
  });

  it('keeps provider switches independent while preserving the legacy training and Perplexity choices', () => {
    const settings = seoControls(JSON.stringify({
      crawlers: { googleSearch: false, googleExtended: true, training: false, openaiTraining: true,
        perplexity: false, bingSearch: 'block' },
      verification: { google: 'existing_code', bing: 'invalid value' },
    }));
    const robots = robotsContent('https://shop.example', settings);
    expect(rulesFor(robots, 'Googlebot')).toBe('User-agent: Googlebot\nUser-agent: Googlebot-Image\nDisallow: /');
    expect(rulesFor(robots, 'Google-Extended')).toContain('Allow: /');
    expect(rulesFor(robots, 'bingbot')).toContain('Allow: /');
    expect(rulesFor(robots, 'GPTBot')).toContain('Allow: /');
    expect(rulesFor(robots, 'ClaudeBot')).toBe('User-agent: ClaudeBot\nDisallow: /');
    expect(rulesFor(robots, 'Perplexity-User')).toBe('User-agent: Perplexity-User\nDisallow: /');
    expect(settings.verification).toEqual({ google: 'existing_code' });
  });
});
