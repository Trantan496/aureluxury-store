// Only explicitly public raster assets may become browser URLs. No storage credentials,
// private keys, URL schemes, encoded traversal, SVG or query strings are accepted.
export function publicProductImageUrl(storageKey: string): string | null {
  if (/[\u0000-\u0020\u007f]/.test(storageKey)) return null;
  if (!/^\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif|gif)$/i.test(storageKey)) return null;
  return storageKey;
}

export function validProductImageKey(value: string): boolean {
  if (/[\u0000-\u0020\u007f]/.test(value)) return false;
  return publicProductImageUrl(value) !== null ||
    /^public\/products\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif|gif)$/i.test(value);
}
