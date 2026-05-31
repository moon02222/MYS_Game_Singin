# 米游社、米家云游戏签到脚本 Node.js 版

支持多账号的米游社、云原神、云崩铁自动签到脚本，并支持通过 GitHub Actions 定时运行和邮箱推送签到结果。

---

## 简介

本项目是一个用于自动签到以下服务的 Node.js 脚本：

- 米游社原神签到
- 米游社崩坏：星穹铁道签到
- 米游社绝区零签到
- 云原神签到 / 领取奖励
- 云崩铁签到 / 领取奖励
- 邮箱推送签到结果

支持多账号，可以本地运行，也可以通过 GitHub Actions 自动定时运行。

---

## 功能特性

- **米游社签到**
  - 支持原神
  - 支持崩坏：星穹铁道
  - 米游社绝区零

- **云游戏签到**
  - 支持云原神
  - 支持云崩铁

- **GitHub Actions 自动运行**
  - 支持每天定时执行
  - 支持手动触发执行

- **邮箱推送**
  - 执行完成后自动推送 HTML 格式签到结果
  - 支持 SMTP 邮箱发送
  - 支持失败时也发送邮件

- **安全性优化**
  - 使用 GitHub Secrets 保存 Cookie、Token 和邮箱授权码
  - 日志中尽量避免输出敏感信息
  - 对 Cookie、Token、Authorization 等内容做脱敏处理
  - GitHub Actions 使用最小权限 `contents: read`
  - 默认不上传 `output.log`
  - 默认不把原始日志写入邮件正文

- **自动跳过未配置功能**
  - 未配置云原神 Token 时，自动跳过云原神
  - 未配置云崩铁 Token 时，自动跳过云崩铁
  - 未配置米游社 Cookie 时，自动跳过米游社签到
  - 未配置邮箱时，不发送邮件

---

## 免责声明

本脚本仅供交流测试使用。  
因使用本脚本而产生的任何问题，作者概不负责。

官方可能更改接口导致脚本失效，脚本失效会尽快更新，但不保证第一时间。  
请低调使用，如不同意，请关闭并停止使用。

---

## 项目结构

```text
MYS_Game_Singin/
├─ .github/
│  └─ workflows/
│     └─ run.yml
├─ scripts/
│  └─ generate-summary.js
├─ src/
│  ├─ MYS/
│  │  └─ index.js
│  └─ MihoyoCloud/
│     └─ index.js
├─ main.js
├─ package.json
├─ package-lock.json
├─ .gitignore
└─ README.md
```

---

## 环境要求

### GitHub Actions 运行

- GitHub 仓库
- GitHub Actions
- GitHub Secrets
- Node.js 22

### 本地运行

- Node.js 22 或更高版本
- npm

---

## GitHub Secrets 配置

进入你的仓库：

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

添加以下 Secrets。

---

## 必填或常用 Secrets

| Secret 名称 | 说明 | 是否必填 |
|---|---|---|
| `MYS_COOKIES` | 米游社 Cookie，用于原神 / 星铁米游社签到 | 米游社签到必填 |
| `GENSHIN_TOKENS` | 云原神 Token | 云原神签到必填 |
| `STARRAIL_TOKENS` | 云崩铁 Token | 云崩铁签到必填 |
| `MAIL_TO` | 收件邮箱 | 邮件推送必填 |
| `SMTP_SERVER` | SMTP 服务器地址 | 邮件推送必填 |
| `SMTP_PORT` | SMTP 端口 | 邮件推送必填 |
| `SMTP_USERNAME` | SMTP 用户名 / 发件邮箱 | 邮件推送必填 |
| `SMTP_PASSWORD` | SMTP 授权码 / 应用专用密码 | 邮件推送必填 |

---

## 可选 Secrets

| Secret 名称 | 说明 |
|---|---|
| `MYS_DEVICE_ID` | 米游社固定设备 ID |
| `MIHOYO_DEVICE_ID` | 云游戏固定设备 ID |
| `MIHOYO_CLOUD_DEVICE_ID` | 云游戏备用设备 ID |

这些设备 ID 不是必填项。  
如果不填写，脚本会自动生成临时设备 ID。

不过更推荐固定填写，避免每次运行设备 ID 都变化。

---

## 未配置 Token 时的行为

如果没有配置云游戏 Token，脚本会自动跳过对应功能。

| 配置情况 | 执行结果 |
|---|---|
| 未配置 `GENSHIN_TOKENS` | 跳过云原神 |
| 未配置 `STARRAIL_TOKENS` | 跳过云崩铁 |
| 两个都未配置 | 跳过全部云游戏签到 |
| 只配置 `GENSHIN_TOKENS` | 只执行云原神 |
| 只配置 `STARRAIL_TOKENS` | 只执行云崩铁 |

未配置云游戏 Token 时：

- 不会报错
- 不会算失败
- 邮件中不会显示对应云游戏区域

---

## 邮箱推送说明

本项目支持执行完成后通过邮件推送签到结果。

邮件内容包括：

- 执行时间
- 米游社签到结果
- 云游戏签到结果，如果配置了对应 Token
- 成功 / 失败 / 跳过状态

如果邮箱配置不完整，则不会发送邮件。

需要配置：

```text
MAIL_TO
SMTP_SERVER
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
```

---

## 常见 SMTP 配置

### QQ 邮箱

```text
SMTP_SERVER=smtp.qq.com
SMTP_PORT=465
SMTP_USERNAME=你的QQ邮箱
SMTP_PASSWORD=QQ邮箱授权码
```

### 163 邮箱

```text
SMTP_SERVER=smtp.163.com
SMTP_PORT=465
SMTP_USERNAME=你的163邮箱
SMTP_PASSWORD=163邮箱授权码
```

### Gmail

```text
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=你的Gmail邮箱
SMTP_PASSWORD=Google应用专用密码
```

### Outlook / Hotmail

```text
SMTP_SERVER=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=你的Outlook邮箱
SMTP_PASSWORD=邮箱应用密码
```

> 建议使用邮箱授权码或应用专用密码，不要使用邮箱登录密码。

---

## 获取 Cookie 方式 - 米游社签到必需

### 1. 打开浏览器

建议打开浏览器无痕 / 隐身模式。

### 2. 登录米游社
- 访问 [原神论坛](http://bbs.mihoyo.com/ys) 或 [崩铁论坛](http://bbs.mihoyo.com/sr)，二选一进行登录操作，原神崩铁Cookie通用。

### 3. 获取 Cookie

按下键盘上的 `F12`，或右键页面选择：

```text
检查
```

打开开发者工具。

切换到：

```text
Console
```

复制并执行以下代码：

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

执行后，Cookie 会复制到剪贴板。

### 4. 填入 GitHub Secrets

添加 Secret：

```text
Name: MYS_COOKIES
Value: 复制到的 Cookie
```

多个账号可以使用换行或英文逗号分隔。

---

## 获取 Token 方式 - 云游戏签到必需

1. **打开浏览器**:
   - 打开你的浏览器，进入无痕/隐身模式。
   
2. **登录云游戏**:
   - 访问 [云原神](https://ys.mihoyo.com/cloud/#/) 和 [云崩铁](https://sr.mihoyo.com/cloud/#/)。原神崩铁Token不通用！
   
3. **获取 Token**:
   - 按下键盘上的 `F12` 或右键点击页面选择“检查”，打开开发者工具。
   - 切换到“Network”选项卡
   - 在XHR请求中找到一条 `Request Headers` 中含有 `x-rpc-combo_token` 字段的请求。
   - 选中并复制`x-rpc-combo_token`的值，此时 Token 已经复制到你的剪贴板。


---

### 2. 配置 GitHub Secrets

进入 Fork 后的仓库：

```text
Settings -> Secrets and variables -> Actions
```

添加需要的 Secrets。

最小配置示例，只运行米游社签到并发送邮件：

```text
MYS_COOKIES
MAIL_TO
SMTP_SERVER
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
```

完整配置示例：

```text
MYS_COOKIES
GENSHIN_TOKENS
STARRAIL_TOKENS
MAIL_TO
SMTP_SERVER
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
MYS_DEVICE_ID
MIHOYO_DEVICE_ID
```

---

### 3. Workflow 文件

本项目使用：

```text
.github/workflows/run.yml
```

默认配置为：

```yaml
on:
  schedule:
    - cron: '0 20 * * *'
  workflow_dispatch:
```

说明：

```text
UTC 20:00 = 北京时间 04:00
```

也可以在 GitHub Actions 页面手动运行。

---

### 4. package-lock.json

本项目推荐使用：

```bash
npm ci --ignore-scripts
```

因此仓库中需要包含：

```text
package-lock.json
```

如果没有 `package-lock.json`，GitHub Actions 会安装失败。

---

## 本地部署

### 1. 安装 Node.js

请安装 Node.js 22 或更高版本。

### 2. Clone 项目

```sh
git clone https://github.com/GildedFlames/MYS_Game_Singin.git
cd MYS_Game_Singin
```

### 3. 安装依赖

```sh
npm install
```

### 4. 配置环境变量

不建议直接在代码中填写 Cookie 或 Token。  
建议使用 `.env` 或系统环境变量。

例如 Linux / macOS：

```sh
export MYS_COOKIES="你的Cookie"
export GENSHIN_TOKENS="云原神Token"
export STARRAIL_TOKENS="云崩铁Token"
```

Windows PowerShell：

```powershell
$env:MYS_COOKIES="你的Cookie"
$env:GENSHIN_TOKENS="云原神Token"
$env:STARRAIL_TOKENS="云崩铁Token"
```

### 5. 运行脚本

```sh
npm start
```

或：

```sh
node main.js
```

---

## 日志与安全说明

脚本运行时会生成：

```text
output.log
summary.html
```

这些文件已经在 `.gitignore` 中忽略，不建议提交到仓库。

### output.log 是否包含敏感信息？

正常情况下，当前版本不会主动输出：

- 米游社 Cookie
- 云游戏 Token
- SMTP 密码
- Authorization

但是日志中可能包含：

- 签到结果
- 接口 retcode
- 接口 message
- 昵称
- 打码后的 UID

因此不建议上传或公开 `output.log`。

---

## 公共仓库安全建议

如果你的仓库是公共仓库，请注意：

1. 不要把 Cookie、Token、SMTP 密码写进代码
2. 不要提交 `.env`
3. 不要提交 `output.log`
4. 不要提交 `summary.html`
5. 不要把原始日志作为 artifact 上传
6. 不要在代码中打印完整 `headers`
7. 不要在代码中打印完整 `Axios error`
8. 不要给不可信用户写权限
9. 不要使用 `pull_request_target` 触发含 Secrets 的工作流

建议将 Actions 日志保留时间设置为较短时间，例如：

```text
2 days
```

路径：

```text
Settings -> Actions -> General -> Artifact and log retention
```

---

## GitHub Actions 权限说明

本项目主工作流使用最小权限：

```yaml
permissions:
  contents: read
```

主签到流程只需要读取仓库代码，不需要写入仓库。

如果你曾经使用临时工作流生成 `package-lock.json`，生成完成后建议删除该临时工作流，避免保留不必要的写权限。

---

## 邮件显示说明

邮件中默认只显示简洁结果：

```text
✅ 成功
❌ 全部失败
⚠️ 部分失败
⏭️ 已跳过
```

不会显示详细统计信息，例如：

```text
总数: 1，失败: 0，跳过: false
```

如果没有配置云游戏 Token，邮件不会显示云游戏签到区域。

---

## 常见问题

### 1. 没有配置云游戏 Token 会报错吗？

不会。

未配置 `GENSHIN_TOKENS` 时，云原神会跳过。  
未配置 `STARRAIL_TOKENS` 时，云崩铁会跳过。

---

### 2. 没有配置邮箱会怎么样？

脚本仍然会运行，但不会发送邮件。

---

### 3. 为什么 GitHub Actions 安装依赖失败？

请检查仓库中是否存在：

```text
package-lock.json
```

如果 workflow 使用：

```bash
npm ci --ignore-scripts
```

则必须提交 `package-lock.json`。

---

### 4. 为什么邮件没有云游戏结果？

如果没有配置：

```text
GENSHIN_TOKENS
STARRAIL_TOKENS
```

邮件中不会显示云游戏区域。

---

### 5. 公共仓库会泄露 Secrets 吗？

GitHub Secrets 默认不会直接暴露给外部用户。  
但公共仓库的 Actions 日志可能公开可见，所以不要在代码中打印 Secrets。

---
