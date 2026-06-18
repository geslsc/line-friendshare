/**
 * v1 最小埋點模組
 *
 * 使用 localStorage 持久化事件，前端可行、無需後端。
 * v2 可替換為後端 API、第三方分析服務（如 GA4、Plausible）或 Vercel Analytics。
 */

export type AnalyticsEventType = "page_view" | "share_click";

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  storeCode: string;
  timestamp: string;
  sessionId: string;
  /** v2: referralCode?: string */
}

const STORAGE_KEY = "line-friendshare-analytics";
const SESSION_KEY = "line-friendshare-session";

function getSessionId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function readEvents(): AnalyticsEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as AnalyticsEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: AnalyticsEvent[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Quota exceeded or private mode — fail silently
  }
}

export function trackEvent(
  type: AnalyticsEventType,
  storeCode: string
): void {
  if (typeof window === "undefined") {
    return;
  }

  const event: AnalyticsEvent = {
    type,
    storeCode,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
  };

  const events = readEvents();
  events.push(event);
  writeEvents(events);

  if (process.env.NODE_ENV === "development") {
    console.info("[analytics]", event);
  }
}

export function getEventCounts(storeCode?: string): {
  pageViews: number;
  shareClicks: number;
} {
  const events = readEvents();
  const filtered = storeCode
    ? events.filter((e) => e.storeCode === storeCode)
    : events;

  return {
    pageViews: filtered.filter((e) => e.type === "page_view").length,
    shareClicks: filtered.filter((e) => e.type === "share_click").length,
  };
}

/** v2: export function sendToBackend(event: AnalyticsEvent): Promise<void> */
