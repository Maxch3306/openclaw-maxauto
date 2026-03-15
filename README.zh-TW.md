# MaxAuto

一款無廠商綁定的開源桌面應用程式，封裝了 [OpenClaw](https://github.com/openclaw/openclaw)。無需登入、無需點數、無廠商鎖定 — 只需雙擊安裝程式，即可自動管理 OpenClaw 的安裝並提供精美的圖形介面。

歡迎加入我們的 Discord 社群：https://discord.gg/QfS4Sa8h

## 安裝

從 [Releases](https://github.com/Maxch3306/openclaw-maxauto/releases) 頁面下載最新的安裝程式：

| 平台 | 檔案 |
|------|------|
| Windows | `MaxAuto_x.x.x_x64-setup.exe` 或 `.msi` |
| macOS   | `MaxAuto_x.x.x_universal.dmg` |

### Windows

1. 從 Releases 下載 `.exe` 或 `.msi` 安裝程式。
2. 執行安裝程式。由於應用程式尚未進行程式碼簽署，Windows SmartScreen 可能會顯示 **「Windows 已保護您的電腦」** 警告。
   - 點擊 **「其他資訊」**
   - 然後點擊 **「仍要執行」**
3. 依照提示完成安裝。

### macOS

1. 從 Releases 下載 `.dmg` 檔案。
2. 開啟 `.dmg`，將 MaxAuto 拖曳至「應用程式」資料夾。
3. 首次啟動時，macOS Gatekeeper 會因為應用程式來自未識別的開發者而封鎖。
   - 前往 **系統設定 → 隱私權與安全性**
   - 向下捲動至 **安全性** 區段 — 您會看到類似 *「MaxAuto 因為不是來自已識別的開發者，所以已被阻擋」* 的訊息
   - 點擊 **「強制打開」** 並確認
   - 或者，您可以在 Finder 中對應用程式按右鍵（或 Control + 點擊），選擇 **「打開」**，然後在對話框中點擊 **「打開」**

> MaxAuto 會在首次啟動時自動處理其餘事項 — 包括自動將 Node.js 和 OpenClaw 安裝至 `~/.openclaw-maxauto/`。

## 功能特色

1. **首次執行設定** — 自動將 Node.js 22 和 OpenClaw 安裝至 `~/.openclaw-maxauto/`（完全隔離，不與全域安裝衝突）
2. **啟動 OpenClaw 閘道** — 自動管理背景程序
3. **與 AI 助理對話** — 使用任何支援的模型提供商，建立、設定並與 AI 助理對話
4. **模型提供商** — 自備 API 金鑰，支援 OpenAI、Anthropic、DeepSeek、Moonshot、MiniMax、百鍊等
5. **自動更新** — 應用程式會自動檢查更新，一鍵即可安裝

## 從原始碼建置

前置需求：[Node.js 22+](https://nodejs.org/)、[pnpm](https://pnpm.io/)、[Rust](https://rustup.rs/)

```bash
# 安裝依賴套件
pnpm install

# 以開發模式執行
pnpm tauri dev

# 建置正式版安裝程式
pnpm tauri build
```

## 技術架構

- **前端：** React 19、TypeScript、Tailwind CSS、Zustand
- **後端：** Tauri v2（Rust）
- **執行環境：** 透過 WebSocket 連接 OpenClaw（`ws://127.0.0.1:51789`）

## 授權條款

MIT
