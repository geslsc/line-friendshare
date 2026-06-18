"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getAbsoluteAssetUrl } from "@/config/env";
import { trackEvent } from "@/lib/analytics/tracker";
import {
  forceTestShareTargetPicker,
  initLiff,
  refreshShareEnvironment,
  requestChatMessageWritePermission,
  shareStoreViaTargetPicker,
  type ForceTestShareTargetPickerResult,
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

function DiagnosticPanel({
  environment,
  onForceTest,
  isForceTesting,
  forceTestResult,
}: {
  environment: ShareEnvironment;
  onForceTest: () => void;
  isForceTesting: boolean;
  forceTestResult: ForceTestShareTargetPickerResult | null;
}) {
  if (environment.diagnostics.length === 0) {
    return null;
  }

  return (
    <details className="diagnostics" style={{ margin: "12px 20px 0" }} open>
      <summary>環境診斷（{environment.diagnostics.length} 項）</summary>
      <ul className="diagnostics-list">
        {environment.diagnostics.map((item) => (
          <li key={item.step} data-ok={item.ok}>
            <strong>{item.step}</strong>：{item.message}
          </li>
        ))}
      </ul>
      {(environment.lineVersion || environment.liffVersion || environment.os) && (
        <p className="diagnostics-meta">
          {environment.lineVersion && `LINE ${environment.lineVersion}`}
          {environment.liffVersion && ` · LIFF SDK ${environment.liffVersion}`}
          {environment.os && ` · ${environment.os}`}
        </p>
      )}

      <div className="debug-actions">
        <button
          type="button"
          className="btn-debug"
          onClick={onForceTest}
          disabled={isForceTesting}
        >
          {isForceTesting ? "測試中…" : "強制測試 shareTargetPicker"}
        </button>
        <p className="debug-note">
          Debug only：略過 isApiAvailable，直接呼叫 liff.shareTargetPicker()
        </p>
      </div>

      {forceTestResult && (
        <div className="debug-result" role="status">
          <p>
            <strong>isApiAvailable（呼叫前）：</strong>
            {String(forceTestResult.isApiAvailableBeforeCall)}
          </p>
          {forceTestResult.success && (
            <p className="debug-success">shareTargetPicker 呼叫成功</p>
          )}
          {forceTestResult.cancelled && (
            <p>使用者取消分享選擇器</p>
          )}
          {forceTestResult.errorDetails && (
            <div className="debug-error-block">
              <p>
                <strong>error.name：</strong>
                {forceTestResult.errorDetails.name}
              </p>
              <p>
                <strong>error.code：</strong>
                {forceTestResult.errorDetails.code}
              </p>
              <p>
                <strong>error.message：</strong>
                {forceTestResult.errorDetails.message}
              </p>
              <p>
                <strong>JSON.stringify(error)：</strong>
              </p>
              <pre>{forceTestResult.errorDetails.raw}</pre>
            </div>
          )}
        </div>
      )}
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

  const blockReason = environment?.shareBlockReason;
  const initError = environment?.initError;

  if (status === "login_redirect") {
    return (
      <div className="alert alert-info" role="alert">
        <strong>正在導向 LINE 登入</strong>
        <p style={{ margin: "8px 0 0" }}>
          {blockReason ??
            "完成登入後會回到此頁，屆時再檢查 Share Target Picker 是否可用。"}
        </p>
      </div>
    );
  }

  if (status === "init_error") {
    return (
      <div className="alert alert-error" role="alert">
        <strong>LIFF 初始化失敗</strong>
        <p style={{ margin: "8px 0 0" }}>
          {initError ?? "無法載入 LINE 功能，您仍可使用下方店家連結。"}
        </p>
        {blockReason && <p style={{ margin: "8px 0 0" }}>{blockReason}</p>}
      </div>
    );
  }

  if (status === "not_in_line") {
    return (
      <div className="alert alert-warning" role="alert">
        <strong>請在 LINE 內開啟此頁面以使用分享功能</strong>
        <p style={{ margin: "8px 0 0" }}>
          {blockReason ??
            "分享按鈕需在 LINE App 的 LIFF 環境中才能使用。您可先透過下方連結前往店家。"}
        </p>
      </div>
    );
  }

  if (status === "share_unavailable") {
    return (
      <div className="alert alert-warning" role="alert">
        <strong>Share Target Picker 目前不可用</strong>
        <p style={{ margin: "8px 0 0" }}>
          {blockReason ??
            "請確認 LINE Developers Console 已啟用 shareTargetPicker 並同意相關條款。"}
        </p>
        {environment?.needsReauthorize && (
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={onReauthorize}
            disabled={isReauthorizing}
          >
            {isReauthorizing ? "授權中…" : "重新授權 chat_message.write"}
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
  const [isForceTesting, setIsForceTesting] = useState(false);
  const [forceTestResult, setForceTestResult] =
    useState<ForceTestShareTargetPickerResult | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

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
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [store.code, applyEnvironment]);

  const handleReauthorize = useCallback(async () => {
    setIsReauthorizing(true);
    setShareFeedback(null);

    try {
      const result = await requestChatMessageWritePermission();
      applyEnvironment(result);

      if (result.environment.isShareTargetPickerAvailable) {
        setShareFeedback("授權完成，現在可以使用分享功能。");
      } else {
        setShareFeedback(
          result.environment.shareBlockReason ?? "授權後仍無法使用分享功能。"
        );
      }
    } finally {
      setIsReauthorizing(false);
    }
  }, [applyEnvironment]);

  const handleForceTest = useCallback(async () => {
    setIsForceTesting(true);
    setForceTestResult(null);

    try {
      const result = await forceTestShareTargetPicker();
      setForceTestResult(result);
    } catch (error) {
      setForceTestResult({
        success: false,
        isApiAvailableBeforeCall: false,
        errorDetails: {
          name: error instanceof Error ? error.name : "Unknown",
          code: "(none)",
          message: error instanceof Error ? error.message : String(error),
          raw: (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })(),
        },
      });
    } finally {
      setIsForceTesting(false);
    }
  }, []);

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
        setShareFeedback(
          latestEnv.shareBlockReason ??
            "LIFF 尚未正確初始化，無法分享。"
        );
        return;
      }

      if (!latestEnv.isInLine) {
        setShareFeedback(
          latestEnv.shareBlockReason ??
            "請在 LINE App 內開啟此頁面以使用分享功能。"
        );
        return;
      }

      if (!latestEnv.isLoggedIn) {
        setShareFeedback(
          latestEnv.shareBlockReason ?? "請先完成 LINE 登入。"
        );
        return;
      }

      if (!latestEnv.isShareTargetPickerAvailable) {
        setShareFeedback(
          latestEnv.shareBlockReason ??
            "Share Target Picker 在此環境不可用。"
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

  return (
    <main className="page">
      <article className="card">
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

        {environment && status !== "loading" && (
          <DiagnosticPanel
            environment={environment}
            onForceTest={handleForceTest}
            isForceTesting={isForceTesting}
            forceTestResult={forceTestResult}
          />
        )}

        {status === "loading" && (
          <div className="loading">正在載入 LINE 功能…</div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn-share"
            onClick={handleShare}
            disabled={status === "loading" || isSharing || isReauthorizing}
            aria-busy={isSharing}
          >
            {isSharing ? "分享中…" : "分享給 LINE 好友"}
          </button>

          {shareFeedback && (
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

      <p className="footer-note">LINE 推薦好友工具 MVP v1</p>
    </main>
  );
}
