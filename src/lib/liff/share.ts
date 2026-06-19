import liff from "@line/liff";

import { getEnvConfig, getAbsoluteAssetUrl } from "@/config/env";
import type { ShareEnvironment, StoreConfig } from "@/types/store";

import {
  evaluateShareTargetPicker,
  queryChatMessageWriteState,
} from "./diagnostics";
import { buildLoginRedirectUri } from "./autoshare";

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
    needsLogin: false,
    needsReauthorize: false,
    ...partial,
  };
}

async function buildEnvironmentAfterInit(): Promise<LiffInitResult> {
  const isInLine = liff.isInClient();

  if (!isInLine) {
    return { environment: baseEnvironment({ isInLine: false }) };
  }

  const isLoggedIn = liff.isLoggedIn();

  if (!isLoggedIn) {
    try {
      liff.login({ redirectUri: buildLoginRedirectUri() });
      return {
        environment: baseEnvironment({
          isInLine: true,
          isLoggedIn: false,
          needsLogin: true,
        }),
        redirecting: true,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "liff.login 失敗";

      return {
        environment: baseEnvironment({
          isInLine: true,
          isLoggedIn: false,
          needsLogin: true,
          initError: message,
        }),
      };
    }
  }

  const chatMessageWriteState = await queryChatMessageWriteState();

  const pickerResult = evaluateShareTargetPicker({
    isInLine,
    isLoggedIn,
    chatMessageWriteState,
  });

  return {
    environment: baseEnvironment({
      isInLine,
      isLoggedIn,
      isShareTargetPickerAvailable: pickerResult.available,
      chatMessageWriteState,
      needsReauthorize: pickerResult.needsReauthorize,
    }),
  };
}

export async function initLiff(): Promise<LiffInitResult> {
  const { liffId } = getEnvConfig();

  if (!liffId) {
    return {
      environment: baseEnvironment({
        initError: "LIFF ID 尚未設定",
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
      }),
    };
  }
}

export async function requestChatMessageWritePermission(): Promise<LiffInitResult> {
  if (!liff.permission?.requestAll) {
    return {
      environment: baseEnvironment({
        initError: "無法請求分享權限",
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
        initError: message,
      }),
    };
  }
}

export async function shareStoreViaTargetPicker(
  store: StoreConfig
): Promise<{
  success: boolean;
  cancelled?: boolean;
  error?: string;
  errorCode?: string;
}> {
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
      error: "Share Target Picker 在此環境不可用。",
    };
  }

  const imageUrl = getAbsoluteAssetUrl(store.shareImage);
  const fallbackText = `${store.shareTitle}\n\n${store.shareDescription}\n${store.targetUrl}`;

  try {
    const result = await liff.shareTargetPicker([
      {
        type: "flex",
        altText: store.shareTitle,
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
                text: store.shareTitle,
                weight: "bold",
                size: "xl",
                wrap: true,
              },
              {
                type: "text",
                text: store.shareDescription,
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
                  label: store.shareButtonLabel,
                  uri: store.targetUrl,
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
        text: fallbackText,
      },
    ]);

    if (result) {
      return { success: true };
    }

    return { success: false, cancelled: true };
  } catch (error) {
    const record =
      typeof error === "object" && error !== null
        ? (error as Record<string, unknown>)
        : null;
    const message =
      error instanceof Error ? error.message : "分享失敗，請稍後再試";
    const errorCode =
      record?.code != null ? String(record.code) : undefined;
    return { success: false, error: message, errorCode };
  }
}
