export const DAY = 86_400;
const HOUR = 3_600;

export const trafficRanges = {
  '1': '今日',
  yesterday: '昨日',
  '3': '近三日',
  '7': '近七日',
  '30': '近30日',
} as const;

export const trafficRangeOrder = ['1', 'yesterday', '3', '7', '30'] as const;

export function trafficPeriod(params: URLSearchParams, timeZone = 'UTC', now = Date.now()) {
  const requested = params.get('days');
  const key = trafficRangeOrder.find((option) => option === requested) ?? '1';
  const yesterday = key === 'yesterday';
  const span = yesterday ? 1 : Number(key);
  const calendar = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const localDay = (seconds: number) => {
    const parts = calendar.formatToParts(seconds * 1000);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    return Date.UTC(year, month - 1, day) / 1000 / DAY;
  };

  // Convert a calendar day to its first real instant, including on DST transition days.
  const midnights = new Map<number, number>();
  function midnight(day: number): number {
    const cached = midnights.get(day);
    if (cached !== undefined) return cached;
    let lower = (day - 1) * DAY;
    let upper = (day + 1) * DAY;
    while (upper - lower > 1) {
      const probe = Math.floor((lower + upper) / 2);
      if (localDay(probe) < day) lower = probe;
      else upper = probe;
    }
    midnights.set(day, upper);
    return upper;
  }

  const second = Math.floor(now / 1000);
  const today = localDay(second);
  const lastDay = today - Number(yesterday);
  const start = midnight(lastDay - span + 1);
  const end = yesterday ? midnight(today) : second + 1;
  const previousStart = midnight(lastDay - 2 * span + 1);
  const previousLastDay = lastDay - span;
  const previousDayEnd = midnight(previousLastDay + 1);
  const previousEnd = yesterday ? previousDayEnd :
    Math.min(previousDayEnd, midnight(previousLastDay) + end - midnight(today));

  const starts = span === 1
    ? Array.from({ length: Math.ceil((end - start) / HOUR) }, (_, index) => start + index * HOUR)
    : Array.from({ length: span }, (_, index) => midnight(lastDay - span + 1 + index));
  const buckets = starts.map((lower, index) => [lower, starts[index + 1] ?? end] as const)
    .filter(([lower, upper]) => lower < upper);

  return { key, span, start, end, previousStart, previousEnd, buckets };
}
