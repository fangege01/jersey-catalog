import type { Ai, D1Database } from '@cloudflare/workers-types';
import { translations, type SourceCopy } from './db';
import { englishCopy } from './english';
import type { LocaleEntity } from './locale';

export async function saveCopyInEnglish(
  db: D1Database, ai: Ai | undefined, entity: LocaleEntity, source: SourceCopy,
  current?: SourceCopy & { publicId: string },
) {
  const prior = current ? (await translations(db, 'zh-CN', entity, [current.publicId])).get(current.publicId) : undefined;
  const english = await englishCopy(ai, { title: source.title, body: source.body ?? '' }, { title: 500, body: 16000 },
    current && { source: { title: prior?.title ?? current.title, body: prior?.body ?? current.body ?? '' },
      english: { title: current.title, body: current.body ?? '' } });
  return {
    title: english.title, body: english.body || null,
    source: prior || english.title !== source.title || english.body !== (source.body ?? '') ? source : undefined,
  };
}
