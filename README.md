# Amorist Personal Site

这是 Amorist 的“私人编辑器 + 公开展示站”完整项目，并在同一个压缩包内提供两套本地启动方案：

1. **PowerShell 免安装方案**：适合普通 Windows 电脑、公司电脑和没有 Node.js 的环境。
2. **Node.js 方案**：适合已经安装 Node.js 的电脑和开发环境。

网页内容和功能完全相同，两套方案的区别只在于由谁启动本地 HTTP 服务器。

## 项目结构

```text
amorist_personal_site/
├── index.html                  # 对外公开的只读展示站
├── editor.html                 # 私人编辑器
├── assets/
│   ├── css/
│   │   ├── amorist.css
│   │   └── site-modes.css
│   └── js/
│       ├── amorist-app.js
│       ├── editor-tools.js
│       ├── public-bootstrap.js
│       └── public-mode.js
├── data/
│   ├── amorist-data.json       # 你的个人公开数据
│   ├── bangumi-games.json      # 公共乙女资源库
│   └── bangumi-meta.json       # 资源库版本信息
├── docs/
├── serve.ps1                   # PowerShell 免安装服务器
├── serve.mjs                   # Node.js 零依赖服务器
├── start-editor.bat            # PowerShell：打开私人编辑器
├── start-public.bat            # PowerShell：打开公开展示站
├── start-editor-node.bat       # Node：打开私人编辑器
├── start-public-node.bat       # Node：打开公开展示站
├── start-editor-node.command   # macOS + Node：打开私人编辑器
└── start-public-node.command   # macOS + Node：打开公开展示站
```

## 重要：不要直接双击 HTML

不要直接双击 `editor.html` 或 `index.html`。

拆分后的页面需要读取外部 JavaScript、CSS 和 JSON。浏览器在 `file://` 模式下通常会阻止 JSON 请求，因此会出现页面能显示但按钮不工作、公开数据无法加载等问题。

应使用下面任意一种启动方式，通过 `http://localhost:4173` 打开。

# Windows 启动方式

## 方案 A：PowerShell 免安装版（推荐）

Windows 通常自带 PowerShell，不需要安装软件，也不需要管理员权限。

### 打开私人编辑器

双击：

```text
start-editor.bat
```

### 打开公开展示站

双击：

```text
start-public.bat
```

启动后会保留一个名为 `Amorist PowerShell Server` 的窗口。关闭该窗口即停止本地服务器。

## 方案 B：Node.js 版

电脑已安装 Node.js 时，可以使用：

### 打开私人编辑器

```text
start-editor-node.bat
```

### 打开公开展示站

```text
start-public-node.bat
```

也可以在项目目录手动运行：

```bash
node serve.mjs
```

然后打开：

- 私人编辑器：`http://localhost:4173/editor.html`
- 公开展示站：`http://localhost:4173/index.html`

# macOS 启动方式

需要已经安装 Node.js。第一次使用时，可能需要在终端执行：

```bash
chmod +x start-editor-node.command start-public-node.command
```

随后双击对应 `.command` 文件，或手动运行：

```bash
node serve.mjs
```

# 两个网页的区别

## `editor.html`：私人编辑器

- 从浏览器本地存储和 IndexedDB 读取你的完整数据。
- 可以添加、修改、删除、同步、导入、备份和制作 REPO。
- 可以导出公开站使用的 `amorist-data.json`。
- 不建议作为公开主页入口。

## `index.html`：公开展示站

- 只读取 `data/amorist-data.json`。
- 不读取访客自己的游戏记录。
- 隐藏编辑、删除、批量管理和同步等操作。
- 用于 GitHub Pages 或其他静态网站托管。

# 日常更新流程

1. 双击 `start-editor.bat` 或 `start-editor-node.bat`。
2. 在私人编辑器中修改自介、游戏档案、角色、REPO 与创作数据。
3. 点击右上角“站点数据”。
4. 选择准备公开的内容。
5. 点击“预览公开站”检查效果。
6. 点击“导出公开数据 JSON”。
7. 用导出的文件替换：

```text
data/amorist-data.json
```

8. 双击 `start-public.bat` 或 `start-public-node.bat` 本地检查。
9. 将公开站文件推送到 GitHub Pages。

日常更新个人内容时，通常只需要替换 `data/amorist-data.json`。

# 两种导出

## 公开数据 `amorist-data.json`

用于公开展示站。会按勾选范围导出，并排除 `visibility: "private"` 的条目。

## 私人完整备份

用于迁移或恢复编辑器，包含：

- Amorist 本地存储数据
- REPO 存档
- 图片库与裁切信息
- 最近删除内容

公共 Bangumi 资源库体积较大，继续单独保存在 `bangumi-games.json`，不重复放入私人备份。

# GitHub Pages 部署

上传公开站时至少保留：

```text
index.html
assets/
data/
```

`editor.html`、启动脚本和本地服务器文件不影响公开站运行。若不希望别人看到编辑器界面，可以不上传：

```text
editor.html
assets/js/editor-tools.js
serve.ps1
serve.mjs
start-*.bat
start-*.command
```

# 常见问题

## 页面能打开，但按钮无法点击

通常是直接双击 HTML、没有完整解压，或 `assets` 文件夹不在 HTML 同级目录。请完整解压后使用启动脚本。

## 提示端口 4173 已被占用

可能已经有一个 Amorist 服务器窗口在运行。直接访问：

```text
http://localhost:4173/editor.html
```

或关闭旧服务器窗口后重新启动。

## PowerShell 脚本被系统策略阻止

本项目的 `.bat` 启动器已经使用当前进程级的 `-ExecutionPolicy Bypass`，不会修改电脑的长期安全策略。若公司安全软件仍然拦截，请改用 Node.js 方案。

## 图片说明

Bangumi 网络图片继续使用远程 URL。本地上传图片若以 Data URL 写入公开 JSON，也可以展示，但 JSON 文件可能明显变大。
