export const MIN_RELEASE_YEAR = 1900;
export const MAX_RELEASE_YEAR = 2099;

export function releaseYearFromTitle(title: string): number | null {
  const match = title.match(/(?:^|[^\p{Script=Latin}\d])((?:19|20)\d{2})(?![\p{Script=Latin}\d])/u);
  return match ? Number(match[1]) : null;
}
