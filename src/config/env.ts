/**
 * 環境變數讀取（不可在程式中寫死網域或 LIFF URL）
 *
 * Next.js 前端可讀取的變數需以 NEXT_PUBLIC_ 為前綴。
 */
export function getEnvConfig() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
  const publicBaseUrl = (
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ?? ""
  ).replace(/\/$/, "");

  return {
    liffId,
    publicBaseUrl,
  };
}

export function getStorePageUrl(storeCode: string): string {
  const { publicBaseUrl } = getEnvConfig();
  const path = `/store-${encodeURIComponent(storeCode)}`;

  if (publicBaseUrl) {
    return `${publicBaseUrl}${path}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }

  return path;
}

export function getAbsoluteAssetUrl(relativePath: string): string {
  const { publicBaseUrl } = getEnvConfig();
  const normalized = relativePath.startsWith("/")
    ? relativePath
    : `/${relativePath}`;

  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }

  if (publicBaseUrl) {
    return `${publicBaseUrl}${normalized}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${normalized}`;
  }

  return normalized;
}
