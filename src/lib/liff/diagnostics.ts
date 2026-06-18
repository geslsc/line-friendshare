import liff from "@line/liff";

import type {
  ChatMessageWriteState,
  ShareDiagnostic,
  ShareEnvironment,
} from "@/types/store";

const CHAT_MESSAGE_WRITE = "chat_message.write" as const;

function mapPermissionMessage(state: ChatMessageWriteState): string {
  switch (state) {
    case "granted":
      return "chat_message.write 已授權";
    case "prompt":
      return "chat_message.write 尚未授權，需重新同意權限";
    case "unavailable":
      return "LIFF App 未設定 chat_message.write scope（請至 LINE Console 加入）";
    default:
      return "無法確認 chat_message.write 授權狀態";
  }
}

export function getRuntimeInfo(): Pick<
  ShareEnvironment,
  "lineVersion" | "liffVersion" | "os"
> {
  return {
    lineVersion: liff.getLineVersion?.() ?? null,
    liffVersion: liff.getVersion?.() ?? null,
    os: liff.getOS?.() ?? null,
  };
}

export async function queryChatMessageWriteState(): Promise<{
  state: ChatMessageWriteState;
  diagnostic: ShareDiagnostic;
}> {
  if (!liff.isLoggedIn()) {
    return {
      state: "unknown",
      diagnostic: {
        step: "chat_message.write",
        ok: false,
        message: "尚未登入，無法查詢 chat_message.write 授權狀態",
      },
    };
  }

  if (!liff.permission?.query) {
    return {
      state: "unknown",
      diagnostic: {
        step: "chat_message.write",
        ok: false,
        message: "此 LIFF SDK 版本不支援 permission.query",
      },
    };
  }

  try {
    const result = await liff.permission.query(CHAT_MESSAGE_WRITE);
    const state = result.state as ChatMessageWriteState;

    return {
      state,
      diagnostic: {
        step: "chat_message.write",
        ok: state === "granted",
        message: mapPermissionMessage(state),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "查詢 chat_message.write 失敗";

    return {
      state: "unknown",
      diagnostic: {
        step: "chat_message.write",
        ok: false,
        message,
      },
    };
  }
}

export function evaluateShareTargetPicker(params: {
  isInLine: boolean;
  isLoggedIn: boolean;
  chatMessageWriteState: ChatMessageWriteState;
  lineVersion: string | null;
}): {
  available: boolean;
  diagnostic: ShareDiagnostic;
  shareBlockReason: string | null;
  needsReauthorize: boolean;
} {
  const { isInLine, isLoggedIn, chatMessageWriteState, lineVersion } = params;

  if (!isInLine) {
    return {
      available: false,
      needsReauthorize: false,
      shareBlockReason:
        "原因：不在 LINE App 內（isApiAvailable 在外部瀏覽器會回傳 false）",
      diagnostic: {
        step: "shareTargetPicker",
        ok: false,
        message: "不在 LINE App 內，Share Target Picker 不可用",
      },
    };
  }

  if (!isLoggedIn) {
    return {
      available: false,
      needsReauthorize: false,
      shareBlockReason:
        "原因：尚未完成 LIFF 登入（isApiAvailable 需在 liff.init 且 login 後才可正確判斷）",
      diagnostic: {
        step: "shareTargetPicker",
        ok: false,
        message: "尚未登入 LINE，需先完成 liff.login",
      },
    };
  }

  if (chatMessageWriteState === "unavailable") {
    return {
      available: false,
      needsReauthorize: false,
      shareBlockReason:
        "原因：LIFF App 未設定 chat_message.write scope。請至 LINE Developers Console 加入此 scope，並請使用者重新開啟 LIFF URL 授權。",
      diagnostic: {
        step: "shareTargetPicker",
        ok: false,
        message: "chat_message.write 不在 LIFF scope 設定中",
      },
    };
  }

  if (chatMessageWriteState === "prompt") {
    return {
      available: false,
      needsReauthorize: true,
      shareBlockReason:
        "原因：使用者尚未重新授權 chat_message.write。請點「重新授權」完成同意。",
      diagnostic: {
        step: "shareTargetPicker",
        ok: false,
        message: "chat_message.write 尚未授權（prompt）",
      },
    };
  }

  const isSubWindow = liff.isSubWindow?.() ?? false;
  if (isSubWindow) {
    return {
      available: false,
      needsReauthorize: false,
      shareBlockReason: "原因：Share Target Picker 只能在 LIFF 主視窗呼叫",
      diagnostic: {
        step: "shareTargetPicker",
        ok: false,
        message: "目前在 sub window，無法使用 shareTargetPicker",
      },
    };
  }

  const available = liff.isApiAvailable("shareTargetPicker");

  if (!available) {
    const versionHint = lineVersion
      ? `目前 LINE App 版本：${lineVersion}。請更新 LINE App 至最新版。`
      : "請更新 LINE App 至最新版。";

    return {
      available: false,
      needsReauthorize: false,
      shareBlockReason: `原因：Share Target Picker 在此環境不可用。${versionHint} 並確認 LINE Console 已啟用 shareTargetPicker 且已同意條款。`,
      diagnostic: {
        step: "shareTargetPicker",
        ok: false,
        message: `isApiAvailable('shareTargetPicker') 回傳 false${lineVersion ? `（LINE ${lineVersion}）` : ""}`,
      },
    };
  }

  return {
    available: true,
    needsReauthorize: false,
    shareBlockReason: null,
    diagnostic: {
      step: "shareTargetPicker",
      ok: true,
      message: "Share Target Picker 可用",
    },
  };
}

export function logDiagnostics(diagnostics: ShareDiagnostic[]): void {
  if (process.env.NODE_ENV === "development") {
    console.info("[liff-diagnostics]", diagnostics);
  }
}
