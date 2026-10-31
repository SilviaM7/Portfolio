/**
 * Checks WCAG 2.2 contrast ratios for the colour tokens in src/index.css (light and dark).
 *   npm run check:contrast
 * Text pairs need 4.5:1; the focus ring (non-text UI) needs 3:1. Exits non-zero on any failure.
 * This checks token pairs only; it does not prove every rendered combination is accessible.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8');

function tokens(selector: ':root' | '.dark'): Record<string, string> {
  const match = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`Block ${selector} not found in src/index.css`);
  const out: Record<string, string> = {};
  for (const [, name, value] of match[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) if (name && value) out[name] = value;
  return out;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: { fg: string; bg: string; min: number; use: string }[] = [
  { fg: 'foreground', bg: 'background', min: 4.5, use: 'body text' },
  { fg: 'foreground', bg: 'card', min: 4.5, use: 'text on cards' },
  { fg: 'foreground', bg: 'muted', min: 4.5, use: 'text on muted surfaces' },
  { fg: 'heading', bg: 'background', min: 4.5, use: 'headings' },
  { fg: 'heading', bg: 'card', min: 4.5, use: 'headings on cards' },
  { fg: 'heading', bg: 'muted', min: 4.5, use: 'headings on muted surfaces' },
  { fg: 'muted-foreground', bg: 'background', min: 4.5, use: 'secondary text' },
  { fg: 'muted-foreground', bg: 'card', min: 4.5, use: 'secondary text on cards' },
  { fg: 'muted-foreground', bg: 'muted', min: 4.5, use: 'secondary text on muted' },
  { fg: 'accent', bg: 'background', min: 4.5, use: 'accent links and labels' },
  { fg: 'accent', bg: 'card', min: 4.5, use: 'accent text on cards' },
  { fg: 'accent', bg: 'accent-soft', min: 4.5, use: 'badge text' },
  { fg: 'foreground', bg: 'accent-soft', min: 4.5, use: 'placeholder notes' },
  { fg: 'accent-foreground', bg: 'accent', min: 4.5, use: 'primary button text' },
  ...(['destructive', 'warning', 'success'] as const).flatMap((tone) => [
    { fg: tone, bg: 'background', min: 4.5, use: `${tone} message text` },
    { fg: tone, bg: 'card', min: 4.5, use: `${tone} message text on cards` },
    { fg: tone, bg: `${tone}-soft`, min: 4.5, use: `${tone} alert title` },
    { fg: 'foreground', bg: `${tone}-soft`, min: 4.5, use: `${tone} alert body text` },
  ]),
  { fg: 'ring', bg: 'background', min: 3, use: 'focus ring (non-text)' },
  { fg: 'ring', bg: 'card', min: 3, use: 'focus ring on cards (non-text)' },
  { fg: 'chart-1', bg: 'card', min: 3, use: 'chart series 1 (non-text)' },
  { fg: 'chart-2', bg: 'card', min: 3, use: 'chart series 2 (non-text)' },
  { fg: 'chart-3', bg: 'card', min: 3, use: 'chart series 3 (non-text)' },
  { fg: 'chart-4', bg: 'card', min: 3, use: 'chart series 4 (non-text)' },
];

let failures = 0;
for (const mode of [':root', '.dark'] as const) {
  const t = tokens(mode);
  console.warn(`\n${mode === ':root' ? 'Light' : 'Dark'} theme`);
  for (const pair of PAIRS) {
    const fg = t[pair.fg];
    const bg = t[pair.bg];
    if (fg === undefined || bg === undefined) throw new Error(`Missing token for ${pair.fg}/${pair.bg} in ${mode}`);
    const ratio = contrast(fg, bg);
    const ok = ratio >= pair.min;
    if (!ok) failures += 1;
    console.warn(`  ${ok ? 'PASS' : 'FAIL'}  ${ratio.toFixed(2)}:1 (need ${pair.min})  ${pair.fg} on ${pair.bg}: ${pair.use}`);
  }
}
if (failures > 0) {
  console.error(`\n${failures} contrast check(s) failed.`);
  process.exit(1);
}
console.warn('\nAll token pairs meet their minimum contrast.');
