import liff from "@line/liff";

import { getEnvConfig, getAbsoluteAssetUrl } from "@/config/env";
import type { ShareEnvironment, StoreConfig } from "@/types/store";

import {
  evaluateShareTargetPicker,
  getRuntimeInfo,
  logDiagnostics,
  queryChatMessageWriteState,
} from "./diagnostics";

let liffInitialized = false;

export interface LiffInitResult {
  environment: ShareEnvironment;
  /** 已觸發 liff.login 導向，頁面即將重新載入 */
  redirecting?: boolean;
}

function baseEnvironment(
  partial: Partial<ShareEnvironment> = {}
): ShareEnvironment {
  return {
    isInLine: false,
    isLoggedIn: false,
    isShareTargetPickerAvailable: false,
    chatMessageWriteState: "unknown",
    initError: null,
    shareBlockReason: null,
    diagnostics: [],
    lineVersion: null,
    liffVersion: null,
    os: null,
    needsLogin: false,
    needsReauthorize: false,
    ...partial,
  };
}

async function buildEnvironmentAfterInit(): Promise<LiffInitResult> {
  const diagnostics: ShareEnvironment["diagnostics"] = [];
  const runtime = getRuntimeInfo();

  const isInLine = liff.isInClient();
  diagnostics.push({
    step: "isInClient",
    ok: isInLine,
    message: isInLine
      ? "在 LINE App 內"
      : "不在 LINE App 內（外部瀏覽器）",
  });

  if (!isInLine) {
    const environment = baseEnvironment({
      ...runtime,
      isInLine: false,
      diagnostics,
      shareBlockReason:
        "原因：不在 LINE App 內。請透過正式 LIFF URL 在 LINE App 中開啟此頁。",
    });
    logDiagnostics(diagnostics);
    return { environment };
  }

  const isLoggedIn = liff.isLoggedIn();
  diagnostics.push({
    step: "isLoggedIn",
    ok: isLoggedIn,
    message: isLoggedIn ? "已登入 LINE" : "尚未登入 LINE",
  });

  if (!isLoggedIn) {
    try {
      liff.login({ redirectUri: window.location.href });
      const environment = baseEnvironment({
        ...runtime,
        isInLine: true,
        isLoggedIn: false,
        needsLogin: true,
        diagnostics: [
          ...diagnostics,
          {
            step: "liff.login",
            ok: true,
            message: "已觸發 liff.login，等待使用者完成登入…",
          },
        ],
        shareBlockReason:
          "原因：尚未登入 LINE，正在導向登入頁。登入完成後會自動回到此頁。",
      });
      logDiagnostics(environment.diagnostics);
      return { environment, redirecting: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "liff.login 失敗";

      const environment = baseEnvironment({
        ...runtime,
        isInLine: true,
        isLoggedIn: false,
        needsLogin: true,
        diagnostics: [
          ...diagnostics,
          { step: "liff.login", ok: false, message },
        ],
        shareBlockReason: `原因：無法觸發 LIFF 登入（${message}）`,
      });
      logDiagnostics(environment.diagnostics);
      return { environment };
    }
  }

  const permissionResult = await queryChatMessageWriteState();
  diagnostics.push(permissionResult.diagnostic);

  const pickerResult = evaluateShareTargetPicker({
    isInLine,
    isLoggedIn,
    chatMessageWriteState: permissionResult.state,
    lineVersion: runtime.lineVersion,
  });
  diagnostics.push(pickerResult.diagnostic);

  const environment = baseEnvironment({
    ...runtime,
    isInLine,
    isLoggedIn,
    isShareTargetPickerAvailable: pickerResult.available,
    chatMessageWriteState: permissionResult.state,
    diagnostics,
    shareBlockReason: pickerResult.shareBlockReason,
    needsReauthorize: pickerResult.needsReauthorize,
  });

  logDiagnostics(diagnostics);
  return { environment };
}

export async function initLiff(): Promise<LiffInitResult> {
  const { liffId } = getEnvConfig();

  if (!liffId) {
    return {
      environment: baseEnvironment({
        initError: "LIFF ID 尚未設定，請設定 NEXT_PUBLIC_LIFF_ID 環境變數。",
        shareBlockReason:
          "原因：NEXT_PUBLIC_LIFF_ID 未設定，無法初始化 LIFF。",
        diagnostics: [
          {
            step: "env",
            ok: false,
            message: "NEXT_PUBLIC_LIFF_ID 未設定",
          },
        ],
      }),
    };
  }

  try {
    await liff.init({ liffId });
    liffInitialized = true;
    return buildEnvironmentAfterInit();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "LIFF 初始化失敗";

    return {
      environment: baseEnvironment({
        initError: message,
        shareBlockReason: `原因：liff.init 失敗（${message}）`,
        diagnostics: [{ step: "liff.init", ok: false, message }],
      }),
    };
  }
}

/** 分享前重新檢查環境（避免 init 時機過早造成誤判） */
export async function refreshShareEnvironment(): Promise<LiffInitResult> {
  const { liffId } = getEnvConfig();

  if (!liffId) {
    return initLiff();
  }

  try {
    if (!liffInitialized) {
      await liff.init({ liffId });
      liffInitialized = true;
    }
    return buildEnvironmentAfterInit();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "LIFF 環境刷新失敗";

    return {
      environment: baseEnvironment({
        initError: message,
        shareBlockReason: `原因：刷新 LIFF 環境失敗（${message}）`,
        diagnostics: [{ step: "refresh", ok: false, message }],
      }),
    };
  }
}

export async function requestChatMessageWritePermission(): Promise<LiffInitResult> {
  if (!liff.permission?.requestAll) {
    return {
      environment: baseEnvironment({
        shareBlockReason: "原因：此 LIFF SDK 不支援 permission.requestAll",
        diagnostics: [
          {
            step: "permission.requestAll",
            ok: false,
            message: "permission.requestAll 不可用",
          },
        ],
      }),
    };
  }

  try {
    await liff.permission.requestAll();
    return refreshShareEnvironment();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "重新授權失敗";

    return {
      environment: baseEnvironment({
        shareBlockReason: `原因：重新授權 chat_message.write 失敗（${message}）`,
        diagnostics: [
          { step: "permission.requestAll", ok: false, message },
        ],
      }),
    };
  }
}

export async function shareStoreViaTargetPicker(
  store: StoreConfig
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  const refreshed = await refreshShareEnvironment();

  if (refreshed.redirecting) {
    return {
      success: false,
      error: "正在導向 LINE 登入，請完成登入後再試。",
    };
  }

  const { environment } = refreshed;

  if (!environment.isShareTargetPickerAvailable) {
    return {
      success: false,
      error:
        environment.shareBlockReason ??
        "Share Target Picker 在此環境不可用",
    };
  }

  const imageUrl = getAbsoluteAssetUrl(store.shareImage);
  const shareText = `${store.shareText}\n${store.storeLink}`;

  try {
    const result = await liff.shareTargetPicker([
      {
        type: "flex",
        altText: `${store.name} — 好友推薦`,
        contents: {
          type: "bubble",
          hero: {
            type: "image",
            url: imageUrl,
            size: "full",
            aspectRatio: "20:13",
            aspectMode: "cover",
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: store.name,
                weight: "bold",
                size: "xl",
                wrap: true,
              },
              {
                type: "text",
                text: store.shareText,
                size: "sm",
                color: "#666666",
                wrap: true,
                margin: "md",
              },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "查看店家",
                  uri: store.storeLink,
                },
                style: "primary",
                color: "#06C755",
              },
            ],
          },
        },
      },
      {
        type: "text",
        text: shareText,
      },
    ]);

    if (result) {
      return { success: true };
    }

    return { success: false, cancelled: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "分享失敗，請稍後再試";
    return { success: false, error: message };
  }
}
