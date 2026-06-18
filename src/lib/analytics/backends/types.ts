/**
 * v2 埋點後端介面預留（尚未實作）
 *
 * 正式商業化時可實作：
 * - sendEventToApi(event) → POST /api/analytics
 * - 整合 GA4 / Plausible / Vercel Analytics
 */
export interface AnalyticsBackend {
  track(
    type: "page_view" | "share_click",
    storeCode: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;
}
