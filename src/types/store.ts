/**
 * 店家資料型別（v1 靜態設定檔用）
 *
 * v2 擴充預留（尚未實作）：
 * - referralCode?: string
 * - rewardConfig?: RewardConfig
 * - metadata?: Record<string, unknown>
 */
export interface StoreConfig {
  /** 不易猜測的店家代號，用於 URL path segment */
  code: string;
  /** 店名 */
  name: string;
  /** 店家 LINE 官方帳號或連結 */
  storeLink: string;
  /** 分享給好友的推薦文案 */
  shareText: string;
  /** 分享圖片（相對於 public/ 或完整 HTTPS URL） */
  shareImage: string;
}

export type SharePageStatus =
  | "loading"
  | "ready"
  | "share_unavailable"
  | "not_in_line"
  | "init_error"
  | "login_redirect";

export type ChatMessageWriteState =
  | "granted"
  | "prompt"
  | "unavailable"
  | "unknown";

export interface ShareDiagnostic {
  step: string;
  ok: boolean;
  message: string;
}

export interface ShareEnvironment {
  isInLine: boolean;
  isLoggedIn: boolean;
  isShareTargetPickerAvailable: boolean;
  chatMessageWriteState: ChatMessageWriteState;
  initError: string | null;
  /** 主要阻擋原因（人類可讀） */
  shareBlockReason: string | null;
  /** 逐步診斷紀錄 */
  diagnostics: ShareDiagnostic[];
  lineVersion: string | null;
  liffVersion: string | null;
  os: string | null;
  needsLogin: boolean;
  needsReauthorize: boolean;
}
