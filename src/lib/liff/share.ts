import liff from "@line/liff";

import { getEnvConfig, getAbsoluteAssetUrl } from "@/config/env";
import type { StoreConfig, ShareEnvironment } from "@/types/store";

export interface LiffInitResult {
  environment: ShareEnvironment;
}

export async function initLiff(): Promise<LiffInitResult> {
  const { liffId } = getEnvConfig();

  const baseEnvironment: ShareEnvironment = {
    isInLine: false,
    isShareTargetPickerAvailable: false,
    initError: null,
  };

  if (!liffId) {
    return {
      environment: {
        ...baseEnvironment,
        initError: "LIFF ID 尚未設定，請設定 NEXT_PUBLIC_LIFF_ID 環境變數。",
      },
    };
  }

  try {
    await liff.init({ liffId });

    const isInLine = liff.isInClient();
    const isShareTargetPickerAvailable = liff.isApiAvailable(
      "shareTargetPicker"
    );

    return {
      environment: {
        isInLine,
        isShareTargetPickerAvailable,
        initError: null,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "LIFF 初始化失敗";

    return {
      environment: {
        ...baseEnvironment,
        initError: message,
      },
    };
  }
}

export async function shareStoreViaTargetPicker(
  store: StoreConfig
): Promise<{ success: boolean; cancelled?: boolean; error?: string }> {
  if (!liff.isApiAvailable("shareTargetPicker")) {
    return {
      success: false,
      error: "Share Target Picker 在此環境不可用",
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
