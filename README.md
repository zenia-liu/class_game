# 课游工坊 MVP

面向小学一线教师的零代码课堂游戏生成器。老师用一句话描述知识点，检查生成题目后，可选择四种红蓝队玩法，预览并下载完全离线的单文件 HTML 游戏。

## 启动

需要 Node.js 20 或更高版本，不需要安装第三方依赖。

```powershell
node server.mjs
```

浏览器打开：<http://127.0.0.1:4173>

作品只保存在当前浏览器的本地缓存中，不需要数据库或账号。

## 接入智能出题

默认未配置模型时会使用内置演示题库，完整界面和四种游戏仍可体验。接入任意兼容 OpenAI Chat Completions 格式的国内模型：

```powershell
$env:WORKSHOP_AI_API_KEY="你的服务端Key"
$env:WORKSHOP_AI_BASE_URL="https://api.deepseek.com"
$env:WORKSHOP_AI_MODEL="deepseek-chat"
node server.mjs
```

Key 只由服务器读取，不会发送到浏览器或写入下载的游戏。

使用 TokenRouter 等 OpenAI 兼容中转服务时，只需把 Base URL 和模型名替换为控制台提供的准确值。若平台提供的是完整 `/chat/completions` 地址，可使用 `WORKSHOP_AI_CHAT_URL`。详细操作见 [部署内测指南](./部署内测指南.md)。

## 当前 MVP

- 一句话描述教学意图，自动识别年级和学科；
- AI 出题接口与无 Key 演示兜底；
- 问答题、配对卡、知识卡逐项编辑；
- 红蓝竞速闯关、阵营连连看、红蓝翻牌记忆、神秘格子 PK；
- 在线试玩与单文件 HTML 下载；
- “我的课游”本机作品夹：自动保存最近 20 份，支持继续编辑、试玩和删除；
- 无注册、无数据库，教师内容不会上传到作品库；
- 适配 Vercel，使用 Serverless Function 安全转发 TokenRouter 请求。

## 检查

```powershell
node --check server.mjs
node --check public/app.js
node --check public/game-builder.js
node scripts/verify.mjs
node scripts/verify-vercel.mjs
```

需求与产品决策见 [需求文档-课游工坊.md](./需求文档-课游工坊.md)。
"# class_game" 
