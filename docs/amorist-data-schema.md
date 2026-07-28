# `amorist-data.json` 数据结构

公开站只读取 `data/amorist-data.json`。文件由 `editor.html` 中的“站点数据 → 导出公开数据 JSON”自动生成，不建议手工编辑内部存储字段。

```json
{
  "type": "amorist-public-data",
  "schemaVersion": 1,
  "exportedAt": "2026-07-21T00:00:00.000Z",
  "site": {
    "title": "HARU · Otome Life Archive",
    "description": "个人站介绍",
    "owner": "HARU"
  },
  "localStorage": {
    "amorist-profile-v1": "{...}",
    "amorist-game-library-v1": "[...]"
  }
}
```

`localStorage` 中的值保留为字符串，是为了兼容现有 Amorist 2.3 的数据读取逻辑。公开站通过只读虚拟存储层加载这些数据，不会读取或覆盖访客自己的浏览器记录。

## 可见性

数组或对象条目若包含：

```json
{ "visibility": "private" }
```

导出公开数据时会自动排除。未设置 `visibility` 的既有内容默认公开。
