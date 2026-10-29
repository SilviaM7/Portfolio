/**
 * Build a URL for a file in /public that works on both deployment targets:
 *   https://USERNAME.github.io/            (BASE_URL = "/")
 *   https://USERNAME.github.io/REPOSITORY/ (BASE_URL = "/REPOSITORY/")
 *
 * Always pass a path WITHOUT a leading slash, e.g. assetUrl("data/ai-spend/usage_events.csv").
 */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}${path.replace(/^\/+/, '')}`;
}

/** Only https:// URLs are rendered as links, so a mistyped or malicious config value cannot create a script or http link. */
export function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
