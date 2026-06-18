"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getAbsoluteAssetUrl } from "@/config/env";
import { trackEvent } from "@/lib/analytics/tracker";
import {
  type AutoShareDiagnostic,
  type AutoShareOutcome,
  isAutoShareEnabled,
  runAutoShareFlow,
} from "@/lib/liff/autoshare";
import {
  initLiff,
  refreshShareEnvironment,
  requestChatMessageWritePermission,
  shareStoreViaTargetPicker,
} from "@/lib/liff/share";
import type {
  ShareEnvironment,
  SharePageStatus,
  StoreConfig,
} from "@/types/store";

interface SharePageProps {
  store: StoreConfig;
}

function resolveStatus(
  environment: ShareEnvironment,
  redirecting?: boolean
): SharePageStatus {
  if (redirecting || environment.needsLogin) {
    return "login_redirect";
  }
  if (environment.initError) {
    return "init_error";
  }
  if (!environment.isInLine) {
    return "not_in_line";
  }
  if (!environment.isShareTargetPickerAvailable) {
    return "share_unavailable";
  }
  return "ready";
}

function AutoShareVerificationPanel({
  diagnostics,
  outcome,
}: {
  diagnostics: AutoShareDiagnostic | null;
  outcome: AutoShareOutcome;
}) {
  if (!diagnostics?.autoShareEnabled) {
    return null;
  }

  return (
    <details className="autoshare-verify" open>
      <summary>autoShare 驗證版 · 實測診斷</summary>
      <ul className="autoshare-verify-list">
        <li>
          <strong>autoShare 啟用</strong>：{String(diagnostics.autoShareEnabled)}
        </li>
        <li>
          <strong>已嘗試自動分享</strong>：
          {String(diagnostics.autoShareAttempted)}
        </li>
        <li>
          <strong>sessionStorage 防重複</strong>：
          {String(diagnostics.skippedBySessionStorage)}
        </li>
        <li>
          <strong>isInClient</strong>：{String(diagnostics.isInClient)}
        </li>
        <li>
          <strong>isLoggedIn</strong>：{String(diagnostics.isLoggedIn)}
        </li>
        <li>
          <strong>chat_message.write</strong>：
          {diagnostics.chatMessageWriteState ?? "—"}
        </li>
        <li>
          <strong>isApiAvailable(shareTargetPicker)</strong>：
          {String(diagnostics.isShareTargetPickerAvailable)}
        </li>
        <li>
          <strong>自動分享結果</strong>：{outcome}
        </li>
        {diagnostics.shareResult && (
          <li>
            <strong>結果說明</strong>：{diagnostics.shareResult}
          </li>
        )}
        {diagnostics.errorCode && (
          <li>
            <strong>error.code</strong>：{diagnostics.errorCode}
          </li>
        )}
        {diagnostics.errorMessage && (
          <li>
            <strong>error.message</strong>：{diagnostics.errorMessage}
          </li>
        )}
      </ul>
      <p className="autoshare-verify-note">
        此區塊僅供 autoShare 驗證，非正式功能。
      </p>
    </details>
  );
}

function FallbackNotice({
  status,
  store,
  environment,
  onReauthorize,
  isReauthorizing,
}: {
  status: SharePageStatus;
  store: StoreConfig;
  environment: ShareEnvironment | null;
  onReauthorize: () => void;
  isReauthorizing: boolean;
}) {
  if (status === "ready" || status === "loading") {
    return null;
  }

  if (status === "login_redirect") {
    return (
      <div className="alert alert-info" role="alert">
        <strong>正在導向 LINE 登入</strong>
        <p style={{ margin: "8px 0 0" }}>
          完成登入後會回到此頁，即可使用分享功能。
        </p>
      </div>
    );
  }

  if (status === "init_error") {
    return (
      <div className="alert alert-error" role="alert">
        <strong>LIFF 初始化失敗</strong>
        <p style={{ margin: "8px 0 0" }}>
          無法載入 LINE 分享功能，您仍可使用下方店家連結。
        </p>
      </div>
    );
  }

  if (status === "not_in_line") {
    return (
      <div className="alert alert-warning" role="alert">
        <strong>請在 LINE 內開啟此頁面以使用分享功能</strong>
        <p style={{ margin: "8px 0 0" }}>
          分享按鈕需在 LINE App 的 LIFF 環境中才能使用。您可先透過下方連結前往店家。
        </p>
      </div>
    );
  }

  if (status === "share_unavailable") {
    return (
      <div className="alert alert-warning" role="alert">
        <strong>Share Target Picker 目前不可用</strong>
        <p style={{ margin: "8px 0 0" }}>
          請確認在 LINE App 內開啟此頁面，並已完成必要的分享授權。
        </p>
        {environment?.needsReauthorize && (
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={onReauthorize}
            disabled={isReauthorizing}
          >
            {isReauthorizing ? "授權中…" : "重新授權分享權限"}
          </button>
        )}
        <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
          或直接分享下方店家連結給好友。
        </p>
      </div>
    );
  }

  return (
    <div className="alert alert-info" role="alert">
      您仍可直接前往{" "}
      <a href={store.storeLink} target="_blank" rel="noopener noreferrer">
        {store.name}
      </a>
    </div>
  );
}

export default function SharePageClient({ store }: SharePageProps) {
  const [status, setStatus] = useState<SharePageStatus>("loading");
  const [environment, setEnvironment] = useState<ShareEnvironment | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isReauthorizing, setIsReauthorizing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [autoShareOutcome, setAutoShareOutcome] =
    useState<AutoShareOutcome>("idle");
  const [autoShareDiagnostics, setAutoShareDiagnostics] =
    useState<AutoShareDiagnostic | null>(null);

  const autoShareEnabled = useMemo(() => isAutoShareEnabled(), []);

  const imageUrl = useMemo(
    () => getAbsoluteAssetUrl(store.shareImage),
    [store.shareImage]
  );

  const applyEnvironment = useCallback(
    (result: Awaited<ReturnType<typeof initLiff>>) => {
      setEnvironment(result.environment);
      setStatus(resolveStatus(result.environment, result.redirecting));
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      trackEvent("page_view", store.code);

      const result = await initLiff();
      if (cancelled) {
        return;
      }

      applyEnvironment(result);

      if (!isAutoShareEnabled()) {
        return;
      }

      const autoResult = await runAutoShareFlow(
        store,
        result.environment,
        { isLoginRedirect: Boolean(result.redirecting) }
      );

      if (cancelled) {
        return;
      }

      setAutoShareOutcome(autoResult.outcome);
      setAutoShareDiagnostics(autoResult.diagnostics);

      if (autoResult.outcome === "success") {
        setShareFeedback(
          "已完成分享操作。您可選擇好友或群組完成分享。"
        );
      } else if (autoResult.outcome === "cancelled") {
        setShareFeedback("已取消分享，您可手動再試一次。");
      } else if (autoResult.outcome === "failed") {
        setShareFeedback(
          autoResult.diagnostics.errorMessage ??
            "自動分享失敗，請使用下方按鈕手動分享。"
        );
      } else if (autoResult.outcome === "fallback_precheck") {
        setShareFeedback("自動分享條件未滿足，請使用下方按鈕手動分享。");
      } else if (autoResult.outcome === "skipped_session") {
        setShareFeedback("本 session 已嘗試過自動分享，請手動分享。");
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [store, applyEnvironment]);

  const handleReauthorize = useCallback(async () => {
    setIsReauthorizing(true);
    setShareFeedback(null);

    try {
      const result = await requestChatMessageWritePermission();
      applyEnvironment(result);

      if (result.environment.isShareTargetPickerAvailable) {
        setShareFeedback("授權完成，現在可以使用分享功能。");
      } else {
        setShareFeedback("授權後仍無法使用分享功能，請直接分享下方店家連結。");
      }
    } finally {
      setIsReauthorizing(false);
    }
  }, [applyEnvironment]);

  const handleShare = useCallback(async () => {
    trackEvent("share_click", store.code);
    setShareFeedback(null);

    setIsSharing(true);

    try {
      const refreshed = await refreshShareEnvironment();
      applyEnvironment(refreshed);

      if (refreshed.redirecting) {
        setShareFeedback("正在導向 LINE 登入，請完成登入後再試。");
        return;
      }

      const { environment: latestEnv } = refreshed;

      if (latestEnv.initError) {
        setShareFeedback("分享功能暫時無法使用，請直接分享下方店家連結。");
        return;
      }

      if (!latestEnv.isInLine) {
        setShareFeedback("請在 LINE App 內開啟此頁面以使用分享功能。");
        return;
      }

      if (!latestEnv.isLoggedIn) {
        setShareFeedback("請先完成 LINE 登入。");
        return;
      }

      if (!latestEnv.isShareTargetPickerAvailable) {
        setShareFeedback(
          "Share Target Picker 目前不可用，請直接分享下方店家連結。"
        );
        return;
      }

      const result = await shareStoreViaTargetPicker(store);

      if (result.success) {
        setShareFeedback("已開啟分享選擇器，請選擇要分享的好友或群組。");
      } else if (result.cancelled) {
        setShareFeedback("已取消分享。");
      } else {
        setShareFeedback(result.error ?? "分享失敗，請稍後再試。");
      }
    } finally {
      setIsSharing(false);
    }
  }, [applyEnvironment, store]);

  const showShareAgain =
    autoShareEnabled && autoShareOutcome === "success";

  return (
    <main className="page">
      <article className="card">
        {autoShareEnabled && (
          <div className="autoshare-badge">autoShare 驗證版</div>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="card-image"
          src={imageUrl}
          alt={`${store.name} 分享圖`}
        />

        <div className="card-body">
          <h1 className="store-name">{store.name}</h1>
          <p className="share-text">{store.shareText}</p>
          <a
            className="store-link"
            href={store.storeLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {store.storeLink}
          </a>
        </div>

        <FallbackNotice
          status={status}
          store={store}
          environment={environment}
          onReauthorize={handleReauthorize}
          isReauthorizing={isReauthorizing}
        />

        {status !== "loading" && (
          <AutoShareVerificationPanel
            diagnostics={autoShareDiagnostics}
            outcome={autoShareOutcome}
          />
        )}

        {status === "loading" && (
          <div className="loading">
            {autoShareEnabled
              ? "正在載入 LINE 功能（autoShare 驗證版）…"
              : "正在載入 LINE 功能…"}
          </div>
        )}

        <div className="actions">
          {showShareAgain ? (
            <>
              <p
                className="alert alert-info"
                style={{ marginBottom: 12 }}
                role="status"
              >
                已完成分享操作。
              </p>
              <button
                type="button"
                className="btn-share"
                onClick={handleShare}
                disabled={isSharing || isReauthorizing}
                aria-busy={isSharing}
              >
                {isSharing ? "分享中…" : "再分享一次"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-share"
              onClick={handleShare}
              disabled={status === "loading" || isSharing || isReauthorizing}
              aria-busy={isSharing}
            >
              {isSharing ? "分享中…" : "分享給 LINE 好友"}
            </button>
          )}

          {shareFeedback && !showShareAgain && (
            <p
              className="alert alert-info"
              style={{ marginTop: 12, marginBottom: 0 }}
              role="status"
            >
              {shareFeedback}
            </p>
          )}
        </div>
      </article>

      <p className="footer-note">
        LINE 推薦好友工具 MVP v1
        {autoShareEnabled ? " · autoShare 驗證版" : ""}
      </p>
    </main>
  );
}
