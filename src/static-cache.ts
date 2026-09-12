/** Cache-Control for files under public/. HTML stays revalidate-always; hashed JS/CSS and vendor are immutable. */

const YEAR = 60 * 60 * 24 * 365;

export function cacheControlForPublicFile(filePath: string): string {
  const n = filePath.replace(/\\/g, '/').toLowerCase();
  if (n.endsWith('.html')) return 'public, max-age=0, must-revalidate';
  if (n.includes('/vendor/')) return `public, max-age=${YEAR}, immutable`;
  if (/\.(?:js|css|woff2|woff|png|svg)$/.test(n)) return `public, max-age=${YEAR}, immutable`;
  return 'public, max-age=0, must-revalidate';
}
