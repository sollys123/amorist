# Amorist 项目长期笔记

## 时间轴数据架构
- 时间轴事件存 `localStorage['amorist-timeline-events-v1']`，结构 `{version:2,events:[...]}`。
- 事件 type 白名单：`started`（开始游玩）、`completed`（全通）、`session`（日常游玩记录，2026-07-31 新增）。
- 三处过滤点必须同步：amorist-app.js（TIMELINE_ALLOWED_TYPES + renderTimeline + fallback）、public-bootstrap.js（公开站加载）、editor-tools.js（导出公开数据）。新增类型要三处都改。
- 数据流：编辑器 localStorage → 「站点数据」导出 → data/amorist-data.json → 公开站加载。session 事件已打通全链路。
- 数据模型里还预留了 route_completed 类型（路线通关），但 UI 未启用。

## 代码结构注意
- amorist-app.js 里有两套 renderTimeline/timelineControlHtml 定义（前一份是死代码，被后者覆盖）。改动时认准第二份（行号靠后的）。
- PowerShell 回显常被吞，用 node --check 验证 JS 语法以退出码为准；JSON 检查用 Python 写文件再 Read。

## 运行
- 本地预览：`python -m http.server 8765 --directory C:\Users\yang.shen\Desktop\amorist`，打开 http://localhost:8765/editor.html
- 公开站：http://localhost:8765/index.html
