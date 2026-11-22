export const PRODUCT_IMPORT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export function productImportConfigured(token: string | undefined): boolean {
  return typeof token === 'string' && PRODUCT_IMPORT_TOKEN_PATTERN.test(token);
}
