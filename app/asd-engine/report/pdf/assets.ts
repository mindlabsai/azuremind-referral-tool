export const TEXLEX_LOGO_PATH = "/logo-azure-mind.jpg";
export const TEXLEX_SIGNATURE_PATH = "/signature-vishal.png";

export function resolveTexlexPublicAsset(path: string, origin?: string): string {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return base ? `${base}${path}` : path;
}

export async function resolveTexlexSignatureSrc(origin?: string): Promise<string | null> {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return null;
  const src = resolveTexlexPublicAsset(TEXLEX_SIGNATURE_PATH, base);
  try {
    const response = await fetch(src, { method: "HEAD" });
    if (!response.ok) return null;
    return src;
  } catch {
    return null;
  }
}
