「TripSplit+Gallery」— 轻量本地化方案（Docker Compose，无云服务/反向代理）

目标复述：仅用 Docker Compose 在一台本地/内网主机上跑起来；不依赖云对象存储、CDN、反向代理。保留多人记账 + 照片分享两大功能，并新增**“一键导出最终结算截图（PNG/PDF）”**，样式与您给的示例一致（含列标题、分项、Paid、Net Amount 加粗下划线等）。

1. 架构简化要点

运行方式：单机 Docker Compose（生产/内网均可）。

组件：

Web 应用：Next.js（含 API Routes），端口 :3000（无需 Nginx/Traefik）。

数据库：PostgreSQL（容器卷持久化；也可选 SQLite → 更简，但并发较弱）。

任务队列：BullMQ + Redis（可选；小团队可先不用队列，直接同步/短耗时任务）。

文件存储：本地卷目录（如 ./data/uploads），由应用直存直读；无需 S3/MinIO。

导出服务：与 Web 同进程内置 Puppeteer/Playwright（Headless Chromium） 渲染导出页面为 PNG/PDF。

AI 能力：

OpenAI API（视觉+结构化） 默认通路；

亦支持离线兜底：Tesseract OCR + 规则抽取（可 later）。

日志/监控：控制台与文件日志即可（pino）。无需 Loki/Grafana。

说明：若完全不想要 Redis/队列，可将“收据解析、图片缩略图、打包下载”做请求内串行或“按钮触发+Loading”交互；后续规模上来再加队列容器即可。

2. 服务与目录结构
project/
├─ app/                # Next.js (前后端一体 + API routes + 导出模板)
├─ data/
│  ├─ uploads/         # 收据/照片原始文件（本地卷）
│  ├─ thumbs/          # 照片缩略图
│  └─ exports/         # 生成的 PNG/PDF/ZIP
├─ docker-compose.yml
└─ .env                # 环境变量（OPENAI_API_KEY 等）


容器（最简版）

web: Next.js 应用（包含导出渲染）

db: Postgres

redis（可选）

3. 前端与交互（简洁现代）

框架：Next.js（App Router）

样式：Tailwind CSS + shadcn/ui（现代、统一、无设计负担）

表格：AG Grid（社区版） 或 MUI Data Grid（内联编辑、冻结列、导出 CSV）

图片画廊：react-photo-album + 原生 <dialog>/shadcn Dialog 预览

EXIF：exifr（前端读取拍摄时间/机型/GPS）；时间线/分组展示

上传：原生 <input type="file" multiple> + 断点续传可后加（先不引入 Uppy）

状态/数据：TanStack Query（请求缓存/重试）；Zod + React Hook Form（表单校验）

主题：浅/暗色切换；系统字体（SF/Inter）+ 数字等宽体（Tabular Lining）

4. 数据模型（精简版）

仍以 Household/Trip 为边界，行级权限都带 tripId 过滤。

User(id, email, name, avatarUrl, createdAt, updatedAt)

Household(id, displayName, createdAt, updatedAt)

HouseholdMember(id, userId, householdId, role[OWNER|MEMBER])

Trip(id, name, currency, startDate, endDate)

TripAdmin(id, tripId, userId)

TripParticipant(id, tripId, householdId, weight=1)

Receipt(id, tripId, uploaderId, filePath, fileHash?, status[PENDING|PARSED|REVIEWED|ERROR], parsedJson?, manualEditsJson?, createdAt)

Settlement(id, tripId, version, tableJson, transfersJson, locked, createdAt)

Photo(id, tripId, uploaderId, filePath, exifJson?, width?, height?, thumbPath?, createdAt)

Invite(id, tripId, code, expiresAt, maxUses=1, used=0, createdBy)

filePath/thumbPath 为本地相对路径（映射容器卷）。不使用 S3 Key。

5. 关键流程（无云、全本地）
5.1 收据 → AI 解析 → 可编辑表格

用户在 Receipts 页批量上传（文件落在 data/uploads/receipts/）。

点击“解析全部”→ 后端顺序或小并发调用 OpenAI 视觉模型：

输入：收据图片路径（应用读取为 base64 或在本地 file://+ 转字节流）、Trip 家庭成员/权重、币种。

输出：严格 JSON（总额、税/小费、时间、商户、参与家庭建议）。

解析结果呈现在 AG Grid：可单元格编辑、批量填充、撤销/重做。

“重新计算结算”→ 生成 Settlement.tableJson/transfersJson（见 §6）。

5.2 照片管理

文件落在 data/uploads/photos/，入库 EXIF（前端初读后随 POST 一起传入）。

生成缩略图 data/thumbs/（首次访问时同步生成亦可，避免队列）。

“选中 → 打包下载”→ 后端流式 ZIP 写入 data/exports/*.zip，下载后清理或定期清理。

5.3 一键导出结算截图（重点）

导出入口：Settlement 页右上角「Export」下拉：PNG（屏显）/ PDF（A4）/ CSV。

实现方式（推荐）：

在应用内预置只读的 导出模板路由（例如 /export/settlement/:tripId/:version?style=compact），该页面用 纯 HTML+Tailwind 渲染“最终结算表”，其视觉风格与您给的示例一致：

三列家庭（动态列数自适应）；

“Adults(x1)/Kids(x0.5)/Total” 三行；

下方分项（House / Lunch / Dinner…）；

“Paid” 行括号负数；

Net Amount 行：黑色下划线+粗体；正负金额带颜色（可配置黑白导出时取消颜色，仅保留括号负数）；

数字右对齐、使用等宽表格数字（Tailwind tabular-nums）。

Puppeteer/Playwright 在后端打开该路由（本机 http://web:3000/...），渲染为 PNG 或 PDF，保存到 data/exports/settlement-<trip>-v<version>.png|pdf 并返回下载链接。

字体：优先 Inter / Noto Sans，数字采用 tabular-nums；若中文显示，加入 Noto Sans SC。

版式细节（与示例对齐）：

标题行：各家庭列标题带下划线（可用 border-b）

分隔线：小计行（如 2,840.83）用加粗上边线；

Paid 行数字显示 (1,555.76) 形式；

Net Amount 行整行加粗，并在底部加一条更粗的横线（Tailwind border-b-4），值保留两位小数；

右侧可选择显示 “总权重=10.5” 这类汇总注释；

导出时自动隐藏网页导航控件，仅保留主体表。

这样导出的 PNG/PDF 将与您发的截图风格高度一致；而且由于是先渲染 HTML，再截图/排版，数据与页面所见即所得。

6. 结算算法（本地纯 JS）

参与与权重：P ⊆ Households；Kids 权重=0.5（可配置）；求和归一化。

分摊：对每张收据的 grandTotal 按权重分到各家庭的 shouldPay_i。

已付：根据“付款家庭”记录累加 paid_i。

净额：net_i = paid_i - shouldPay_i（>0 应收，<0 应付）。

转账建议（最少笔）：

将应收集合与应付集合排序，贪心匹配；

生成 {from, to, amount} 列表；

保留两位小数并允许 ±0.01 的舍入差（最终和校验）。

版本化：每次“重新计算”存一版 Settlement，导出时可选版本。

7. 权限与访问

仅被管理员加入的 Trip 可见；TripAdmin 可创建邀请/设置权重/锁定结算。

静态文件（收据/照片/导出）走 受控下载接口（校验用户与 tripId 关联后再读磁盘回传）。

无需反向代理：应用监听 :3000，内网直接访问；若要 HTTPS，可后期加 Caddy/Nginx（非必需）。

8. 导出视觉规范（供前端实现）

色彩：默认黑白导出（打印友好）。若启用彩色：

正数：默认黑；负数：深灰 + 括号；

Net Amount 行：全部加粗；金额右对齐；底部粗线。

字体与数字：font-feature-settings: "tnum";（Tailwind tabular-nums）；

列宽：自适应列数（3~6 家庭都能排）；列间 gap-x-12；

单位：货币统一到 Trip 设定（如 USD）；Intl.NumberFormat 格式化。

小计线：border-t；总计线：border-t-2；Net Amount：border-b-4.

边距：PNG：padding 32px；PDF：A4 / Letter 按 10–15mm 边距。

可选元素：右侧显示 Total Weight = 10.5；页脚加导出时间/版本号/Trip 名称。

9. API 端点（本地版）

POST /api/trips / GET /api/trips

POST /api/trips/:tripId/invite / POST /api/invite/accept

收据

POST /api/trips/:tripId/receipts（多文件上传，保存到 data/uploads/receipts/）

POST /api/trips/:tripId/receipts/parse（依次喂给 OpenAI）

PATCH /api/receipts/:id（人工修正）

照片

POST /api/trips/:tripId/photos（上传到 data/uploads/photos/）

GET /api/trips/:tripId/photos（带 EXIF）

POST /api/trips/:tripId/photos/zip（生成 data/exports/*.zip）

结算

POST /api/trips/:tripId/settlements/recompute

GET /api/trips/:tripId/settlements/latest

GET /api/trips/:tripId/settlements/:id/export.png|pdf|csv（Puppeteer 渲染）

10. 环境变量（本地）

DATABASE_URL=postgresql://trip:trip@db:5432/trip

OPENAI_API_KEY=...（若使用）

UPLOAD_ROOT=/app/data/uploads

EXPORT_ROOT=/app/data/exports

THUMB_ROOT=/app/data/thumbs

PORT=3000

11. Docker Compose（完整最小可用示例）

仅示例结构；镜像名按您的仓库构建产物替换。此段可直接使用。

version: "3.9"
services:
  web:
    image: tripsplit-web:latest
    container_name: tripsplit-web
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://trip:trip@db:5432/trip
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - UPLOAD_ROOT=/app/data/uploads
      - EXPORT_ROOT=/app/data/exports
      - THUMB_ROOT=/app/data/thumbs
    volumes:
      - ./data/uploads:/app/data/uploads
      - ./data/exports:/app/data/exports
      - ./data/thumbs:/app/data/thumbs
    depends_on:
      - db
    # 如果使用 Puppeteer，需要以下依赖；也可改用 Playwright 带捆绑浏览器镜像
    # cap_add:
    #   - SYS_ADMIN

  db:
    image: postgres:16
    container_name: tripsplit-db
    environment:
      - POSTGRES_USER=trip
      - POSTGRES_PASSWORD=trip
      - POSTGRES_DB=trip
    volumes:
      - ./data/pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U trip -d trip"]
      interval: 5s
      timeout: 3s
      retries: 10

  # 可选：小团队先不启用
  # redis:
  #   image: redis:7
  #   container_name: tripsplit-redis
  #   volumes:
  #     - ./data/redis:/data


运行：docker compose up -d
首次运行后执行 Prisma 迁移（或应用启动时自动迁移）。

12. 风险与权衡（本地化特有）

磁盘空间：照片/导出占用增长快；增加自动清理策略（如仅保留最近 N 次 ZIP 导出）。

Puppeteer 体积：镜像会偏大，可改 Playwright 官方镜像或 puppeteer-core + chromium 包管理。

并发：无队列时解析/打包在主进程执行；对大批量操作需提示“耐心等待”，或一次只处理 50 张。

备份：定期备份 data/pg 与 data/uploads、data/exports。

13. 开发里程碑（本地最小集）

MVP（1）

Trip/Household/Member 基础

收据上传 + 单张解析（OpenAI）+ 可编辑表格

结算重算 + 转账建议

照片上传 + 网格预览 + EXIF 展示

MVP（2）

导出模板 + Puppeteer PNG/PDF（对齐示例样式）

打包下载 ZIP

增强

队列化（Redis）

重复收据检测（哈希/相似度）

离线 OCR 兜底（Tesseract）

14. 与示例截图的一致性清单（实现验收用）

 列标题为家庭名（Angela / Bella / Winter），标题带下划线

 Adults(x1) / Kids(x0.5) / Total 三行，Total 显示加权和

 下方分项：House / Lunch / Dinner… 各行右对齐金额

 分项小计行有上边线（与示例一致）

 Paid 行金额以括号表示负数（如 (1,555.76)）

 Net Amount 行：粗体、底部粗线、对齐方式与示例一致

 右侧可显示一个总权重（10.5）的小注

 导出 PNG/PDF 时页面无导航，仅留表格主体，留白边距合适

结语

以上方案在极简依赖下即可满足：本地运行、多人协作、AI 解析、可编辑结算，并且导出最终截图与您给出的样式一致。后续若想“更稳更快”，只需按需添加 Redis 队列或 Nginx/Caddy（并非必需）。如果您愿意，我可以基于此文档进一步产出：

导出模板的设计稿（Tailwind 类名标注）；

Prisma 迁移清单；

OpenAI 提示词与 JSON Schema 样例（严格对齐导出字段）。