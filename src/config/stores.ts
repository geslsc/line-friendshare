import type { StoreConfig } from "@/types/store";

/**
 * v1 靜態店家設定檔（不接 DB、不接後端 API）
 *
 * 店家代號使用不易猜測的字串，非流水號。
 * 未來 v2 可替換為正式店家資料或改由 DB / 後台 API 提供。
 */
export const stores: StoreConfig[] = [
  {
    code: "k8m3n7x2",
    name: "客立樂優惠券測試",
    targetUrl: "https://qli.tw/j-yVCXQ",
    shareButtonLabel: "查看優惠券",
    shareText:
      "推薦你領這張優惠券\n\n" +
      "我看到這張優惠券覺得不錯，分享給你看看～點進去就可以查看優惠內容。",
    shareImage: "/images/demo-store-share.png",
  },
];

const storeMap = new Map(stores.map((store) => [store.code, store]));

/** 從 URL path segment（如 store-k8m3n7x2）解析店家代號 */
export function parseStorePathSegment(segment: string): string | null {
  const prefix = "store-";
  if (!segment.startsWith(prefix)) {
    return null;
  }
  const code = decodeURIComponent(segment.slice(prefix.length));
  return code || null;
}

export function getStoreByCode(code: string): StoreConfig | undefined {
  return storeMap.get(code);
}

export function getStoreByPathSegment(
  segment: string
): StoreConfig | undefined {
  const code = parseStorePathSegment(segment);
  if (!code) {
    return undefined;
  }
  return getStoreByCode(code);
}

export function getAllStorePaths(): string[] {
  return stores.map((store) => `store-${store.code}`);
}
