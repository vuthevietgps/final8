export function normalizeHex(hex?: string): string | undefined {
  if (!hex) return undefined;
  let h = hex.trim();
  if (!h.startsWith('#')) h = '#' + h;
  if (h.length === 4) {
    h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  return h;
}

export function getContrastTextColor(hex?: string): string {
  const h = normalizeHex(hex);
  if (!h || h.length !== 7) return '#111827';
  const r = parseInt(h.substring(1, 3), 16);
  const g = parseInt(h.substring(3, 5), 16);
  const b = parseInt(h.substring(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 200 ? '#111827' : '#ffffff';
}

export function getDarkerColor(hex: string): string {
  const h = normalizeHex(hex);
  if (!h) return 'rgba(0,0,0,0.2)';
  const r = parseInt(h.substring(1, 3), 16);
  const g = parseInt(h.substring(3, 5), 16);
  const b = parseInt(h.substring(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 120) {
    const factor = 0.7;
    const newR = Math.floor(r * factor);
    const newG = Math.floor(g * factor);
    const newB = Math.floor(b * factor);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }
  return 'rgba(255, 255, 255, 0.3)';
}

export function buildProductStyle(productColor?: string): Record<string, string> {
  const bg = normalizeHex(productColor || '#3B82F6');
  if (!bg) return {};
  const fg = getContrastTextColor(bg);
  const borderColor = getDarkerColor(bg);
  const borderWidth = borderColor.startsWith('rgba') ? '1px' : '2px';
  return {
    'background-color': bg,
    color: fg,
    'border-color': borderColor,
    'border-width': borderWidth,
    'border-style': 'solid',
  };
}

export function buildStatusStyle(hex?: string): Record<string, string> {
  const bg = normalizeHex(hex);
  if (!bg) return {};
  const fg = getContrastTextColor(bg);
  const borderColor = getDarkerColor(bg);
  const borderWidth = borderColor.startsWith('rgba') ? '1px' : '2px';
  return {
    'background-color': bg,
    color: fg,
    'border-color': borderColor,
    'border-width': borderWidth,
    'border-style': 'solid',
  };
}
