import type { D1Database } from '@cloudflare/workers-types';
import { channels, trafficLabel } from './events';
import { DAY, trafficPeriod } from './period';

export const TRAFFIC_RETENTION_DAYS = 90;

const filters = {
  country: '国家/地区',
  channel: '渠道',
  source: '具体来源',
  device: '设备',
  campaign: '广告活动',
  content: '推广内容',
} as const;
export const trafficFilters = filters;

type FilterKey = keyof typeof filters;
type Filters = Record<FilterKey, string>;
export function readTrafficFilters(params: URLSearchParams): Filters {
  return {
    country: /^[A-Z]{2}$/.test(params.get('country') ?? '') ? params.get('country')! : '',
    channel: Object.keys(channels).includes(params.get('channel') ?? '') ? params.get('channel')! : '',
    source: trafficLabel(params.get('source')),
    device: trafficLabel(params.get('device')),
    campaign: trafficLabel(params.get('campaign')),
    content: trafficLabel(params.get('content')),
  };
}

export interface TrafficCounts {
  visitors: number;
  visits: number;
  views: number;
  products: number;
  clicks: number;
  clickers: number;
}

interface TrafficGroup extends TrafficCounts {
  label: string;
  detail: string | null;
}
interface TrafficPoint extends TrafficCounts { bucket: number }
interface ChannelPoint { bucket: number; organic: number; ai: number }
interface RecentVisit { seen: number; country: string; device: string; os: string; browser: string; channel: string; source: string; landing: string }
interface TrafficFunnel { viewed: number; clickedAfterView: number }

const totals = `
  COUNT(DISTINCT visitor_id) AS visitors,
  COUNT(DISTINCT visit_id) AS visits,
  COUNT(CASE WHEN kind IN ('page_view','product_view') THEN 1 END) AS views,
  COUNT(CASE WHEN kind = 'product_view' THEN 1 END) AS products,
  COUNT(CASE WHEN kind = 'whatsapp_click' THEN 1 END) AS clicks,
  COUNT(DISTINCT CASE WHEN kind = 'whatsapp_click' THEN visitor_id END) AS clickers
`;

const empty: TrafficCounts = { visitors: 0, visits: 0, views: 0, products: 0, clicks: 0, clickers: 0 };

const bucketRows = `WITH buckets AS (
  SELECT json_extract(value, '$[0]') AS start, json_extract(value, '$[1]') AS end
  FROM json_each(?)
)`;

export async function trafficTotals(db: D1Database, params: URLSearchParams, timeZone = 'UTC'): Promise<TrafficCounts> {
  const period = trafficPeriod(params, timeZone);
  return totalsForPeriod(db, period.start, period.end);
}

async function totalsForPeriod(db: D1Database, start: number, end: number): Promise<TrafficCounts> {
  return (await db.prepare(`SELECT ${totals} FROM traffic_events WHERE occurred_at >= ? AND occurred_at < ?`)
    .bind(start, end).first<TrafficCounts>()) ?? empty;
}

export async function trafficOverview(db: D1Database, params: URLSearchParams, timeZone: string) {
  const period = trafficPeriod(params, timeZone);
  const [current, daily] = await Promise.all([
    totalsForPeriod(db, period.start, period.end),
    db.prepare(`${bucketRows}
      SELECT buckets.start AS bucket, COUNT(traffic_events.occurred_at) AS views
      FROM buckets LEFT JOIN traffic_events ON occurred_at >= buckets.start AND occurred_at < buckets.end
        AND kind IN ('page_view', 'product_view')
      GROUP BY buckets.start ORDER BY buckets.start`).bind(JSON.stringify(period.buckets))
      .all<{ bucket: number; views: number }>(),
  ]);
  return { current, daily: daily.results };
}

export async function trafficReport(db: D1Database, params: URLSearchParams, timeZone = 'UTC') {
  const period = trafficPeriod(params, timeZone);
  const selected = readTrafficFilters(params);
  const pairs = Object.entries(selected).filter(([, value]) => value);
  const where = 'occurred_at >= ? AND occurred_at < ?' +
    pairs.map(([key]) => ' AND ' + key + ' = ?').join('');
  const values = pairs.map(([, value]) => value);
  const bind = [period.start, period.end, ...values];
  const group = (label: string, detail = 'NULL', extra = '') =>
    db.prepare(`SELECT ${label} AS label, ${detail} AS detail, ${totals} FROM traffic_events
      WHERE ${where} ${extra} GROUP BY 1, 2 ORDER BY visitors DESC, views DESC, label LIMIT 20`).bind(...bind);

  const bucketEvents = `FROM buckets CROSS JOIN traffic_events
    ON occurred_at >= buckets.start AND occurred_at < buckets.end
    WHERE ${where} GROUP BY 1 ORDER BY 1`;
  const bucketBind = [JSON.stringify(period.buckets), ...bind];
  const statements = [
    db.prepare(`SELECT ${totals} FROM traffic_events WHERE ${where}`).bind(...bind),
    db.prepare(`SELECT ${totals} FROM traffic_events WHERE ${where}`).bind(period.previousStart, period.previousEnd, ...values),
    db.prepare(`${bucketRows} SELECT buckets.start AS bucket, ${totals} ${bucketEvents}`).bind(...bucketBind),
    group('country'),
    group('channel', 'source'),
    group('campaign', 'source', "AND campaign <> ''"),
    group('device', "os || ' · ' || browser"),
    group('path'),
    group('landing_path', "channel || CASE WHEN source <> '' THEN ' · ' || source ELSE '' END"),
    group('path', 'NULL', "AND path GLOB '/products/*'"),
    db.prepare(`${bucketRows} SELECT buckets.start AS bucket,
      COUNT(DISTINCT CASE WHEN channel = 'organic' THEN visitor_id END) AS organic,
      COUNT(DISTINCT CASE WHEN channel = 'ai' THEN visitor_id END) AS ai
      ${bucketEvents}`).bind(...bucketBind),
    db.prepare(`SELECT MAX(occurred_at) AS seen, country, device, os, browser, channel, source, landing_path AS landing
      FROM traffic_events WHERE ${where}
      GROUP BY visit_id, country, device, os, browser, channel, source, landing_path
      ORDER BY seen DESC LIMIT 50`).bind(...bind),
    db.prepare(`WITH visits AS (
        SELECT visitor_id, visit_id,
          MIN(CASE WHEN kind = 'product_view' THEN occurred_at END) AS viewed_at,
          MAX(CASE WHEN kind = 'whatsapp_click' AND path GLOB '/products/*' THEN occurred_at END) AS clicked_at
        FROM traffic_events WHERE ${where} GROUP BY visitor_id, visit_id
      )
      SELECT COUNT(DISTINCT CASE WHEN viewed_at IS NOT NULL THEN visitor_id END) AS viewed,
        COUNT(DISTINCT CASE WHEN clicked_at >= viewed_at THEN visitor_id END) AS clickedAfterView
      FROM visits`).bind(...bind),
  ];
  const [current, previous, trend, countries, sources, campaigns, devices, pages, landings, products, channelTrend, recent, funnel] =
    await db.batch(statements);
  const points = new Map((trend.results as unknown as TrafficPoint[]).map((point) => [point.bucket, point]));
  const series = period.buckets.map(([bucket]) => points.get(bucket) ?? { ...empty, bucket });
  const channelsByBucket = new Map((channelTrend.results as unknown as ChannelPoint[]).map((point) => [point.bucket, point]));
  return {
    period, selected, series,
    channelSeries: series.map(({ bucket }) => channelsByBucket.get(bucket) ?? { bucket, organic: 0, ai: 0 }),
    recent: recent.results as unknown as RecentVisit[],
    current: (current.results[0] as unknown as TrafficCounts | undefined) ?? empty,
    previous: (previous.results[0] as unknown as TrafficCounts | undefined) ?? empty,
    countries: countries.results as unknown as TrafficGroup[],
    sources: sources.results as unknown as TrafficGroup[],
    campaigns: campaigns.results as unknown as TrafficGroup[],
    devices: devices.results as unknown as TrafficGroup[],
    pages: pages.results as unknown as TrafficGroup[],
    landings: landings.results as unknown as TrafficGroup[],
    products: products.results as unknown as TrafficGroup[],
    funnel: (funnel.results[0] as unknown as TrafficFunnel | undefined) ?? { viewed: 0, clickedAfterView: 0 },
  };
}

export async function pruneTrafficEvents(db: D1Database, now = Date.now()) {
  const cutoff = Math.floor(now / 1000) - TRAFFIC_RETENTION_DAYS * DAY;
  await db.prepare('DELETE FROM traffic_events WHERE id IN (SELECT id FROM traffic_events WHERE occurred_at < ? ORDER BY occurred_at LIMIT 5000)')
    .bind(cutoff).run();
}
