# 米游社 / 米家云游戏 签到脚本（Node.js）

这是一个支持多账号的米游社、云原神、云崩铁自动签到脚本（Node.js）。支持通过 GitHub Actions 定时运行，并可将签到结果通过邮件推送。

简洁说明：将你的米游社 Cookie 和/或云游戏 Token 配置为仓库 Secrets，工作流会按计划运行并发送邮件（可选）。

---

## 功能

- 米游社签到（使用米游社 Cookie）
  - 原神
  - 崩坏：星穹铁道
  - 绝区零

- 云游戏签到 / 领取免费时长（使用云游戏 Token）
  - 云原神（GENSHIN_TOKENS）
  - 云崩铁（STARRAIL_TOKENS）

- 支持多个账号（换行或英文逗号分隔）
- 支持 GitHub Actions 定时运行
- 支持执行完成后通过 SMTP 邮件推送 HTML 签到结果
- 会自动跳过未配置的功能项（不会报错或计为失败）

---

## 免责声明

本项目仅供学习、交流和测试使用。作者不对因使用本项目产生的任何问题承担责任。请在遵守相关服务条款与法规的前提下低调使用，若不同意请停止使用。

---

## 项目结构

```text
MYS_Game_Signin/
├─ .github/
│  └─ workflows/
│     └─ run.yml
│
├─ scripts/
│  └─ summary/
│     ├─ config.js
│     ├─ index.js
│     ├─ parser.js
│     └─ renderer.js
│
├─ src/
│  ├─ MYS/
│  │  ├─ actId.js
│  │  ├─ actIdInvalid.js
│  │  └─ index.js
│  │
│  ├─ MihoyoCloud/
│  │  └─ index.js
│  │
│  └─ utils/
│     ├─ error.js
│     ├─ index.js
│     ├─ mask.js
│     ├─ parser.js
│     ├─ passport.js
│     └─ sleep.js
│
├─ main.js
├─ package.json
├─ package-lock.json
├─ .gitignore
└─ README.md
```

---

## 环境要求

- Node.js 22 或更高版本
- npm
- 可选：GitHub Actions（用于定时运行）
- 可选：SMTP 邮箱（用于邮件推送）

---

## 必填 / 常用 GitHub Secrets

至少需要根据你要运行的功能配置对应的 Secrets：

| Secret 名称 | 说明 | 是否必填 |
|---|---|---|
| `MYS_COOKIES` | 米游社 Cookie（用于米游社签到） | 米游社签到必填 |
| `GENSHIN_TOKENS` | 云原神 Token（仅用于云原神） | 云原神签到必填 |
| `STARRAIL_TOKENS` | 云崩铁 Token（仅用于云崩铁） | 云崩铁签到必填 |
| `MAIL_TO` | 收件邮箱（多个用逗号隔开） | 邮件推送必填 |
| `SMTP_SERVER` | SMTP 服务器地址 | 邮件推送必填 |
| `SMTP_PORT` | SMTP 端口（通常 465 或 587） | 邮件推送必填 |
| `SMTP_USERNAME` | SMTP 用户名 / 发件邮箱 | 邮件推送必填 |
| `SMTP_PASSWORD` | SMTP 授权码 / 应用专用密码 | 邮件推送必填 |

可选：

| Secret 名称 | 说明 |
|---|---|
| `MYS_DEVICE_ID` | 米游社固定设备 ID（建议固定） |
| `MIHOYO_DEVICE_ID` | 云游戏固定设备 ID |
| `MIHOYO_CLOUD_DEVICE_ID` | 云游戏备用设备 ID |

不填写时脚本会生成临时设备 ID，但建议填写以避免设备 ID 频繁变化导致异常。

---

## 多账号填写格式

多个 Cookie/Token 支持以下两种方式：换行分隔或英文逗号分隔。

示例（换行）：

```
Cookie1
Cookie2
Cookie3
```

示例（逗号）：

```
Cookie1,Cookie2,Cookie3
```

---

## 如何获取米游社 Cookie（米游社签到必需）

1. 在浏览器打开米游社相关页面（建议使用无痕/隐身模式）。
2. 登录米游社（原神或崩铁或绝区零论坛均可）。
3. 打开开发者工具（按 F12），切换到 Console，粘贴并执行以下脚本：

```js
const cookie = document.cookie
const ask = confirm('Cookie:' + cookie + '\n\nDo you want to copy the cookie to the clipboard?')
if (ask == true) {
  copy(cookie)
  msg = cookie
} else {
  msg = 'Cancel'
}
```

4. 将复制的 Cookie 值填入仓库 Secrets：

Name: MYS_COOKIES
Value: 复制得到的 Cookie

---

## 如何获取云游戏 Token（云游戏签到必需）

1. 在浏览器打开云原神或云崩铁页面（建议使用无痕/隐身模式）。
2. 登录并打开开发者工具（F12），切换到 Network -> XHR。
3. 找到请求 headers 中包含 `x-rpc-combo_token` 的请求，复制其值。
4. 将对应 Token 填入 Secrets：

- GENSHIN_TOKENS：云原神的 x-rpc-combo_token
- STARRAIL_TOKENS：云崩铁的 x-rpc-combo_token

注意：原神与崩铁的 Token 互不通用，请分别获取。

---

## GitHub Actions 配置与调度

工作流文件：`.github/workflows/run.yml`

默认触发配置：

```yaml
on:
  schedule:
    - cron: '0 20 * * *'
  workflow_dispatch:
```

说明：上述 cron 为 UTC 时间（UTC 20:00 = 北京时间次日 04:00）。你可以根据需要调整 cron 表达式或手动在 Actions 页面触发。

---

## 本地运行

1. Clone 仓库：

```sh
git clone https://github.com/moon02222/MYS_Game_Signin.git
cd MYS_Game_Signin
```

2. 安装依赖：

```sh
npm ci --ignore-scripts
```

3. 设置环境变量（示例）：

Linux / macOS：

```sh
export MYS_COOKIES="你的Cookie"
export GENSHIN_TOKENS="你的云原神Token"
export STARRAIL_TOKENS="你的云崩铁Token"
```

Windows PowerShell：

```powershell
$env:MYS_COOKIES="你的Cookie"
$env:GENSHIN_TOKENS="你的云原神Token"
$env:STARRAIL_TOKENS="你的云崩铁Token"
```

4. 运行脚本：

```sh
npm start
# 或
node main.js
```

---

## 邮件推送配置示例

必须同时填写以下 Secrets 才会发送邮件：

```
MAIL_TO
SMTP_SERVER
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
```

常见 SMTP 配置示例：

QQ 邮箱：
```
SMTP_SERVER=smtp.qq.com
SMTP_PORT=465
SMTP_USERNAME=你的QQ邮箱
SMTP_PASSWORD=QQ邮箱授权码
```

163 邮箱：
```
SMTP_SERVER=smtp.163.com
SMTP_PORT=465
SMTP_USERNAME=你的163邮箱
SMTP_PASSWORD=163邮箱授权码
```

Gmail：
```
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=你的Gmail
SMTP_PASSWORD=Google应用专用密码
```

Outlook / Office365：
```
SMTP_SERVER=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=你的Outlook邮箱
SMTP_PASSWORD=邮箱应用密码
```

建议使用应用专用密码或授权码，避免使用邮箱登录密码。

---

## 日志与安全

运行后会生成：

```
output.log
summary.html
summary-title.txt
```

这些文件已加入 `.gitignore`，请勿提交或公开。

日志通常不会输出敏感信息（如完整 Cookie/Token/SMTP 密码），但可能包含：签到结果、接口返回码、昵称、打码后的 UID 等。请勿将日志或摘要公开。

公共仓库安全建议：

- 不要在代码中写入 Cookie/Token/密码
- 不要提交 `.env`、`output.log`、`summary.html`、`summary-title.txt`
- 避免在 Actions 输出完整 headers 或错误信息包含 Secrets
- 不要使用 `pull_request_target` 触发含 Secrets 的工作流

---

## 常见问题（FAQ）

Q1. 未配置云游戏 Token 会报错吗？

A1. 不会。未配置对应 Token 会自动跳过，脚本继续执行其它任务，不计为失败。

Q2. 未配置邮箱会怎样？

A2. 脚本仍会运行，但不会发送邮件。

Q3. GitHub Actions 安装依赖失败怎么办？

A3. 请确保仓库中存在 `package-lock.json`，并且 workflow 中的安装命令与锁文件匹配（例如使用 `npm ci --ignore-scripts` 时必须提交 `package-lock.json`）。

Q4. 为什么邮件没有云游戏结果？

A4. 请确认已配置对应的 `GENSHIN_TOKENS` 或 `STARRAIL_TOKENS`。

Q5. 公共仓库会泄露 Secrets 吗？

A5. GitHub Secrets 不会直接暴露，但 Actions 日志可能会公开，切勿在日志中打印 Secrets。

---

## 贡献与许可

欢迎反馈 issue，欢迎提交 PR。请确保不要在 PR 中包含任何 Secrets。

---
