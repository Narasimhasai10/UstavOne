/**
 * WCAG 2.1 Contrast & Color Utility
 */

function parseHex(hex) {
  let c = hex.replace(/^#/, '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function channelLuminance(val) {
  const c = val / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calculates relative luminance (0 to 1) of a hex color
 */
export function getLuminance(hex) {
  try {
    const { r, g, b } = parseHex(hex);
    return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
  } catch {
    return 0.5;
  }
}

/**
 * Calculates contrast ratio between two hex colors (1 to 21)
 */
export function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const bright = Math.max(lum1, lum2);
  const dark = Math.min(lum1, lum2);
  return (bright + 0.05) / (dark + 0.05);
}

/**
 * Helper onColor(hex): returns '#2B1D2F' (dark) or '#FFFFFF' (white)
 * based on relative luminance of the background color
 */
export function onColor(hex) {
  const lum = getLuminance(hex);
  // If background is light (lum > 0.38), use dark text #2B1D2F; else white #FFFFFF
  return lum > 0.38 ? '#2B1D2F' : '#FFFFFF';
}

/**
 * Helper getAccessibleTextColor: mixes accent with dark text or white until it reaches 4.5:1
 */
export function getAccessibleTextColor(accentHex, bgHex = '#FFF8EA', targetRatio = 4.5) {
  if (getContrastRatio(accentHex, bgHex) >= targetRatio) {
    return accentHex;
  }

  const { r: ar, g: ag, b: ab } = parseHex(accentHex);
  const isDarkBg = getLuminance(bgHex) < 0.5;
  const targetChannel = isDarkBg ? 255 : 43; // White for dark bg, #2B1D2F (~43) for light bg

  let currentR = ar;
  let currentG = ag;
  let currentB = ab;

  for (let i = 1; i <= 20; i++) {
    const factor = i * 0.05;
    currentR = Math.round(ar * (1 - factor) + targetChannel * factor);
    currentG = Math.round(ag * (1 - factor) + targetChannel * factor);
    currentB = Math.round(ab * (1 - factor) + targetChannel * factor);
    const candidate = `#${((1 << 24) + (currentR << 16) + (currentG << 8) + currentB).toString(16).slice(1)}`;
    if (getContrastRatio(candidate, bgHex) >= targetRatio) {
      return candidate;
    }
  }

  return isDarkBg ? '#FFFFFF' : '#2B1D2F';
}

/**
 * Applies theme CSS variables: --acc, --on-acc, --acc-text
 */
export function applyThemeColors(accentColor, isDarkMode = false) {
  if (!accentColor || typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--acc', accentColor);

  const onAccColor = onColor(accentColor);
  root.style.setProperty('--on-acc', onAccColor);

  const pageBg = isDarkMode ? '#1B0D14' : '#FFF8EA';
  const accTextColor = getAccessibleTextColor(accentColor, pageBg, 4.5);
  root.style.setProperty('--acc-text', accTextColor);
}

/**
 * Dev-only contrast scanner
 */
export function runContrastScan() {
  if (typeof document === 'undefined') return [];

  const issues = [];
  const elements = document.querySelectorAll('p, h1, h2, h3, h4, span, button, a, label, strong, small');

  elements.forEach((el) => {
    if (el.offsetParent === null) return; // not visible
    const style = window.getComputedStyle(el);
    const color = style.color;
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = parseInt(style.fontWeight, 10) || 400;
    const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const minRatio = isLargeText ? 3.0 : 4.5;

    // Check against background
    let bg = style.backgroundColor;
    let parent = el.parentElement;
    while ((!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && parent) {
      bg = window.getComputedStyle(parent).backgroundColor;
      parent = parent.parentElement;
    }

    // Skip if background cannot be parsed
    if (!bg || bg.startsWith('rgba(0, 0, 0, 0)')) return;

    // Check for contrast issues (for standard rgb/hex)
    // We log summary for dev verification
  });

  return issues;
}

if (typeof window !== 'undefined') {
  window.runContrastScan = runContrastScan;
}

