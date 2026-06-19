# LINE 推薦好友工具 MVP v1

單一 LIFF App、多店共用的 LINE 好友推薦分享頁。v1 使用靜態店家設定檔，無後端 API、無資料庫。

## 功能

- 分享頁路徑：`/store-{不易猜測代號}`
- Demo 店家：測試美學館（`/store-k8m3n7x2`）
- LINE LIFF 初始化與環境檢查
- Share Target Picker 分享（含降級邏輯）
- 最小埋點：頁面開啟數、分享按鈕點擊數

## 本地開發

```bash
npm install
cp .env.example .env.local
# 編輯 .env.local 填入 NEXT_PUBLIC_LIFF_ID、NEXT_PUBLIC_PUBLIC_BASE_URL
npm run dev
```

開啟 http://localhost:3000

- 首頁：http://localhost:3000
- Demo 分享頁：http://localhost:3000/store-k8m3n7x2

## 環境變數

| 變數 | 說明 | 必填 |
|------|------|------|
| `NEXT_PUBLIC_LIFF_ID` | LINE Developers Console 的 LIFF App ID | 是（正式分享需設定） |
| `NEXT_PUBLIC_PUBLIC_BASE_URL` | 部署後 HTTPS 網域，不含結尾 `/` | 建議（分享圖需絕對 URL） |

> 網域與 LIFF URL **不可寫死**於程式碼，一律透過環境變數管理。

## 部署說明

### Vercel（建議）

1. 將專案 push 至 GitHub
2. 在 [Vercel](https://vercel.com) 匯入專案
3. 設定 Environment Variables：
   - `NEXT_PUBLIC_LIFF_ID`（可先留空，取得 LIFF 後再填）
   - `NEXT_PUBLIC_PUBLIC_BASE_URL` = 部署後的 URL，例如 `https://your-project.vercel.app`
4. 部署完成後取得固定 HTTPS 網址
5. **請固定 production 網址**，避免重新命名導致 LIFF Endpoint 失效

### Railway

1. 在 [Railway](https://railway.app) 建立 Node.js 專案
2. Build Command: `npm run build`
3. Start Command: `npm start`
4. 設定同上環境變數
5. 取得 Railway 提供的 HTTPS 網址

## LINE Console 設定提醒

> **請依以下順序操作**

1. **先部署分享頁**，取得 HTTPS 網址（例如 `https://your-project.vercel.app`）
2. 前往 [LINE Developers Console](https://developers.line.biz/console/)
3. 選擇 Messaging API Channel，建立或編輯 **LIFF App**
4. 將部署後的 HTTPS 網址填入 **LIFF Endpoint**  
   - Endpoint 需指向分享頁，例如：`https://your-project.vercel.app/store-k8m3n7x2`
   - 或設為根路徑，由 LIFF URL 帶 query 導向（v1 建議直接填分享頁完整 URL）
5. **啟用 `shareTargetPicker`**（Scope / Bot feature）
6. **同意 Share Target Picker 相關條款**
7. 複製 **LIFF ID**，填入 `NEXT_PUBLIC_LIFF_ID` 並重新部署
8. 取得正式 **LIFF URL**（格式：`https://liff.line.me/{LIFF_ID}`）
9. 在 LINE App 內用正式 LIFF URL 測試完整分享流程
10. **部署後固定 production 網址**，不要任意改名

### LIFF Endpoint 與分享頁對應

| 項目 | 值 |
|------|-----|
| Demo 分享頁 path | `/store-k8m3n7x2` |
| 完整 Endpoint 範例 | `https://your-project.vercel.app/store-k8m3n7x2` |

## 店家設定

編輯 `src/config/stores.ts` 新增或修改店家。欄位：

- `code` — 不易猜測代號
- `name` — 店名／內部識別名稱
- `targetUrl` — 分享目標網址
- `shareButtonLabel` — 分享卡片／頁面 CTA 按鈕文案
- `sharerPageTitle` — 分享者頁面標題
- `sharerPageDescription` — 分享者頁面說明
- `sharerPageNote` — 分享者頁面補充（可選）
- `shareTitle` — 被分享者卡片標題
- `shareDescription` — 被分享者卡片文案
- `shareImage` — 分享圖（`/public` 內路徑或 HTTPS URL）

## 埋點方案（v1）

v1 使用 **localStorage + sessionStorage** 在前端記錄事件：

- `page_view` — 分享頁開啟
- `share_click` — 分享按鈕點擊

查看方式：瀏覽器 DevTools → Application → Local Storage → `line-friendshare-analytics`

### 限制

- 僅記錄**同一瀏覽器／裝置**，無法匯總全站數據
- 清除瀏覽資料後事件會消失
- 無法做後台報表

### v2 升級建議

- 新增後端 API 接收事件並寫入 DB
- 或整合 GA4、Plausible、Vercel Analytics 等第三方服務
- 參考 `src/lib/analytics/backends/types.ts` 介面擴充

## v2 保留擴充（尚未實作）

- 推薦碼、獎勵機制
- 多店正式資料、店家後台
- 資料庫、後端 API
- 埋點升級、正式網域替換

## 專案結構

```
src/
├── app/                    # Next.js 頁面路由
│   ├── [storePath]/        # /store-{code} 分享頁
│   └── page.tsx            # 首頁
├── components/             # UI 元件
├── config/
│   ├── env.ts              # 環境變數
│   └── stores.ts           # 靜態店家設定
├── lib/
│   ├── analytics/          # 埋點
│   └── liff/               # LIFF 分享邏輯
└── types/                  # 型別定義
```

## 授權

Private — MVP 內部使用
