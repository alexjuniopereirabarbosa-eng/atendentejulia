import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cachedFingerprint: string | null = null;

export async function getBrowserFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedFingerprint = result.visitorId;
    return cachedFingerprint;
  } catch {
    // Fallback: generate a random ID and store in localStorage
    const stored = localStorage.getItem('julia_fallback_fp');
    if (stored) {
      cachedFingerprint = stored;
      return stored;
    }
    const fallback = `fallback_${crypto.randomUUID()}`;
    localStorage.setItem('julia_fallback_fp', fallback);
    cachedFingerprint = fallback;
    return fallback;
  }
}
