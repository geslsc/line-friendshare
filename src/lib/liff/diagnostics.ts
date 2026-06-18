import liff from "@line/liff";

import type { ChatMessageWriteState } from "@/types/store";

const CHAT_MESSAGE_WRITE = "chat_message.write" as const;

export async function queryChatMessageWriteState(): Promise<ChatMessageWriteState> {
  if (!liff.isLoggedIn()) {
    return "unknown";
  }

  if (!liff.permission?.query) {
    return "unknown";
  }

  try {
    const result = await liff.permission.query(CHAT_MESSAGE_WRITE);
    return result.state as ChatMessageWriteState;
  } catch {
    return "unknown";
  }
}

export function evaluateShareTargetPicker(params: {
  isInLine: boolean;
  isLoggedIn: boolean;
  chatMessageWriteState: ChatMessageWriteState;
}): {
  available: boolean;
  needsReauthorize: boolean;
} {
  const { isInLine, isLoggedIn, chatMessageWriteState } = params;

  if (!isInLine || !isLoggedIn) {
    return { available: false, needsReauthorize: false };
  }

  if (chatMessageWriteState === "unavailable") {
    return { available: false, needsReauthorize: false };
  }

  if (chatMessageWriteState === "prompt") {
    return { available: false, needsReauthorize: true };
  }

  const isSubWindow = liff.isSubWindow?.() ?? false;
  if (isSubWindow) {
    return { available: false, needsReauthorize: false };
  }

  return {
    available: liff.isApiAvailable("shareTargetPicker"),
    needsReauthorize: false,
  };
}
