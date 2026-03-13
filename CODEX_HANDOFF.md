# 双选小程序项目交接文档（给下一位 Codex）

> 目的：你新开聊天后，把这份文档直接上传给新的 Codex，它可以快速接手，不会再“忘项目”。

## 1. 项目核心目标（业务）

这是一个**导师-学生双选系统**，当前重点是“**按类型（track）管理指标**”，并且支持三级专业层级（一级/二级/三级）。

关键业务要求：
1. 逻辑表（`Logic`）决定有哪些专业+类型组合（例如全日制/联培/非全日制/士兵，且可扩展，不限四类）。
2. 指标分配、审批、监控看板、学生选择都必须按 `code + track` 工作。
3. 学生可见导师按钮与可选范围，必须遵循逻辑表和逐级前缀匹配（level3 -> level2 -> level1）。
4. 非全/联培/士兵不是每个专业都有，必须“只按 logic 中存在的组合展示和计算”。

---

## 2. 当前数据模型与关键集合

### 2.1 Teacher
核心是 `quota_settings` 数组，每条包含：
- `type`: `level1|level2|level3`
- `code`: 专业代码（字符串，必须保留前导0）
- `name`: 专业名称
- `track`: 类型（建议中文原值，如“全日制/联培/非全日制/士兵/其他”）
- `max_quota`
- `pending_quota`
- `used_quota`

### 2.2 Logic
每行应有：
- `level1_name`, `level1_code`
- `level2_name`, `level2_code`
- `level3_name`, `level3_code`
- `track`

### 2.3 TotalQuota
按层级存总池：
- `level1_quota`
- `level2_quota`
- `level3_quota`

并且键已迁移为优先 `code__track`（兼容旧键 `code` 的兜底读取仍存在于部分页面/逻辑）。

---

## 3. 已完成的迁移方向（阶段性成果）

1. 从大量硬编码字段迁移到 `quota_settings`。
2. 云函数侧多个流程已 track-aware：
   - `importLogic`
   - `importStudents`
   - `importTeacher`
   - `parseExcel`
   - `exportQuotaTemplate`
   - `getPendingChanges`
   - `getTeachersBySpecialty`
3. 前端多个页面已改造为 `code__track` 维度显示/审批/扣减：
   - `pages/admin`
   - `pages/Tec`
   - `pages/details`
   - `pages/information`
   - `pages/Review_s`
   - `pages/land`

---

## 4. 用户最近反复强调的“不可偏离”规则

1. `track` 就是“类型”，不是固定 regular/joint/parttime/soldier 枚举。
2. 应尽量保留 logic 表中的中文类型原值；不要把“士兵”归并成 regular。
3. 看板必须按“一级学科 + 类型”分组：
   - 工学（全日制）
   - 工学（联培）
   - 工学（非全日制）
   - 理学（全日制）
   - ……
4. 每个分组下面都要有自己的一级/二级/三级树，不允许混到一起。
5. 只显示 logic 里存在的组合，不自动脑补不存在的类型。

---

## 5. 最近已修过的两个高频问题（给下一位 Codex）

### 5.1 二级展开不到三级
原因：看板树排序曾按“代码长度优先”，导致父子不连续，展开算法（依赖连续前缀）失效。

处理方向：同一 root+track 内按代码前缀顺序连续排列，确保 `08 -> 0808 -> 080800` 相邻。

### 5.2 控制工程（联培/非全）在监控看板漏显示
高概率原因：Logic 导入后代码前导0丢失（如 `0854` 变 `854`），导致 root 分组错位。

处理方向：看板装配数据时，对 level1/2/3 code 做层级修复（按预期长度与前缀补零），再参与分组与渲染。

---

## 6. 下一位 Codex 建议先做的核对清单

1. 用数据库抽样确认 Logic 是否存在数值化 code（`854/85400` 这类）。
2. 在 admin 看板验证以下场景：
   - 工学（全日制/联培/非全）都在。
   - 控制工程（联培/非全）出现且可展开三级。
   - 理学只显示 logic 中存在的类型。
3. 验证导师端审批后：
   - `pending_quota -> max_quota` 变动按 `code+track` 落地。
4. 验证学生端选择按钮：
   - 仅展示其可选 track；
   - 逐级前缀查找也按 track 过滤。

---

## 7. 我建议你新会话第一条就贴给 Codex 的话术

可直接复制下面这段：

> 请先阅读我上传的 `CODEX_HANDOFF.md`，严格按其中“不可偏离规则”执行。先不要大改，先复盘 `Logic/TotalQuota/Teacher.quota_settings` 的 `code+track` 一致性，再给我一个“最小修复计划 + 验证步骤”。

---

## 8. 交接备注

- 这项目需求迭代快、口径容易漂移；下一位 Codex 必须“以用户最近口头规则优先”。
- 若再次出现“显示缺项”，优先排查：
  1) 代码前导0丢失；
  2) track 被错误归一化；
  3) 看板分组键是否真正是 `root+track`；
  4) 去重键是否包含 `type+code+track`。

