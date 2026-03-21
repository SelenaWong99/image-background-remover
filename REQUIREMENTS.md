# Image Background Remover — MVP 需求文档

## 一、产品概述

| 项目 | 内容 |
|------|------|
| 产品名称 | Image Background Remover |
| 目标用户 | 需要快速去除图片背景的个人用户（电商、设计师、普通用户） |
| 核心价值 | 无需注册、上传即用、秒级出结果 |
| 部署平台 | Cloudflare Pages（Edge Runtime） |
| AI 能力 | remove.bg API |

---

## 二、MVP 功能范围

### ✅ 必须有（P0）

| 功能 | 描述 |
|------|------|
| 图片上传 | 支持拖拽上传 / 点击选择文件 |
| 格式支持 | PNG、JPG、WEBP，单文件最大 10MB |
| 背景去除 | 调用 remove.bg API，自动去除背景 |
| 结果预览 | 左右对比展示原图与处理结果 |
| 下载结果 | 一键下载透明背景 PNG |
| 错误处理 | 格式不支持 / 文件过大 / API 失败均有提示 |
| 隐私保护 | 图片仅在内存中处理，不落盘，不存储 |

### 🔜 后续迭代（P1，MVP 不做）

| 功能 | 描述 |
|------|------|
| 批量上传 | 同时处理多张图片 |
| 自定义背景色 | 替换为纯色/渐变背景 |
| 背景图替换 | 上传自定义背景图合成 |
| 历史记录 | 浏览器本地缓存最近处理的图片 |
| 账号系统 | 注册登录，API 用量管理 |

---

## 三、页面结构

### 唯一页面：首页 `/`

```
┌─────────────────────────────────────┐
│           Background Remover         │  ← 标题 + 副标题
├─────────────────────────────────────┤
│                                     │
│   [ 拖拽区域 / 点击上传 ]            │  ← idle 状态
│                                     │
├─────────────────────────────────────┤
│   [转圈 loading] 正在处理...         │  ← uploading 状态
├─────────────────────────────────────┤
│  原图          │  处理结果           │  ← done 状态
│  [img]        │  [img 棋盘背景]     │
│                                     │
│  [下载 PNG]  [再试一张]             │
├─────────────────────────────────────┤
│  ❌ 错误提示文字  [重试]             │  ← error 状态
└─────────────────────────────────────┘
```

---

## 四、技术架构

```
用户浏览器
    │
    │  POST /api/remove-bg (FormData)
    ▼
Cloudflare Pages (Edge Worker)
    │
    │  转发图片给 remove.bg API
    ▼
remove.bg API
    │
    │  返回透明 PNG 字节流
    ▼
Cloudflare Pages (Edge Worker)
    │
    │  直接流式返回给浏览器（不存储）
    ▼
用户浏览器（前端渲染预览 / 触发下载）
```

### 技术选型

| 层 | 技术 |
|----|------|
| 前端框架 | Next.js 16 (App Router) |
| 样式 | Tailwind CSS |
| 部署 | Cloudflare Pages + @cloudflare/next-on-pages |
| API Runtime | Edge Runtime（无 Node.js 依赖） |
| 抠图服务 | remove.bg REST API |
| 存储 | 无（图片全程内存） |

---

## 五、接口设计

### POST `/api/remove-bg`

**请求**
```
Content-Type: multipart/form-data
Body:
  image: File  (图片文件，max 10MB)
```

**响应 - 成功**
```
Status: 200
Content-Type: image/png
Content-Disposition: attachment; filename="removed-bg.png"
Body: <PNG 二进制>
```

**响应 - 失败**
```
Status: 400 / 500
Content-Type: application/json
Body: { "error": "错误描述" }
```

---

## 六、环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `REMOVE_BG_API_KEY` | remove.bg API 密钥 | ✅ |

---

## 七、非功能需求

| 项目 | 要求 |
|------|------|
| 响应时间 | 去除背景 < 10s（取决于 remove.bg） |
| 文件限制 | 单文件 ≤ 10MB |
| 浏览器兼容 | Chrome / Firefox / Safari 最新版 |
| 移动端 | 响应式布局，支持手机上传 |
| 隐私 | 不记录、不存储任何用户图片 |

---

## 八、上线 Checklist

- [ ] remove.bg API Key 申请完成
- [ ] 本地 `.env.local` 配置 `REMOVE_BG_API_KEY`
- [ ] `npm run build` 无报错
- [ ] Cloudflare Pages 项目创建并连接 GitHub 仓库
- [ ] Cloudflare 环境变量配置 `REMOVE_BG_API_KEY`
- [ ] 部署成功，域名可访问
- [ ] 上传测试图片，验证去背景功能正常
- [ ] 验证下载 PNG 透明背景正确

