import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <h1>找不到此分享頁</h1>
      <p>請確認連結是否正確，或聯繫店家取得最新分享連結。</p>
      <Link href="/">返回首頁</Link>
    </main>
  );
}
