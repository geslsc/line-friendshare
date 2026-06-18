/**
 * autoShare 驗證版（非正式功能）
 *
 * 僅在 URL 帶 autoShare=1 時啟用，用於實測 LIFF 載入後自動開啟 Share Target Picker。
 */

import type { ShareEnvironment, StoreConfig } from "@/types/store";

import { shareStoreViaTargetPicker } from "./share";

export const AUTO_SHARE_SESSION_KEY = "line-friendshare-autoshare-attempted";

export type AutoShareOutcome =
  | "idle"
  | "skipped_not_enabled"
  | "skipped_session"
  | "skipped_login_redirect"
  | "fallback_precheck"
  | "success"
  | "cancelled"
  | "failed";

export interface AutoShareDiagnostic {
  autoShareEnabled: boolean;
  autoShareAttempted: boolean;
  skippedBySessionStorage: boolean;
  isInClient: boolean | null;
  isLoggedIn: boolean | null;
  chatMessageWriteState: string | null;
  isShareTargetPickerAvailable: boolean | null;
  shareResult: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export function isAutoShareEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("autoShare") === "1";
}

export function hasAutoShareAttempted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return sessionStorage.getItem(AUTO_SHARE_SESSION_KEY) === "1";
}

export function markAutoShareAttempted(): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(AUTO_SHARE_SESSION_KEY, "1");
}

export function clearAutoShareAttempted(): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.removeItem(AUTO_SHARE_SESSION_KEY);
}

export function buildLoginRedirectUri(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);

  if (isAutoShareEnabled()) {
    url.searchParams.set("autoShare", "1");
  }

  return url.toString();
}

function baseDiagnostic(
  partial: Partial<AutoShareDiagnostic> = {}
): AutoShareDiagnostic {
  return {
    autoShareEnabled: isAutoShareEnabled(),
    autoShareAttempted: hasAutoShareAttempted(),
    skippedBySessionStorage: false,
    isInClient: null,
    isLoggedIn: null,
    chatMessageWriteState: null,
    isShareTargetPickerAvailable: null,
    shareResult: null,
    errorCode: null,
    errorMessage: null,
    ...partial,
  };
}

export interface AutoShareFlowResult {
  outcome: AutoShareOutcome;
  diagnostics: AutoShareDiagnostic;
}

export async function runAutoShareFlow(
  store: StoreConfig,
  environment: ShareEnvironment,
  options: { isLoginRedirect?: boolean } = {}
): Promise<AutoShareFlowResult> {
  if (!isAutoShareEnabled()) {
    return {
      outcome: "skipped_not_enabled",
      diagnostics: baseDiagnostic({ autoShareEnabled: false }),
    };
  }

  if (options.isLoginRedirect) {
    return {
      outcome: "skipped_login_redirect",
      diagnostics: baseDiagnostic({
        shareResult: "等待 LINE 登入完成後返回",
      }),
    };
  }

  if (hasAutoShareAttempted()) {
    return {
      outcome: "skipped_session",
      diagnostics: baseDiagnostic({
        skippedBySessionStorage: true,
        isInClient: environment.isInLine,
        isLoggedIn: environment.isLoggedIn,
        chatMessageWriteState: environment.chatMessageWriteState,
        isShareTargetPickerAvailable: environment.isShareTargetPickerAvailable,
        shareResult: "本 session 已嘗試過 autoShare，不再自動彈出",
      }),
    };
  }

  const diagnostics = baseDiagnostic({
    isInClient: environment.isInLine,
    isLoggedIn: environment.isLoggedIn,
    chatMessageWriteState: environment.chatMessageWriteState,
    isShareTargetPickerAvailable: environment.isShareTargetPickerAvailable,
  });

  const precheckFailed =
    environment.initError ||
    !environment.isInLine ||
    !environment.isLoggedIn ||
    environment.chatMessageWriteState !== "granted" ||
    !environment.isShareTargetPickerAvailable;

  if (precheckFailed) {
    return {
      outcome: "fallback_precheck",
      diagnostics: {
        ...diagnostics,
        shareResult: "前置條件未通過，降級為手動分享",
        errorMessage: environment.initError ?? null,
      },
    };
  }

  markAutoShareAttempted();

  const result = await shareStoreViaTargetPicker(store);

  if (result.success) {
    return {
      outcome: "success",
      diagnostics: {
        ...diagnostics,
        autoShareAttempted: true,
        shareResult: "shareTargetPicker 呼叫成功（已完成分享操作）",
      },
    };
  }

  if (result.cancelled) {
    return {
      outcome: "cancelled",
      diagnostics: {
        ...diagnostics,
        autoShareAttempted: true,
        shareResult: "使用者取消分享",
      },
    };
  }

  return {
    outcome: "failed",
    diagnostics: {
      ...diagnostics,
      autoShareAttempted: true,
      shareResult: "shareTargetPicker 呼叫失敗",
      errorCode: result.errorCode ?? null,
      errorMessage: result.error ?? null,
    },
  };
}
