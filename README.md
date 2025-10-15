# MemoTrip - 旅行费用分摊与照片分享平台

<div align="center">

![MemoTrip](https://img.shields.io/badge/MemoTrip-v1.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)

一个轻量级、可自托管的旅行费用分摊和照片分享应用，专为团队旅行设计。

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [技术架构](#-技术架构) • [API文档](#-api-文档) • [开发指南](#-开发指南)

</div>

---

## 📖 项目简介

MemoTrip 是一个现代化的旅行费用管理和照片分享平台，旨在简化多人旅行中的费用分摊和回忆分享。通过智能的权重算法和直观的用户界面，让旅行费用结算变得简单透明。

### 核心亮点

- 🏠 **家庭权重系统** - 支持成人/儿童不同权重配置（1.0/0.5）
- 💰 **智能结算算法** - 自动计算费用分摊并生成最少转账方案
- 📸 **照片画廊** - 集中管理和分享旅行照片
- 🌍 **多币种支持** - USD, EUR, GBP, JPY, CNY
- 🔒 **数据安全** - 本地部署，完全掌控您的数据
- 🌙 **深色模式** - 完整的明暗主题支持
- 📱 **响应式设计** - 完美适配手机、平板、桌面
- 🐳 **一键部署** - Docker Compose快速启动

---

## ✨ 功能特性

### 已实现功能

#### 👤 用户管理
- ✅ 邮箱密码注册/登录
- ✅ 自动创建默认家庭
- ✅ 用户个人信息管理

#### 🎒 旅行管理
- ✅ 创建旅行（支持多币种）
- ✅ 旅行列表查看
- ✅ 旅行详情（收据/结算/照片/参与者）
- ✅ 自动添加创建者为首位参与者

#### 🏠 家庭与参与者
- ✅ 创建和管理家庭
- ✅ 添加/移除旅行参与者
- ✅ 配置成员权重（成人=1.0，儿童=0.5）
- ✅ 查看家庭成员详情

#### 🧾 收据管理
- ✅ 上传收据图片
- ✅ 收据状态跟踪
- ✅ 收据预览和全屏查看
- ✅ 收据列表管理

#### 📷 照片画廊
- ✅ 上传照片
- ✅ 网格展示
- ✅ 照片预览
- ✅ 显示上传者和日期

#### 💵 费用结算
- ✅ 基于权重的智能分摊算法
- ✅ 一键重新计算结算
- ✅ 生成最少转账方案
- ✅ 结算历史版本管理
- ✅ HTML导出模板

### 计划功能

- 🤖 OpenAI Vision API 收据自动解析
- 📤 PNG/PDF格式导出结算表
- 🔗 邀请码系统
- 🖼️ EXIF元数据提取
- 📦 照片批量下载ZIP

---

## 🚀 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ 可用磁盘空间

### 一键部署

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/MemoTrip.git
cd MemoTrip

# 2. 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 文件，添加 OpenAI API Key（如需AI解析功能）

# 3. 启动所有服务
docker compose up -d

# 4. 等待服务就绪（约30秒）
docker compose logs -f web

# 5. 访问应用
# 打开浏览器访问: http://localhost:3001
```

### 首次使用

1. **注册账户** - 访问 http://localhost:3001/register
2. **创建旅行** - 登录后在仪表板点击 "New Trip"
3. **添加参与者** - 在旅行详情页添加其他家庭
4. **上传收据** - 点击 "Upload Receipt" 上传费用凭证
5. **计算结算** - 点击 "Recalculate Settlement" 生成分摊方案

---

## 🏗️ 技术架构

### 技术栈

- **前后端**: Next.js 15 (App Router) + React 18 + TypeScript
- **数据库**: PostgreSQL 16 + Prisma ORM
- **缓存**: Redis 7
- **样式**: Tailwind CSS 3
- **部署**: Docker + Docker Compose
- **文件存储**: 本地文件系统卷

### 系统架构图

```
┌─────────────────────────────────────────┐
│         Browser/Client                   │
│      (React + Tailwind CSS)              │
└────────────────┬────────────────────────┘
                 │ HTTP/HTTPS
┌────────────────▼────────────────────────┐
│         Next.js Server                   │
│  ┌──────────┐  ┌─────────┐  ┌─────────┐│
│  │  Pages   │  │   API   │  │  Files  ││
│  │ (SSR/CSR)│  │  Routes │  │  Server ││
│  └──────────┘  └─────────┘  └─────────┘│
└────┬──────────────┬────────────────┬────┘
     │              │                │
     ▼              ▼                ▼
┌─────────┐  ┌──────────┐  ┌──────────────┐
│PostgreSQL│  │  Redis   │  │File Storage  │
│Database  │  │  Cache   │  │   Volumes    │
└─────────┘  └──────────┘  └──────────────┘
```

---

## 📡 API 文档

### 认证相关

**注册用户**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**用户登录**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 旅行管理

**创建旅行**
```http
POST /api/trips
Content-Type: application/json

{
  "name": "Japan 2024",
  "currency": "JPY",
  "userId": "cuid..."
}
```

**获取旅行列表**
```http
GET /api/trips?userId=cuid...
```

### 其他端点

- `POST /api/trips/:tripId/participants` - 添加参与者
- `POST /api/trips/:tripId/receipts` - 上传收据
- `POST /api/trips/:tripId/photos` - 上传照片
- `POST /api/trips/:tripId/settlements/recompute` - 重新计算结算
- `GET /api/files/:...path` - 获取文件

详细API文档请查看项目Wiki。

---

## 💻 开发指南

### 本地开发环境

```bash
# 安装依赖
cd app
npm install

# 配置数据库
cp .env.example .env

# 运行数据库迁移
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

### 数据库操作

```bash
# 创建新迁移
npx prisma migrate dev --name add_new_feature

# 打开 Prisma Studio
npx prisma studio

# 生成 Prisma Client
npx prisma generate
```

### Docker 开发

```bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f web

# 停止服务
docker compose down
```

---

## 🔧 配置说明

### 环境变量

创建 `.env` 文件：

```bash
# 数据库连接
DATABASE_URL=postgresql://trip:trip@db:5432/trip

# OpenAI API（可选）
OPENAI_API_KEY=sk-...

# 应用配置
PORT=3000
NODE_ENV=production
```

---

## 🎯 使用场景

**家庭旅行** - 多个家庭一起出游，使用权重系统（成人=1.0，儿童=0.5）公平分摊费用。

**朋友聚会** - 朋友AA制旅行，每人创建自己的家庭，平均分摊所有费用。

**公司团建** - 公司组织团建活动，财务人员管理所有收据，自动生成费用报表。

---

## 🤝 贡献指南

欢迎任何形式的贡献！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📜 开源协议

本项目采用 MIT License 开源协议。

---

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Prisma](https://www.prisma.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Docker](https://www.docker.com/)

---

<div align="center">

**[⬆ 回到顶部](#memotrip---旅行费用分摊与照片分享平台)**

Made with ❤️ by MemoTrip Team

</div>
