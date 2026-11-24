import { describe, expect, it } from 'vitest';
import { trafficPeriod, trafficRangeOrder, trafficRanges } from './period';

const seconds = (iso: string) => Date.parse(iso) / 1000;
const shanghai = (value: string, now = '2026-11-22T02:30:00Z') =>
  trafficPeriod(new URLSearchParams({ days: value }), 'Asia/Shanghai', Date.parse(now));

describe('traffic calendar ranges', () => {
  it('exposes the five requested ranges in order', () => {
    expect(trafficRangeOrder.map(key => trafficRanges[key])).toEqual(['今日', '昨日', '近三日', '近七日', '近30日']);
  });

  it('flips today and yesterday at Beijing midnight, including the current second', () => {
    const today = shanghai('1', '2026-11-21T16:00:00Z');
    expect(today.start).toBe(seconds('2026-11-21T16:00:00Z'));
    expect(today.end).toBe(today.start + 1);
    expect(today.buckets).toEqual([[today.start, today.end]]);
    const yesterday = shanghai('yesterday', '2026-11-21T16:00:00Z');
    expect(yesterday.start).toBe(seconds('2026-11-20T16:00:00Z'));
    expect(yesterday.end).toBe(today.start);
    expect(yesterday.previousEnd).toBe(yesterday.start);
    expect(yesterday.buckets).toHaveLength(24);
  });

  it.each([
    ['3', '2026-11-19T16:00:00Z', '2026-11-19T02:30:00Z'],
    ['7', '2026-11-15T16:00:00Z', '2026-11-15T02:30:00Z'],
    ['30', '2026-10-23T16:00:00Z', '2026-10-23T02:30:00Z'],
  ])('uses %s calendar dates including today, with a comparable cutoff', (key, start, previousEnd) => {
    const period = shanghai(key);
    expect(period.start).toBe(seconds(start));
    expect(period.end).toBe(seconds('2026-11-22T02:30:00Z') + 1);
    expect(period.previousEnd).toBe(seconds(previousEnd) + 1);
    expect(period.buckets).toHaveLength(Number(key));
  });

  it('uses local calendar boundaries for fractional offsets and fall-back days', () => {
    const params = new URLSearchParams({ days: 'yesterday' });
    const now = Date.parse('2026-11-02T13:00:00Z');
    const ny = trafficPeriod(params, 'America/New_York', now);
    expect(ny.start).toBe(seconds('2026-11-01T04:00:00Z'));
    expect(ny.end).toBe(seconds('2026-11-02T05:00:00Z'));
    expect(ny.buckets).toHaveLength(25);
    const india = trafficPeriod(params, 'Asia/Kolkata', now);
    expect(india.start).toBe(seconds('2026-10-31T18:30:00Z'));
    expect(india.end).toBe(seconds('2026-11-01T18:30:00Z'));
  });

  it('falls back to today for an unknown value', () => {
    expect(shanghai('invalid')).toEqual(shanghai('1'));
  });
});
