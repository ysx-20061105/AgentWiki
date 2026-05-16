---
title: Harness Engineering（驾驭工程）
date: 2026-05-12
categories:
  - Agent
tags: ["AI", "Agent", "Harness", "驾驭工程", "LLM"]
summary: "Harness Engineering前沿概念，介绍如何为Agent构建可靠的运行时框架，实现安全可控的Agent执行环境。"
---

# Harness Engineering（驾驭工程）

## 一句话理解

> **Prompt Engineering 教模型"听话"，Context Engineering 给模型"信息"，Harness Engineering 给 Agent "一整套工作系统"。**
>
> 核心公式：**Agent = Model（大脑） + Harness（驾驭系统）**

---

## 什么是 Harness Engineering？

### 先讲一个故事

2026 年初，一个独立开发者想让 Claude Agent 帮他做一个复古游戏。他精心写了一个超级详细的 Prompt，只花了 9 美元，不到 10 分钟 Agent 就宣布"任务完成"。

结果呢？界面丑陋、功能残缺、bug 堆积——典型的"Agent 崩盘"。

同一个月，Anthropic 工程师团队用 Harness Engineering 做同样的任务：
- 用 Planner 把任务拆成 200 多个结构化子任务
- Generator 逐个实现
- Evaluator 严格验收
- 穿插 git checkpoint 和自动测试

6 小时后，一个完整、可玩、精美的游戏制作器上线。虽然花了 200 美元，但质量起飞，**零人工干预**。

**区别在哪？不是模型更强了，而是模型外面那套系统更完善了。** 这套系统，就叫 Harness。

### 正式定义

**Harness Engineering**（驾驭工程）是 2026 年初由 **Mitchell Hashimoto**（HashiCorp 联合创始人、Terraform 创建者）提出，随后被 **OpenAI**、**Anthropic**、**Martin Fowler** 等行业领袖广泛采纳的 AI 工程新范式。

Mitchell Hashimoto 的原始定义非常朴素：

> **"每当 AI 犯错，就工程化一个方案让它永远不再犯同样的错。"**
> "Every time you find an agent makes a mistake, you take the time to engineer a solution such that the agent never makes that mistake again."

这些方案的总和，就是 **Harness**。

---

## 先搞懂 "Harness" 这个词

Harness 的本意是**马具**——套在马身上、把马的力量导向特定方向的装备。

```
想象一下：

🐴 一匹野马 = 裸模型（GPT / Claude / Gemini）
  → 力量很强，但方向不可控，可能跑偏、撞墙

🐴 + 🎽 马具（Harness）= 装配好的 Agent
  → 绷绳、马鞍、缰绳 → 引导力量，安全到达目的地

关键洞察：
  马具不是为了限制马的速度
  而是为了让马的力量用在正确的地方
```

另一个类比：

```
🧠 模型 = CPU（中央处理器）
  → 负责推理和决策

💻 Harness = 操作系统（OS）
  → 管理内存、调度任务、控制权限、隔离风险

没有 OS 的 CPU 就是一块硅片
没有 Harness 的模型 就是一个聊天机器人
```

---

## 为什么需要 Harness Engineering？

### 三次范式演进

```
┌───────────────────────────────────────────────────────────┐
│  Prompt Engineering（2023）                                │
│  核心问题：怎么问问题？                                      │
│  人类角色：提问者                                           │
│  局限：只管单次输入，不管执行过程                              │
├───────────────────────────────────────────────────────────┤
│  Context Engineering（2025）                               │
│  核心问题：模型应该看到什么？                                 │
│  人类角色：信息架构师                                       │
│  局限：只管信息环境，不管执行环境                              │
├───────────────────────────────────────────────────────────┤
│  Harness Engineering（2026）⭐                             │
│  核心问题：整个工作环境应该如何运作？                          │
│  人类角色：环境设计师                                       │
│  覆盖：约束 + 工具 + 反馈 + 验证 + 安全 + 生命周期            │
└───────────────────────────────────────────────────────────┘
```

### 看一张对比表

| 维度 | Prompt Engineering | Context Engineering | **Harness Engineering** |
|------|-------------------|--------------------|-----------------------|
| **关注点** | 一句话怎么写 | 信息怎么组织 | **整个系统怎么运转** |
| **核心对象** | 提示词 | 上下文 | **Agent 的完整运行环境** |
| **控制范围** | 输入端 | 信息端 | **全链路（输入→执行→输出→反馈）** |
| **类比** | 写好一封信 | 设计邮件系统 | **设计整个公司的运营体系** |
| **关系** | 子集 | 更大的子集 | **终极形态** |

**关系图**：

```
┌─────────────────────────────────────────────────┐
│         Harness Engineering（全集）              │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │     Context Engineering（子集）            │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │   Prompt Engineering（子子集）       │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │  + RAG、Memory、Tools                     │  │
│  └───────────────────────────────────────────┘  │
│  + 反馈闭环（Lint、测试、CI/CD）                  │
│  + 约束系统（权限、格式、行为边界）                │
│  + 规划引擎（任务拆解、依赖管理）                  │
│  + 观测系统（日志、追踪、监控）                   │
│  + 安全防护（沙箱、注入防御）                     │
│  + 生命周期管理（版本、部署、迭代）               │
└─────────────────────────────────────────────────┘
```

---

## 核心公式

### Agent = Model + Harness

这是 Harness Engineering 最核心的公式：

```
┌──────────────────────────────────────────────┐
│                   Agent                      │
│                                              │
│   ┌──────────┐    +    ┌──────────────┐     │
│   │  Model   │         │   Harness    │     │
│   │  (大脑)   │         │  (驾驭系统)   │     │
│   │          │         │              │     │
│   │ • 推理    │         │ • 约束规则    │     │
│   │ • 规划    │         │ • 工具系统    │     │
│   │ • 决策    │         │ • 反馈闭环    │     │
│   │ • 理解    │         │ • 记忆管理    │     │
│   │          │         │ • 安全防护    │     │
│   └──────────┘         │ • 观测监控    │     │
│                        └──────────────┘     │
└──────────────────────────────────────────────┘
```

### Harness 的五大组成部分

```
Harness = Tools + Knowledge + Observation + Action + Permissions

📦 Tools（工具）     → 给模型"双手"：文件读写、Shell 执行、API 调用
📚 Knowledge（知识） → 给模型"经验"：文档、规范、架构设计、代码风格
👁️ Observation（观察）→ 给模型"眼睛"：Git 变更、错误日志、环境状态
⚡ Action（执行接口） → 给模型"行动通道"：CLI 命令、API 调用、UI 交互
🔒 Permissions（权限）→ 给模型"边界"：沙箱隔离、危险操作拦截、人审批流
```

---

## Martin Fowler 的三大支柱

**Martin Fowler**（《重构》作者、敏捷宣言签署人）在 2026 年跟进写了深度分析文章，将 Harness 归纳为三个核心支柱：

```
┌─────────────────────────────────────────────────┐
│              Harness 的三大支柱                   │
│                                                 │
│  ┌─────────────┐                                │
│  │  Guides     │  ① 前馈控制（任务前的约束注入）  │
│  │  (引导)      │     System Prompt、Rules、      │
│  │             │     SKILL.md、文档结构           │
│  └─────────────┘                                │
│                                                 │
│  ┌─────────────┐                                │
│  │  Sensors    │  ② 反馈控制（任务后的验证纠正）  │
│  │  (感知)      │     Linter、测试、CI/CD、       │
│  │             │     自动评分、错误检测            │
│  └─────────────┘                                │
│                                                 │
│  ┌─────────────┐                                │
│  │  Context    │  ③ 上下文工程（信息环境管理）    │
│  │  (上下文)    │     RAG、Memory、动态信息注入    │
│  │             │     你已有的知识！               │
│  └─────────────┘                                │
└─────────────────────────────────────────────────┘
```

用大白话说：

| 支柱 | 干什么 | 你的比喻 |
|------|--------|---------|
| **Guides（前馈）** | 任务开始前，告诉 Agent "你应该怎么做" | 员工入职培训 |
| **Sensors（反馈）** | 任务完成后，检查 Agent "做得对不对" | 绩效考核 |
| **Context（上下文）** | 执行过程中，提供 Agent "需要知道的信息" | 工作资料库 |

---

## Harness 的核心组件详解

### ① 约束系统（Constraints）

给 Agent 设定**行为边界**：

```yaml
# 示例：AGENTS.md 中的约束规则
constraints:
  - 代码风格必须通过 ESLint 检查
  - 每次修改不超过 50 行
  - 禁止直接修改 config 目录
  - 所有数据库操作必须有回滚方案
  - 新增 API 必须写单元测试
```

**为什么重要**：模型越"聪明"，越容易"飘"——自以为完美，实际留下烂摊子。约束就是防止它跑偏的缰绳。

### ② 工具系统（Tools）

给 Agent 配备**完整的工具箱**：

```
基础工具：
  📖 Read    → 读取文件
  ✏️ Write   → 写入文件
  🔧 Edit    → 精确编辑
  💻 Bash    → 执行命令

高级工具：
  🔍 WebSearch  → 搜索网络
  🧪 LSP        → 代码智能分析
  🖥️ Computer   → 操控桌面（Computer Use）
  📡 MCP        → 连接外部服务
```

工具的三个设计原则：
1. **原子化**：每个工具做一件小事
2. **可组合**：工具之间可以串联
3. **可描述**：模型能理解每个工具的用途

### ③ 反馈闭环（Feedback Loop）

Agent 每执行一步，Harness 自动验证：

```
Agent 输出代码
    │
    ▼
┌─────────────────────────┐
│  Harness 自动验证层      │
│                         │
│  ✓ Lint 检查（格式）     │
│  ✓ 类型检查（TypeScript）│
│  ✓ 单元测试（功能）      │
│  ✓ 集成测试（协作）      │
│  ✓ 安全扫描（漏洞）      │
└─────────┬───────────────┘
          │
     通过？ ── 是 ──→ 继续下一步
          │
          否
          │
          ▼
   错误信息反馈给 Agent
   Agent 自我修正 → 重新执行
```

**这就是 Mitchell Hashimoto 说的**："每当犯错，就工程化一个方案让它不再犯"——每次错误都会被转化为一条新的验证规则。

### ④ 记忆系统（Memory）

参考 8.Agent Memory，Harness 中的记忆管理更加系统化：

| 记忆类型 | 作用 | 工程实现 |
|----------|------|---------|
| **工作记忆** | 当前任务的中间状态 | Context Window |
| **短期记忆** | 本轮对话历史 | 滑动窗口 + 压缩 |
| **长期记忆** | 跨会话的知识积累 | MEMORY.md / 向量数据库 |
| **任务记忆** | 任务进度和依赖 | TASK.md 文件 |

### ⑤ 规划引擎（Planning）

把复杂任务拆解为可管理的子任务：

```
用户需求："给这个项目加一个用户认证系统"
    │
    ▼
┌─────────────────────────────────┐
│  规划引擎自动拆解               │
│                                 │
│  1. 分析项目架构                │
│  2. 设计认证方案（JWT / Session）│
│  3. 创建数据库迁移              │
│  4. 实现注册接口                │
│  5. 实现登录接口                │
│  6. 添加中间件保护路由          │
│  7. 编写测试                    │
│  8. 更新文档                    │
└─────────────────────────────────┘
```

### ⑥ 观测系统（Observability）

Agent 的行为全程可追踪：

```
📊 日志：每一步做了什么决策
📈 指标：Token 消耗、执行时间、成功率
🔗 链路追踪：一个任务经过了哪些步骤
⚠️ 告警：异常行为自动告警
```

---

## Agent Loop：Harness 的核心运转机制

Harness 控制下的 Agent 运行遵循一个**四步循环**：

```
    ┌────────────────────────────────────────────────┐
    │                                                │
    ▼                                                │
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  观察    │ →  │  思考    │ →  │  行动    │ →  │  验证    │
│ Observe │    │  Think  │    │  Act    │    │ Verify  │
└─────────┘    └─────────┘    └─────────┘    └────┬────┘
                                                  │
    Harness 负责：                                 │
    • 精准选择观察信息     • 约束输出格式     • 安全检查    • 自动测试
    • 避免上下文污染       • 强制结构化       • 权限验证    • 质量校验
                                                  │
                                                  │
                                         失败？←──┘
                                          │
                                          ▼
                                    反馈给模型
                                    自我修正
                                    重新循环
```

每一步 Harness 都在控制节奏、边界、安全和质量，模型只需要专注于它最擅长的事：**推理和决策**。

---

## 标志性实验：Harness 的威力

### 实验 1：OpenAI Codex 团队（2026.02）

这是 Harness Engineering 最震撼的实践案例：

```
📋 实验条件：
  • 团队：3 名工程师（后扩展到 7 人）
  • 时间：5 个月
  • 规则：完全禁止手写代码

🎯 结果：
  • 产出：超过 100 万行生产级代码
  • 人工代码量：0 行（所有代码由 Codex Agent 生成）
  • 合并：约 1500 个 Pull Request
  • 效率：每人每天约 3.5 个 PR（传统方式的 10 倍）

💡 工程师做了什么？
  → 不写代码，只设计 Harness
  → 定义 AGENTS.md（行为约束）
  → 设置架构规则和 linter
  → 构建反馈闭环和自动修复机制
  → 采用"先合并后修复"策略（Wolf Wiggum Loop）
```

### 实验 2：LangChain 的逆袭

同一个模型，只换 Harness，效果天差地别：

```
📊 Terminal Bench 2.0 排行榜：

  修改前：52.8% 得分 → 排名 Top 30
  修改后：66.5% 得分 → 排名 Top 5

  模型完全一样！只是 Harness 改善了
  → 排名飙升 25 位
```

**核心洞察**：当模型之间的差距越来越小时，**Harness 才是真正的差异化竞争力**。

---

## 对比：三种工程范式

| 维度 | 传统软件工程 | Prompt Engineering | **Harness Engineering** |
|------|------------|-------------------|-----------------------|
| **核心执行者** | 人类 | 人类 + LLM 辅助 | **LLM 为主，人类设计环境** |
| **核心工作** | 人类写每一行代码 | 优化提示词引导 LLM | **设计 AI 的工作环境、约束、反馈** |
| **控制方式** | 人类直接控制每个细节 | 只控制输入，无法控制执行 | **全链路控制执行、权限、质量** |
| **可靠性** | 高（完全人工控制） | 很低（不可控、幻觉多） | **高（有约束、有验证、有保障）** |
| **可扩展性** | 低（人力有上限） | 低（Prompt 无法适配复杂场景） | **高（一套 Harness 适配多任务）** |
| **人类产出** | 代码 | 提示词 | **约束系统和环境配置** |

一句话总结：
- **传统工程**：人是代码生产者
- **Prompt Engineering**：人是提示词优化师
- **Harness Engineering**：人是 AI 环境设计师

---

## 工程师的角色转变

```
旧世界（2023 年之前）：
  工程师 = 码农
  产出 = 代码
  价值 = 写代码的速度和质量

新世界（2026 年之后）：
  工程师 = Harness 设计师
  产出 = 约束系统（AGENTS.md、架构规则、linter、反馈闭环）
  价值 = 让 AI 可靠、安全、高效地工作
```

Harness 工程师的不可替代价值：

```
  🎯 定义 AI 的目标和边界
  🏗️ 构建 AI 的工作环境和工具系统
  🔄 设计 AI 的反馈闭环和质量门禁
  🔒 控制 AI 的安全和权限
  📊 将 AI 的智能落地到真实业务场景
```

---

## 与你已有知识的关系

你在之前的笔记中学到的很多内容，其实就是 Harness 的组成部分：

```
你学过的 2.Prompt工程     →  Harness 的"Guides（前馈）"子集
你学过的 9.Context Engineering  →  Harness 的"Context（上下文）"子集
你学过的 5.MCP / 11.tool   →  Harness 的"工具层"
你学过的 8.Agent Memory    →  Harness 的"记忆系统"
你学过的 4.Skills          →  Harness 的"技能封装"
你学过的 14.SubAgent       →  Harness 的"任务拆解"
你学过的 12.Agent Skills   →  Harness 的"能力模块"

Harness Engineering = 把以上所有组件系统化地组合成一个完整工程体系！
```

---

## 实际上手：Harness 的三层成长路径

### 第一层：基础 Harness（让 Agent 跑起来）

> 最小可用的 Harness，就是你已经学过的内容！

```
Agent Loop（感知→思考→行动→反馈）
  + 4 个基础工具（Read、Write、Edit、Bash）
  + 简单的 System Prompt
  = 一个能工作的 Agent！
```

你用 Claude Code 就是在体验基础 Harness：
- 它能读写文件 → 工具
- 它遵守你的指令 → 约束
- 它能看到项目结构 → 观察
- 它能执行命令并看结果 → 反馈

### 第二层：约束与安全（防止 Agent 跑偏）

```
基础 Harness
  + SubAgent（任务拆解，避免上下文污染）
  + Skills（封装高频操作，减少幻觉）
  + 上下文压缩（支持长对话）
  + 任务持久化（断线恢复）
  = 更稳定的 Agent！
```

### 第三层：生产级质量（稳定可扩展）

```
约束层 Harness
  + 后台任务（耗时操作异步执行）
  + 多 Agent 团队（并行协作）
  + 工作区隔离（每个任务独立环境）
  + 完整的监控和日志
  = 生产级 Agent 系统！
```

---

## 常见误区

| 误区 | 正确理解 |
|------|---------|
| "Harness 就是 System Prompt" | System Prompt 只是 Harness 的一小部分（前馈中的一个） |
| "Harness 会限制模型能力" | 恰恰相反，Harness 让模型能力**稳定释放**，就像马具让马跑得更快更安全 |
| "模型够强就不需要 Harness" | OpenAI 和 Anthropic 的实验都证明：**模型越强，Harness 越重要**（强模型更容易"自以为是"） |
| "Harness 很复杂，初学者学不了" | 你已经在学了！Prompt、Tool Use、Memory、Skills 都是 Harness 的组件 |
| "Prompt Engineering 过时了" | 没有过时，它是 Harness 的一个**子集**，依然重要 |

---

## 关键要点总结

1. **核心公式**：Agent = Model（大脑） + Harness（驾驭系统）
2. **朴素定义**：每当 AI 犯错，就工程化一个方案让它不再犯
3. **三大支柱**：Guides（前馈约束） + Sensors（反馈验证） + Context（上下文管理）
4. **五大组件**：约束 + 工具 + 反馈 + 记忆 + 权限
5. **工程师新角色**：从"写代码的人"变成"设计 AI 工作环境的人"
6. **竞争壁垒**：模型能力趋同时，Harness 才是真正的差异化竞争力
7. **渐进式构建**：从基础 Agent Loop 开始，逐步添加约束、反馈、安全
8. **本质**：不是又一个 Prompt 技巧，而是**把 AI 从 Demo 变成生产系统的工程方法论**

---

## 术语速查表

| 英文术语 | 中文翻译 | 含义 |
|----------|---------|------|
| Harness | 驾驭层/驾驭系统 | 模型之外的完整运行环境 |
| Harness Engineering | 驾驭工程 | 设计和构建 Harness 的工程实践 |
| Feedforward（Guides） | 前馈控制 | 任务前注入的约束和规则 |
| Feedback（Sensors） | 反馈控制 | 任务后的验证和纠正 |
| AGENTS.md | 智能体配置文件 | 定义 Agent 行为约束的文件 |
| Wolf Wiggum Loop | 狼威格循环 | OpenAI 的"先合并后修复"策略 |
| Agent Loop | 智能体循环 | 感知→思考→行动→验证的循环 |
| Context Compaction | 上下文压缩 | 自动清理无效上下文 |

---

## 参考资料

### 核心文献

- [Mitchell Hashimoto - My AI Adoption Journey（首创术语）](https://mitchellh.com/writing/my-ai-adoption-journey)（2026.02.05）
- [OpenAI - Engineering: Leveraging Codex in an Agent-First World](https://openai.com/index/engineering/)（2026.02.11）
- [Martin Fowler - Harness Engineering for Coding Agent Users](https://martinfowler.com/articles/harness-engineering.html)（2026.02）

### 深度解析

- [Harness Engineering 深度分析报告](https://wujiaming88.github.io/2026/03/26/harness-engineering-deep-analysis.html)
- [Harness Engineering 深度解析：AI Agent 时代的工程范式革命](https://zhuanlan.zhihu.com/p/2014014859164026634)
- [一文读懂 Harness Engineering](https://www.toutiao.com/article/7623600589453001256/)
- [2026 AI 新技能：Harness Engineering——让 Agent 从"聪明"变成"可靠"](https://blog.csdn.net/qq_45257495/article/details/159987229)

### 行业跟进

- [LangChain - The Anatomy of an Agent Harness](https://blog.langchain.dev/)
- [Anthropic - Building Effective Agents](https://docs.anthropic.com/en/docs/build-with-claude/agents)
- [Thoughtworks - Harness Engineering 技术雷达分析](https://www.thoughtworks.com/radar)
