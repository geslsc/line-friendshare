import Link from "next/link";

import { getAllStorePaths, getStoreByCode } from "@/config/stores";

export default function HomePage() {
  const demoStore = getStoreByCode("k8m3n7x2");
  const demoPath = getAllStorePaths()[0];

  return (
    <main className="home">
      <h1>LINE 推薦好友工具</h1>
      <p>MVP v1 — 單一 LIFF、多店共用分享頁</p>

      <h2>Demo 店家</h2>
      <ul>
        <li>店名：{demoStore?.name}</li>
        <li>分享頁路徑：/{demoPath}</li>
      </ul>

      {demoPath && (
        <Link className="demo-link" href={`/${demoPath}`}>
          前往 Demo 分享頁
        </Link>
      )}

      <p className="footer-note">
        正式使用請透過 LINE LIFF URL 開啟分享頁，以啟用 Share Target Picker。
      </p>
    </main>
  );
}
