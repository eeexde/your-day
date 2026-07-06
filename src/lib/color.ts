// Pick a readable foreground color (near-black or white) for text sitting on a
// solid background color, based on the background's perceived brightness (YIQ).
const DARK = '#221c14'; // matches --ink
const LIGHT = '#ffffff';

export function readableTextColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return LIGHT;
  const [r, g, b] = rgb;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? DARK : LIGHT;
}

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
