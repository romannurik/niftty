// hello!
// this is a test file
export type ButtonLabel = 'open' | 'try' | 'export' | 'continue';
export type ButtonColor = 'dark' | 'light' | 'purple';
export type ButtonSize = 20 | 32;
export type ButtonImageFormat = 'svg' | 'png';

export interface ButtonImageConfig {
  label?: ButtonLabel;
  color?: ButtonColor;
  size?: ButtonSize;
  imageFormat?: ButtonImageFormat;
}

/**
 * Get the CDN URL for a given "Open in Firebase Studio" button configuration.
 */
export function buttonImageUrl({
  label = 'open',
  color = 'dark',
  size = 32,
  imageFormat = 'svg'
}: ButtonImageConfig = {}) {
  return [
    'https://cdn.idx.dev/btn/',
    label, '_',
    color, '_',
    `${size}${imageFormat === 'png' ? '@2x' : ''}.${imageFormat}`
  ].join('');
}
