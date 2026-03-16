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

## 安裝模式

MaxAuto 在首次啟動時提供兩種安裝模式：

### 原生模式（預設）

直接在您的電腦上安裝 Node.js 和 OpenClaw，存放於 `~/.openclaw-maxauto/`。需要先安裝 Git。

- **macOS：** Git 包含在 Xcode 命令列工具中。如果尚未安裝，MaxAuto 會自動觸發安裝對話框。
- **Windows：** 如果未偵測到 Git，MaxAuto 會自動下載並啟動 Git for Windows 安裝程式 — 依照精靈指示完成安裝即可。

### Docker 模式（沙箱隔離）

在 Docker 容器中執行 OpenClaw，實現完全隔離。OpenClaw 及其依賴項不會安裝在您的主機上 — 僅共享設定檔和工作區資料夾。

**前置需求：** 選擇此模式前，請先安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。

| 平台 | Docker Desktop 下載 |
|------|---------------------|
| macOS   | [Mac 版下載](https://docs.docker.com/desktop/setup/install/mac-install/) |
| Windows | [Windows 版下載](https://docs.docker.com/desktop/setup/install/windows-install/) |

**設定步驟：**

1. 安裝並啟動 Docker Desktop。
2. 啟動 MaxAuto — 在設定畫面選擇 **Docker** 模式。
3. MaxAuto 會自動拉取 `openclaw/openclaw` 映像檔並啟動容器。
4. 閘道在 `maxauto-openclaw` 容器內執行，映射至 `localhost:51789`。

**注意事項：**
- 使用 Docker 模式時，Docker Desktop 必須保持執行中。
- 所有資料儲存於 `~/.openclaw-maxauto/config` 和 `~/.openclaw-maxauto/workspace`，並掛載至容器中。
- 容器僅監聽 `127.0.0.1` — 網路上的其他裝置無法存取。
- 您可以在 **設定 → 一般 → 安裝模式** 中切換原生模式和 Docker 模式。

## 功能特色

1. **首次執行設定** — 選擇原生模式或 Docker 模式，MaxAuto 自動處理其餘事項
2. **啟動 OpenClaw 閘道** — 自動管理背景程序（或 Docker 容器）
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
