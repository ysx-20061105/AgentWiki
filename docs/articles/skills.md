---
title: 
date: 2026-05-04
categories:
  - Agent
tags: ["智能体", "Claude-Code", "Skills"]
summary: "介绍Agent Skills的概念，即Agent可调用的能力模块，包括技能定义、注册和调用机制。"
---

# Skills 

## 什么是 Skills？

Skills 是 Claude Code 的**可复用能力模块**。它们通过一组指令和（可选的）脚本，为 Claude 增加**特定领域的知识和操作能力**。

简单理解：
- **没有 Skill** = Claude 只是一个通用助手
- **有 Skill** = Claude 变成了某个领域的专家（新闻爬取、代码审查、数据分析……）

### 核心特点

| 特点       | 说明                                     |
| -------- | -------------------------------------- |
| **声明式**  | 用一个 `SKILL.md` 文件定义，Markdown + YAML 格式 |
| **可复用**  | 放在项目级或用户级目录，跨项目复用                      |
| **可组合**  | 一个 skill 可包含指令 + 脚本 + 参考资料             |
| **自动触发** | Claude 根据 skill 的 description 自动判断是否激活 |
| **手动触发** | 用户也可通过 `/skill-name` 显式调用              |

---

## Skills 的目录结构

### 存放位置

Skills 放在 `.claude/skills/` 目录下，每个 skill 一个子文件夹：

```
.claude/skills/
├── news-extractor/          # 你已有的 skill
│   ├── SKILL.md             # ⭐ 核心定义文件（必须有）
│   ├── scripts/             # 可选：配套脚本
│   │   └── extract_news.py
│   └── references/          # 可选：参考资料
│       └── platform-patterns.md
├── another-skill/
│   ├── SKILL.md
│   └── ...
```

### 两级存放

| 级别 | 路径 | 用途 |
|------|------|------|
| **项目级** | `.claude/skills/` | 仅当前项目可用，适合团队共享 |
| **用户级** | `~/.claude/skills/` | 所有项目可用，适合个人复用 |

---

## SKILL.md 文件详解

这是 skill 的**核心文件**，由两部分组成：

### 1. YAML Frontmatter（元数据）

```yaml
---
name: skill-name                    # skill 名称（用作 /skill-name 调用）
description: 描述这个 skill 做什么   # Claude 用来判断是否触发
context: fork                       # 可选：运行上下文模式
agent: agent-type                   # 可选：指定使用的 agent 类型
---
```

**关键字段说明：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | skill 的唯一名称，也用作斜杠命令 |
| `description` | ✅ | **触发关键词**——Claude 根据它判断何时激活此 skill |
| `context` | ❌ | `fork`（隔离上下文）或 `main`（共享主上下文），默认 `main` |
| `agent` | ❌ | 指定执行此 skill 的 agent 类型 |

> **description 是最重要的字段**——它决定了 skill 何时被激活。写得越准确，触发越精准。

### 2. Markdown Body（指令内容）

```markdown
# Skill 标题

## 支持的功能
...

## 使用方式
...

## 工作流程
...

## 使用示例
...
```

这部分是给 Claude 看的**操作指南**，告诉它：
- 这个 skill 能做什么
- 怎么做（步骤）
- 配套脚本怎么用
- 输出什么格式

---

## 如何制作一个 Skill

### 步骤 1：创建目录

```bash
mkdir -p .claude/skills/my-skill
```

### 步骤 2：编写 SKILL.md

```markdown
---
name: my-skill
description: 当用户需要做 XXX 时激活此 skill。支持 YYY 和 ZZZ。
---

# My Skill

## 功能说明
这个 skill 用来……

## 使用方式
1. 第一步……
2. 第二步……

## 使用示例
具体的使用案例……
```

### 步骤 3（可选）：添加脚本和资源

如果 skill 需要执行代码：

```
.claude/skills/my-skill/
├── SKILL.md
├── scripts/
│   └── main.py
├── references/
│   └── api-docs.md
└── pyproject.toml    # 如果用 Python + uv 管理依赖
```

### 步骤 4：测试

在对话中用 `/my-skill` 测试，或让 Claude 根据 description 自动触发。

---

## 实战案例：news-extractor Skill 分析

你已有的 `news-extractor` 是一个完整的 skill 示例：

```
.claude/skills/news-extractor/
├── SKILL.md              # 定义文件
├── scripts/              # Python 爬虫脚本
│   └── extract_news.py
└── references/           # 平台 URL 模式参考
    └── platform-patterns.md
```

### Frontmatter 解析

```yaml
---
name: news-extractor
description: 新闻站点内容提取。支持微信公众号、今日头条……当用户需要提取新闻内容……时激活。
context: fork              # 在隔离上下文中运行，不影响主对话
agent: news-extractor      # 使用专门的 agent
---
```

### 设计要点

1. **description 精准触发**：列出了所有支持的平台和常见需求表述
2. **context: fork**：爬取操作在隔离环境中执行，避免污染主对话上下文
3. **配套脚本**：用 Python 实现实际的抓取逻辑，skill 本身只描述「怎么做」
4. **输出格式明确**：定义了 JSON 和 Markdown 两种输出格式
5. **错误处理完善**：文档中列出了常见错误和解决方案

---

## Skills 的触发机制

```
用户输入
   ↓
Claude 分析需求
   ↓
匹配 skill description？
   ├── 是 → 激活对应 skill → 按 SKILL.md 指令执行
   └── 否 → 使用通用能力回答
```

### 手动触发

```
/skill-name          # 显式调用某个 skill
/news-extractor      # 例如：调用新闻提取 skill
```

### 自动触发

当用户说的话匹配 skill 的 `description` 时，Claude 会自动识别并激活。例如：
- "帮我提取这篇公众号文章" → 自动触发 `news-extractor`
- "把这篇文章保存下来" → 自动触发 `news-extractor`

---

## Skills 与其他概念的关系

```
Claude Code
├── CLAUDE.md          → 全局/项目级指令（始终生效）
├── Agents             → 子代理（处理子任务）
├── Skills ⭐          → 可复用能力模块（按需触发）
│   ├── SKILL.md       → 定义文件
│   ├── scripts/       → 配套脚本
│   └── references/    → 参考资料
└── MCP Tools          → 外部工具集成
```

| 概念 | 作用 | 触发方式 |
|------|------|----------|
| **CLAUDE.md** | 始终生效的行为准则 | 自动加载 |
| **Agent** | 处理特定类型子任务 | 由 Claude 调度 |
| **Skill** ⭐ | 预定义的领域能力包 | 需求匹配或 `/skill-name` |
| **MCP Tool** | 外部服务的接口 | 工具调用 |

---

## 最佳实践

### Description 编写技巧

```
❌ 差的 description：一个有用的工具
✅ 好的 description：新闻站点内容提取。支持微信公众号、今日头条、网易新闻。
   当用户需要提取新闻内容、抓取公众号文章、爬取新闻时激活。
```

- 列出**具体支持的场景**
- 使用用户**可能会说的关键词**
- 说明**何时应该激活**

### SKILL.md 编写原则

1. **结构清晰**：用标题组织，Claude 靠结构理解指令
2. **步骤具体**：告诉 Claude 具体怎么做，而不是笼统地说「做某事」
3. **有示例**：给出输入/输出示例，Claude 能更好地对齐预期
4. **处理边界情况**：列出可能的错误和解决方案

### 脚本管理

- 推荐用 `uv` + `pyproject.toml` 管理 Python 依赖
- 脚本用 `uv run` 执行，自动使用项目虚拟环境
- 保持脚本独立，不要依赖系统全局环境

---

## 快速上手模板

创建新 skill 时，复制以下模板：

```markdown
---
name: my-new-skill
description: 简短描述。当用户需要 XXX、YYY 时激活。
context: fork
---

# My New Skill

简要说明这个 skill 做什么。

## 支持的功能

- 功能 1
- 功能 2

## 使用方式

### 基本用法
\`\`\`bash
# 具体命令
\`\`\`

### 使用示例
给出一个完整的使用案例。

## 输出格式

说明输出的格式和结构。

## 注意事项

- 注意事项 1
- 注意事项 2
```

---

## 参考

- Anthropic 官方文档：[Claude Code Skills](https://docs.anthropic.com/en/docs/claude-code/skills)
- new-extractor: [new-extractor](https://github.com/ysx-20061105/rag-agent-proto/tree/main/.claude/skills/news-extractor) or [new-extractor](https://github.com/NanmiCoder/skills-agent-proto/tree/main/.claude/skills/news-extractor)
