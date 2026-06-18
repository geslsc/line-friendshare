"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getAbsoluteAssetUrl } from "@/config/env";
import { trackEvent } from "@/lib/analytics/tracker";
import { initLiff, shareStoreViaTargetPicker } from "@/lib/liff/share";
import type { ShareEnvironment, SharePageStatus, StoreConfig } from "@/types/store";

interface SharePageProps {
  store: StoreConfig;
}

function resolveStatus(environment: ShareEnvironment): SharePageStatus {
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

function FallbackNotice({
  status,
  store,
  initError,
}: {
  status: SharePageStatus;
  store: StoreConfig;
  initError: string | null;
}) {
  if (status === "ready" || status === "loading") {
    return null;
  }

  if (status === "init_error") {
    return (
      <div className="alert alert-error" role="alert">
        <strong>LIFF 初始化失敗</strong>
        <p style={{ margin: "8px 0 0" }}>
          {initError ?? "無法載入 LINE 功能，您仍可使用下方店家連結。"}
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
          請確認 LINE Developers Console 已啟用 shareTargetPicker
          並同意相關條款，或直接分享下方店家連結給好友。
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
  const [initError, setInitError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<ShareEnvironment | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const imageUrl = useMemo(
    () => getAbsoluteAssetUrl(store.shareImage),
    [store.shareImage]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      trackEvent("page_view", store.code);

      const result = await initLiff();
      if (cancelled) {
        return;
      }

      setEnvironment(result.environment);
      setInitError(result.environment.initError);
      setStatus(resolveStatus(result.environment));
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [store.code]);

  const handleShare = useCallback(async () => {
    trackEvent("share_click", store.code);
    setShareFeedback(null);

    if (!environment) {
      setShareFeedback("環境尚未就緒，請稍後再試。");
      return;
    }

    if (environment.initError) {
      setShareFeedback("LIFF 尚未正確初始化，無法分享。");
      return;
    }

    if (!environment.isInLine) {
      setShareFeedback("請在 LINE App 內開啟此頁面以使用分享功能。");
      return;
    }

    if (!environment.isShareTargetPickerAvailable) {
      setShareFeedback("Share Target Picker 在此環境不可用。");
      return;
    }

    setIsSharing(true);

    try {
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
  }, [environment, store]);

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
          initError={initError}
        />

        {status === "loading" && (
          <div className="loading">正在載入 LINE 功能…</div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn-share"
            onClick={handleShare}
            disabled={status === "loading" || isSharing}
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
