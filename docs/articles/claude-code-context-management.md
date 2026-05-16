---
title: "Claude Code 上下文管理"
date: 2026-05-12
categories:
  - Agent实践
tags: ["Claude-Code", "Agent", "上下文管理", "学习笔记"]
summary: "Claude Code上下文管理完全指南，涵盖五层上下文架构、四层渐进式压缩机制、CLAUDE.md最佳实践及会话管理策略。"
---

# Claude Code 上下文管理

> **核心一句话**：上下文压缩的目标不是删历史，而是把细节移出活跃上下文，同时保住工作连续性。

## 为什么需要上下文管理？

Claude Code 的上下文窗口默认是 **200K tokens**（可通过 `opus[1m]` / `sonnet[1m]` 扩展到 1M）。听起来很多，但在实际编程中消耗惊人：

| 内容类型           | Token 消耗      |
| -------------- | ------------- |
| 一次 `grep` 搜索结果 | 可达数万 tokens   |
| 读取一个大文件        | 轻松消耗几万 tokens |
| 反复的改代码→报错→再改   | 每轮都在膨胀        |
| 系统提示词 + 工具定义   | 固定占用一部分       |

**如果不治理，上下文窗口很快就会被撑满，模型开始「说胡话」甚至直接报错。**

---

## 一、Claude Code 的多层上下文架构

### 1.1 每次请求的上下文结构（五层拼装）

Claude Code 每次发送给 API 的请求，**不是简单的对话历史**，而是由五层精心设计的内容拼装而成：

```
┌─────────────────────────────┐
│  Layer 1: 系统提示层          │  ← 身份标识、固定指令、动态上下文
├─────────────────────────────┤
│  Layer 2: 工具定义层          │  ← 可用工具及其参数规范
├─────────────────────────────┤
│  Layer 3: 用户上下文层        │  ← CLAUDE.md 等会话特定信息
├─────────────────────────────┤
│  Layer 4: 消息历史层          │  ← 完整的对话和工具调用过程（膨胀主因！）
├─────────────────────────────┤
│  Layer 5: 附件层              │  ← 动态加载的补充信息
└─────────────────────────────┘
```

> **关键洞察**：系统提示中的静态部分可以跨请求缓存（Prompt Cache 省钱），动态部分保持灵活。消息历史里的**工具结果**是 token 膨胀的主要来源。

### 1.2 四层渐进式压缩架构

Claude Code 的压缩不是「满了就删」，而是**四层渐进式防御**——就像城市的垃圾处理系统：

```
┌──────────────────────────────────────────────────────┐
│ Layer 1: MicroCompact（微压缩）      ← 日常保洁       │
│ 零成本，清理过期的工具返回内容                          │
├──────────────────────────────────────────────────────┤
│ Layer 2: Session Memory（会话记忆）  ← 定期回收       │
│ 后台维护笔记，零 LLM 调用替代方案                      │
├──────────────────────────────────────────────────────┤
│ Layer 3: Full Compact（完整压缩）    ← 深度处理       │
│ 调用 LLM 生成对话摘要，重建历史                        │
├──────────────────────────────────────────────────────┤
│ Layer 4: PTL Retry（兜底截断）       ← 紧急应急       │
│ 摘要调用本身超限时的最后手段                           │
└──────────────────────────────────────────────────────┘
```

> **后层总是在前层已发生或不够用时才介入。** 每层有独立的触发条件和影响范围。

---

## 二、MicroCompact 机制（最轻量的日常清理）

### 2.1 是什么？

MicroCompact 是**最轻量级**的压缩方式，**不改变对话结构**，只清除过期的工具返回内容（如文件读取结果、Shell 输出、Grep 搜索结果等）。

> 想象你让 Claude 读了 20 个文件，但真正决定逻辑的只有 3 个。MicroCompact 就是把那 17 个旧文件内容替换成占位符。

### 2.2 三条执行路径

MicroCompact 有三条路径，根据情况选择：

#### 路径 A：时间间隔清理（Time-Based）

| 项目       | 说明                                       |
| -------- | ---------------------------------------- |
| **触发条件** | 距上次 assistant 消息 **> 60 分钟**             |
| **清理对象** | 旧工具结果的**内容体**                            |
| **操作**   | 替换为 `[Old tool result content cleared]`  |
| **关键细节** | 只清理内容体，**保留工具调用的结构记录**（知道调用过什么，但不保留详细输出） |
| **成本**   | 零（不需要 API 调用）                            |

#### 路径 B：缓存模式（Cached MC）

| 项目       | 说明                                      |
| -------- | --------------------------------------- |
| **触发条件** | 检测到缓存压力                                 |
| **操作**   | 利用 API 的 `cache_edits` 指令进行**虚拟清理**     |
| **关键细节** | 本地历史**不变**，不破坏 Prompt Cache             |
| **本质**   | 「虚拟压缩」——本地消息历史不变，只是在服务端精准删除旧工具结果，保留缓存前缀 |

#### 路径 C：API 管理路径

| 项目 | 说明 |
|-----|------|
| **操作** | 使用 `clear_tool_uses` / `clear_thinking` |
| **清理对象** | 非近期的工具调用和思考块 |

### 2.3 可以清理哪些工具？

```typescript
const COMPACTABLE_TOOLS = new Set([
  FILE_READ_TOOL_NAME,    // 文件读取
  SHELL_TOOL_NAMES,       // Shell 命令输出
  GREP_TOOL_NAME,         // 搜索结果
  GLOB_TOOL_NAME,         // 文件匹配结果
  WEB_SEARCH_TOOL_NAME,   // 网络搜索
  FILE_EDIT_TOOL_NAME,    // 文件编辑（编辑结果）
  FILE_WRITE_TOOL_NAME,   // 文件写入（写入结果）
])
```

### 2.4 最小实现教学版

```python
KEEP_RECENT_TOOL_RESULTS = 3  # 只保留最近 3 个工具结果的完整内容

def micro_compact(messages: list) -> list:
    tool_results = collect_tool_result_blocks(messages)
    if len(tool_results) <= KEEP_RECENT_TOOL_RESULTS:
        return messages

    # 更旧的改成占位提示
    for _, _, block in tool_results[:-KEEP_RECENT_TOOL_RESULTS]:
        content = block.get("content", "")
        if not isinstance(content, str) or len(content) <= 120:
            continue
        block["content"] = "[Earlier tool result compacted. Re-run the tool if you need full detail.]"
    return messages
```

> **核心思想**：不是所有历史都要原封不动地一直带着跑。保留最近 3 个工具结果完整，更旧的替换成占位符。

### 2.5 压缩效果

- **压缩率**：中等（保留对话结构，清除工具输出）
- **用户感知**：无感
- **代价**：几乎为零（不需要额外 API 调用）

---

## 三、Session Memory 机制（零 LLM 调用的轻量替代方案）

### 3.1 是什么？

Session Memory 是**一种无需 API 调用的轻量级替代方案**。核心思想：**以时间换空间**——在对话过程中后台维护一个结构化的 Markdown 笔记文件，压缩时直接用这份笔记替代旧消息。

> 类比：你在工作时，有一个助手在旁边默默做会议纪要。等到需要回顾时，直接看纪要就行，不需要重新听完整录音。

### 3.2 工作原理

```
对话进行中
    │
    ├── 后台周期性触发 Session Memory 提取
    │   ├── fork 子 Agent
    │   ├── 提取结构化笔记
    │   └── 写回 Markdown 文件
    │
    └── 触发压缩时
        ├── 优先使用 Session Memory 笔记作为摘要
        ├── 零 LLM 调用，直接替代旧消息
        └── 保留最近消息原文不动
```

### 3.3 触发条件

```typescript
const SessionMemoryConfig = {
  minimumTokensBetweenUpdate: 5000,  // 硬门槛：距离上次更新至少新增 5k tokens
  toolCallsBetweenUpdates: 3          // 软触发：期间至少调用了 3 次工具
};

function shouldTriggerSessionMemory(
  lastUpdateTokens: number,
  currentTokens: number,
  toolCalls: number,
  lastRoundHadTools: boolean
): boolean {
  // 1. 检查硬门槛：Token 增长是否足够？
  const tokenGrowth = currentTokens - lastUpdateTokens;
  if (tokenGrowth < SessionMemoryConfig.minimumTokensBetweenUpdate) return false;

  // 2. 检查软触发：是否有足够的工具调用活动？
  if (toolCalls < SessionMemoryConfig.toolCallsBetweenUpdates) return false;

  return true;
}
```

### 3.4 关键特性

| 特性 | 说明 |
|-----|------|
| **格式** | 结构化 Markdown 笔记 |
| **提取方式** | 后台 fork 子 Agent 提取 |
| **安全限制** | 子 Agent 只允许编辑这一份会话笔记文件 |
| **额外触发** | 支持手动 `/summary` 强制抽取 |
| **优势** | 零 LLM 调用成本（压缩时直接用笔记替代） |

### 3.5 SM Compact（Session Memory 压缩）

当 Auto Compact 触发时，系统会**优先尝试 SM Compact**：

1. 检查是否已有 Session Memory 笔记
2. 如果有 → 直接用笔记替代旧消息（**零 LLM 调用**）
3. 如果没有 → 回退到 Full Compact（需要 LLM 调用）

---

## 四、Full Compact（完整压缩 / Legacy Compact）

### 4.1 是什么？

Full Compact 是**最重量级**的压缩方式——调用 LLM（大模型）对整个对话历史进行摘要总结，然后用摘要替代原始历史。

> 这是真正的「把长篇对话压缩成精华摘要」。

### 4.2 工作流程

```
对话历史过长
    │
    ├── 第1步：保存完整 transcript（对话记录存磁盘备份）
    │
    ├── 第2步：调用 LLM 生成摘要
    │   ├── 提取前 80000 字符对话内容
    │   └── 让 LLM 总结并保留关键信息
    │
    ├── 第3步：构造压缩后的新消息
    │   └── 替换为一条包含摘要的 user 消息
    │
    └── 第4步：继续工作
```

### 4.3 摘要必须保住的信息

一份合格的压缩摘要，**至少要保住以下 5 类信息**：

1. **当前目标是什么** — 任务方向不能丢
2. **已经做了什么** — 已完成的关键动作
3. **改过哪些文件** — 已修改或重点查看的文件
4. **还有什么没完成** — 剩余工作
5. **哪些决定不能丢** — 关键决定与约束

> **如果这些没有保住，压缩虽然腾出了空间，却打断了工作连续性。**

### 4.4 最小实现教学版

```python
def summarize_history(messages: list) -> str:
    conversation = json.dumps(messages, default=str)[:80000]
    prompt = (
        "Summarize this coding-agent conversation so work can continue.\n"
        "Preserve:\n"
        "1. The current goal\n"
        "2. Important findings and decisions\n"
        "3. Files read or changed\n"
        "4. Remaining work\n"
        "5. User constraints and preferences\n"
        "Be compact but concrete.\n\n"
        f"{conversation}"
    )
    response = client.messages.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
    )
    return response.content[0].text.strip()


def compact_history(messages: list, state: CompactState, focus: str | None = None) -> list:
    # 1. 先保存完整 transcript 到磁盘
    transcript_path = write_transcript(messages)

    # 2. 调用 LLM 生成摘要
    summary = summarize_history(messages)

    # 3. 附加最近访问的文件列表
    if state.recent_files:
        recent_lines = "\n".join(f"- {path}" for path in state.recent_files)
        summary += f"\n\nRecent files to reopen if needed:\n{recent_lines}"

    # 4. 返回压缩后的新消息历史
    return [{
        "role": "user",
        "content": (
            "This conversation was compacted so the agent can continue working.\n\n"
            f"{summary}"
        ),
    }]
```

### 4.5 手动触发

用户可以随时通过 `/compact` 命令手动触发完整压缩，还可以附加提示：

```
/compact 聚焦在认证模块的重构
```

这样摘要会特别保留与「认证模块重构」相关的信息。

---

## 五、Auto Trigger（自动触发机制）

### 5.1 整体决策链

每次用户请求到达后，系统按四个阶段依次处理：

```
用户请求到达
    │
    ▼
Phase 0: 预处理
    ├── 计算上下文窗口使用率
    ├── 执行 MicroCompact（Cached MC 或 Time-Based MC）
    └── 就地精简工具结果
    │
    ▼
Phase 1: Auto Compact 决策
    ├── Token 使用 > ~83.5% 阈值？
    │   ├── 是 → 触发宏压缩
    │   │   ├── 优先：SM Compact（零 LLM 调用）
    │   │   └── 回退：Legacy Compact（实时 LLM 摘要）
    │   └── 否 → 继续正常工作
    │
    ▼
Phase 2: 发送 API 请求
    │
    ▼
Phase 3: 处理响应，返回 Phase 0
```

### 5.2 阈值说明

| 使用率 | 状态 | 建议 |
|--------|------|------|
| 0-50% | 充裕 | 自由工作 |
| 50-70% | 注意 | 准备压缩 |
| **~83.5%** | **自动触发** | **系统自动执行 SM Compact 或 Full Compact** |
| 70-90% | 警告 | 立即 `/compact` |
| 90%+ | 危险 | 必须 `/clear` |

### 5.3 Token 估算方式

```typescript
// 最粗糙但最快的估算，用于实时判断"是否超过阈值"
function estimateContextSize(messages) {
  const totalChars = messages.reduce((sum, msg) => sum + JSON.stringify(msg).length, 0);
  return Math.floor(totalChars / 4); // 约 4 字符 = 1 token
}
```

### 5.4 在 Agent Loop 中的集成

```python
def agent_loop(messages: list, state: CompactState) -> None:
    while True:
        # Phase 0: 每轮先执行微压缩
        messages[:] = micro_compact(messages)

        # Phase 1: 检查是否需要完整压缩
        if estimate_context_size(messages) > CONTEXT_LIMIT:
            print("[auto compact]")
            messages[:] = compact_history(messages, state)

        # Phase 2: 发送 API 请求
        response = client.messages.create(...)

        # Phase 3: 处理工具调用结果
        messages.append({"role": "assistant", "content": response.content})

        # 检测手动 compact 请求
        if manual_compact:
            messages[:] = compact_history(messages, state, focus=compact_focus)
```

---

## 六、大工具结果的入口管控（额外机制）

在工具结果进入上下文**之前**，系统会进行严格检查：

```
工具返回结果
    │
    ├── 单个结果 > 50,000 字符？
    │   └── 持久化到磁盘，上下文只保留 2000 字节预览 + 文件路径
    │
    └── 单次调用合计 > 200,000 字符？
        └── 按大小排序，大的持久化到磁盘
```

```python
def persist_large_output(tool_use_id: str, output: str) -> str:
    if len(output) <= PERSIST_THRESHOLD:  # 30000 字符
        return output

    # 大结果写磁盘
    stored_path = save_to_disk(tool_use_id, output)
    preview = output[:2000]  # 只保留 2000 字符预览
    return (
        "<persisted-output>\n"
        f"Full output saved to: {stored_path}\n"
        f"Preview:\n{preview}\n"
        "</persisted-output>"
    )
```

> **核心思想**：让模型知道「发生了什么」，但不强迫它一直背着整份原始大输出。

---

## 七、实战案例：基于 OpenAI SDK 的完整实现

> 以下代码使用 `openai` Python SDK（兼容 Claude API / OpenAI 兼容接口），演示如何在自己的 Agent 中集成四层上下文管理。

### 7.0 项目结构

```
my-agent/
├── agent.py              # 主入口 + Agent Loop
├── context_manager.py    # 上下文管理器（四层压缩）
├── session_memory.py     # Session Memory 模块
├── tools.py              # 工具定义
└── .session_memory.md    # 自动生成的会话笔记
```

### 7.1 MicroCompact — 缓存模式（Cached MC）

> **核心思路**：不修改本地消息历史，而是在发送 API 请求前，利用请求结构标记哪些工具结果可以「虚拟清除」——让 API 端知道这些是旧内容，可以不纳入实际推理上下文，但仍然保留在 Prompt Cache 中以维持缓存前缀命中。

```python
# context_manager.py

import copy
import json
import time
from dataclasses import dataclass, field

# ─── 配置 ─────────────────────────────────────────────
CONTEXT_LIMIT = 80_000          # 上下文字符估算上限（约 20K tokens）
MICRO_COMPACT_AGE_SEC = 60 * 30 # 30 分钟前的工具结果视为"旧"
KEEP_RECENT = 3                 # 保留最近 N 个工具结果完整内容
MAX_RETRIES = 3                 # Auto Trigger 异常重试次数


@dataclass
class CompactState:
    has_compacted: bool = False
    last_summary: str = ""
    recent_files: list[str] = field(default_factory=list)
    session_memory_path: str = ".session_memory.md"
    last_memory_update_time: float = 0.0
    last_memory_update_tokens: int = 0
    tool_calls_since_memory: int = 0


# ─── Token 粗估 ──────────────────────────────────────
def estimate_tokens(messages: list) -> int:
    """约 4 字符 ≈ 1 token，用于实时判断上下文使用率"""
    total_chars = len(json.dumps(messages, ensure_ascii=False, default=str))
    return total_chars // 4


# ─── MicroCompact: 缓存模式 ──────────────────────────
def micro_compact_cached(messages: list, now: float | None = None) -> list:
    """
    缓存模式 MicroCompact：
    - 不删除本地消息历史（保留完整结构给 Prompt Cache）
    - 将过期的工具结果替换为极短占位符
    - 保留结构记录（tool_use_id 不变），只清空内容体
    - 只保留最近 KEEP_RECENT 个工具结果完整
    """
    now = now or time.time()
    result = []
    tool_result_indices: list[tuple[int, int]] = []

    # 第一遍：收集所有 tool_result 的位置
    for msg_idx, msg in enumerate(messages):
        if msg.get("role") != "user" or not isinstance(msg.get("content"), list):
            continue
        for blk_idx, blk in enumerate(msg["content"]):
            if isinstance(blk, dict) and blk.get("type") == "tool_result":
                tool_result_indices.append((msg_idx, blk_idx))

    # 倒数 KEEP_RECENT 个是「新鲜」的，其余标记为可清除
    stale_set = set(tool_result_indices[:-KEEP_RECENT]) if len(tool_result_indices) > KEEP_RECENT else set()

    # 第二遍：构建清理后的消息
    for msg_idx, msg in enumerate(messages):
        if msg.get("role") != "user" or not isinstance(msg.get("content"), list):
            result.append(msg)
            continue

        new_content = []
        for blk_idx, blk in enumerate(msg["content"]):
            if (isinstance(blk, dict)
                    and blk.get("type") == "tool_result"
                    and (msg_idx, blk_idx) in stale_set):
                # 缓存模式：替换为极短占位符，保留 tool_use_id 结构
                new_content.append({
                    "type": "tool_result",
                    "tool_use_id": blk["tool_use_id"],
                    "content": "[Cached MC: result cleared for context efficiency]"
                })
            else:
                new_content.append(blk)

        result.append({**msg, "content": new_content})

    return result
```

**缓存模式的关键**：`tool_use_id` 保持不变，API 端可以识别这些是「已处理过的旧结果」，在 Prompt Cache 层面保留前缀、在推理层面跳过内容。

### 7.2 Session Memory — 后台维护会话笔记

```python
# session_memory.py

import json
from pathlib import Path
from openai import OpenAI

MEMORY_MIN_TOKENS = 5000    # 硬门槛：距上次更新至少新增 5K tokens
MEMORY_MIN_TOOLS = 3        # 软触发：期间至少调用了 3 次工具

MEMORY_EXTRACTION_PROMPT = """\
You are a note-taker for a coding session. Based on the conversation below, \
update a structured session memory note. Preserve:

## Current Goal
(what the user is trying to achieve)

## Key Findings & Decisions
(important discoveries, architecture choices, constraints)

## Files Touched
(list of files read, modified, or discussed — with brief context)

## Progress
- Done: (completed steps)
- Next: (remaining steps)

## User Preferences
(coding style, patterns, constraints the user mentioned)

Be concrete and compact. Omit boilerplate tool output.

---
Conversation:
{conversation}
"""


def should_update_memory(state, current_tokens: int, has_tool_calls: bool) -> bool:
    """判断是否该更新 Session Memory"""
    token_growth = current_tokens - state.last_memory_update_tokens
    if token_growth < MEMORY_MIN_TOKENS:
        return False
    if state.tool_calls_since_memory < MEMORY_MIN_TOOLS:
        return False
    return True


def extract_session_memory(
    client: OpenAI,
    model: str,
    messages: list,
    memory_path: str,
    max_extract_chars: int = 40_000,
) -> str:
    """
    用一个轻量 LLM 调用，从对话中提取结构化笔记并写入磁盘。
    类似 Claude Code 的 fork 子 Agent —— 这里简化为一次轻量 completion。
    """
    conversation = json.dumps(messages, ensure_ascii=False, default=str)[:max_extract_chars]
    prompt = MEMORY_EXTRACTION_PROMPT.format(conversation=conversation)

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1500,
        temperature=0.2,
    )
    memory_text = response.choices[0].message.content.strip()

    # 写入磁盘
    Path(memory_path).write_text(memory_text, encoding="utf-8")
    print(f"[Session Memory] Updated: {memory_path} ({len(memory_text)} chars)")
    return memory_text


def load_session_memory(memory_path: str) -> str | None:
    """读取已有的 Session Memory 笔记"""
    p = Path(memory_path)
    if p.exists() and p.stat().st_size > 0:
        return p.read_text(encoding="utf-8")
    return None
```

### 7.3 Full Compact — LLM 生成对话摘要

```python
# context_manager.py（续）

import json
from pathlib import Path
from openai import OpenAI


SUMMARY_PROMPT = """\
Summarize this coding-agent conversation so work can continue in a smaller context.

Preserve (be concrete, not vague):
1. Current goal — what are we building/fixing?
2. Key findings & decisions — architecture, constraints, trade-offs
3. Files read or changed — list each with a one-line note
4. Remaining work — what's still TODO?
5. User constraints & preferences — coding style, test requirements, etc.

Do NOT include raw tool output. Be compact.

---
Conversation:
{conversation}
"""


def full_compact(
    client: OpenAI,
    model: str,
    messages: list,
    state: CompactState,
    focus: str | None = None,
) -> list:
    """
    Full Compact：调用 LLM 生成摘要，替换整个消息历史。
    - 先保存完整 transcript 到磁盘（备份）
    - 再用 LLM 生成结构化摘要
    - 用摘要构建新的精简消息历史
    """
    # 1. 保存 transcript 备份
    transcript_dir = Path(".transcripts")
    transcript_dir.mkdir(exist_ok=True)
    ts = int(time.time())
    transcript_path = transcript_dir / f"transcript_{ts}.jsonl"
    with transcript_path.open("w", encoding="utf-8") as f:
        for msg in messages:
            f.write(json.dumps(msg, ensure_ascii=False, default=str) + "\n")
    print(f"[Full Compact] Transcript saved: {transcript_path}")

    # 2. 调用 LLM 生成摘要
    conversation = json.dumps(messages, ensure_ascii=False, default=str)[:80_000]
    prompt = SUMMARY_PROMPT.format(conversation=conversation)

    if focus:
        prompt += f"\n\nFocus area (preserve extra detail here): {focus}"

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0.3,
    )
    summary = response.choices[0].message.content.strip()

    # 3. 附加最近文件列表（如果有的话）
    if state.recent_files:
        recent_lines = "\n".join(f"- {f}" for f in state.recent_files[-10:])
        summary += f"\n\n## Recent Files\n{recent_lines}"

    # 4. 更新状态
    state.has_compacted = True
    state.last_summary = summary

    # 5. 返回新的精简消息历史
    new_messages = [{
        "role": "user",
        "content": (
            "This conversation was compacted to free up context space. "
            "Continue working from this summary:\n\n"
            f"{summary}"
        ),
    }]
    print(f"[Full Compact] Done. Summary: {len(summary)} chars, "
          f"messages: {len(messages)} → 1")
    return new_messages
```

### 7.4 Auto Trigger — 带 3 次重试的完整 Agent Loop

```python
# agent.py

import json
import os
import time
from openai import OpenAI
from context_manager import (
    CompactState, estimate_tokens, micro_compact_cached,
    full_compact, CONTEXT_LIMIT, MAX_RETRIES,
)
from session_memory import (
    should_update_memory, extract_session_memory,
    load_session_memory,
)
from tools import TOOLS, execute_tool  # 你的工具定义和执行函数

# ─── 初始化 ──────────────────────────────────────────
client = OpenAI(
    api_key=os.environ.get("API_KEY", "your-key-here"),
    base_url=os.environ.get("BASE_URL"),  # 兼容任何 OpenAI 兼容接口
)
MODEL = os.environ.get("MODEL", "claude-sonnet-4-20250514")

SYSTEM_PROMPT = """You are a coding agent. Work step by step. \
Use tools when needed. Keep responses concise."""


def send_with_retry(client, model, system, messages, tools, max_retries=MAX_RETRIES):
    """
    带重试的 API 调用。
    每次重试前会执行更激进的压缩策略：
      第1次重试：执行 MicroCompact
      第2次重试：执行 Session Memory 替代 + MicroCompact
      第3次重试：执行 Full Compact（兜底）
    """
    last_error = None
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                system=system,
                messages=messages,
                tools=tools,
                max_tokens=4096,
            )
            return response
        except Exception as e:
            last_error = e
            err_msg = str(e).lower()
            print(f"[Retry {attempt + 1}/{max_retries}] Error: {e}")

            # 根据重试次数逐步升级压缩策略
            if attempt == 0:
                # 第1次：微压缩
                print("[Retry] Applying MicroCompact (cached mode)...")
                messages[:] = micro_compact_cached(messages)
            elif attempt == 1:
                # 第2次：尝试 Session Memory 替代
                print("[Retry] Applying Session Memory fallback...")
                memory = load_session_memory(".session_memory.md")
                if memory:
                    messages[:] = [
                        {"role": "user", "content": f"Session context (compressed):\n\n{memory}"}
                    ]
                else:
                    messages[:] = micro_compact_cached(messages)
            elif attempt == 2:
                # 第3次：Full Compact 兜底
                print("[Retry] Applying Full Compact fallback...")
                state = CompactState()
                messages[:] = full_compact(client, MODEL, messages, state)

    raise RuntimeError(f"API call failed after {max_retries} retries: {last_error}")


def agent_loop(messages: list, state: CompactState):
    """主 Agent 循环 —— 集成四层上下文管理"""

    while True:
        current_tokens = estimate_tokens(messages)
        usage_pct = current_tokens / (CONTEXT_LIMIT // 4) * 100  # 粗估使用率

        # ━━━ Phase 0: MicroCompact（缓存模式）━━━
        messages[:] = micro_compact_cached(messages)

        # ━━━ Phase 0.5: Session Memory 检查 ━━━
        if should_update_memory(state, current_tokens, has_tool_calls=True):
            print("[Session Memory] Triggering background extraction...")
            # 后台提取会话笔记（类似 Claude Code 的 fork 子 Agent）
            extract_session_memory(client, MODEL, messages, state.session_memory_path)
            state.last_memory_update_tokens = current_tokens
            state.last_memory_update_time = time.time()
            state.tool_calls_since_memory = 0

        # ━━━ Phase 1: Auto Compact 决策 ━━━
        if usage_pct > 83.5:
            print(f"[Auto Compact] Context usage: {usage_pct:.1f}% > 83.5%")

            # 优先尝试 SM Compact（用 Session Memory 零 LLM 成本替代）
            memory = load_session_memory(state.session_memory_path)
            if memory and len(memory) > 100:
                print("[SM Compact] Using Session Memory as summary (zero LLM cost)")
                # 保留最近几条消息原文 + Session Memory 摘要
                recent_tail = messages[-2:] if len(messages) > 2 else messages
                messages[:] = [
                    {"role": "user", "content": f"Session context (from memory):\n\n{memory}"},
                    *recent_tail,
                ]
                state.has_compacted = True
            else:
                # 没有 Session Memory → 回退到 Full Compact
                print("[Legacy Compact] No session memory, using LLM summary")
                messages[:] = full_compact(client, MODEL, messages, state)

        # ━━━ Phase 2: 发送 API 请求（带重试）━━━
        response = send_with_retry(client, MODEL, SYSTEM_PROMPT, messages, TOOLS)
        choice = response.choices[0]
        assistant_msg = choice.message

        # 将 assistant 响应加入历史
        messages.append(assistant_msg.model_dump())

        # ━━━ Phase 3: 处理工具调用 ━━━
        if not assistant_msg.tool_calls:
            # 没有工具调用 → 模型认为任务完成
            print(assistant_msg.content)
            return

        # 执行工具并收集结果
        tool_results = []
        for tool_call in assistant_msg.tool_calls:
            output = execute_tool(tool_call)
            state.tool_calls_since_memory += 1
            tool_results.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": str(output),
            })
            print(f"  > {tool_call.function.name}: {str(output)[:120]}")

        messages.extend(tool_results)

        # 记录最近访问的文件（用于摘要附录）
        for tc in assistant_msg.tool_calls:
            if tc.function.name in ("read_file", "write_file", "edit_file"):
                args = json.loads(tc.function.arguments)
                path = args.get("path", "")
                if path and path not in state.recent_files:
                    state.recent_files.append(path)
                    state.recent_files[:] = state.recent_files[-10:]


# ─── 主入口 ──────────────────────────────────────────
if __name__ == "__main__":
    history: list[dict] = []
    state = CompactState()

    print("=== Agent with Context Management ===")
    print(f"Model: {MODEL}  |  Context limit: ~{CONTEXT_LIMIT // 4} tokens")
    print("Type 'q' to quit, 'compact' to manually compact\n")

    while True:
        try:
            user_input = input("\033[36mYou > \033[0m").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if user_input.lower() in ("q", "quit", "exit"):
            break

        # 手动触发 compact
        if user_input.lower().startswith("compact"):
            focus = user_input[7:].strip() or None
            history[:] = full_compact(client, MODEL, history, state, focus=focus)
            print("[Manual Compact] Done.")
            continue

        history.append({"role": "user", "content": user_input})
        agent_loop(history, state)
```

### 7.5 完整流程图

```
用户输入
    │
    ▼
┌─ Agent Loop ──────────────────────────────────────────────┐
│                                                           │
│  Phase 0: micro_compact_cached(messages)                  │
│  ├── 扫描所有 tool_result                                 │
│  ├── 只保留最近 3 个完整，其余替换为占位符（结构不变）        │
│  └── 零成本，每轮都执行                                    │
│                                                           │
│  Phase 0.5: Session Memory 检查                           │
│  ├── token 增长 ≥ 5K 且工具调用 ≥ 3 次？                   │
│  └── 是 → 后台提取笔记写入 .session_memory.md              │
│                                                           │
│  Phase 1: Auto Compact 决策                               │
│  ├── 使用率 > 83.5%？                                     │
│  │   ├── 有 Session Memory → SM Compact（零 LLM 成本）     │
│  │   └── 没有 → Full Compact（调 LLM 生成摘要）            │
│  └── 使用率正常 → 跳过                                    │
│                                                           │
│  Phase 2: send_with_retry() ← 带 3 次重试                 │
│  ├── 第 1 次失败 → 重试前执行 MicroCompact                 │
│  ├── 第 2 次失败 → 重试前用 Session Memory 替代             │
│  ├── 第 3 次失败 → 重试前执行 Full Compact                 │
│  └── 3 次都失败 → 抛出异常                                │
│                                                           │
│  Phase 3: 工具执行 → 结果追加到 messages → 回到 Phase 0    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

> **重试策略的设计哲学**：每次重试不只是「再试一次」，而是**主动缩小上下文**——第 1 次微压缩，第 2 次用笔记替代，第 3 次全面摘要。这样即使上下文过长导致请求失败，重试时大概率能成功。

---

## 八、初学者最容易犯的错

### ❌ 1. 以为压缩等于删除
更准确地说，是把「不必常驻活跃上下文」的内容换一种表示。

### ❌ 2. 只在撞到上限后才临时乱补
更好的做法是从一开始就有三层思路：大结果先落盘 → 旧结果先缩短 → 整体过长再摘要。

### ❌ 3. 摘要只写成一句空话
如果摘要没有保住文件、决定、下一步，它对继续工作没有帮助。

### ❌ 4. 把压缩和 Memory 混成一类
- **压缩**解决的是：当前会话太长了怎么办
- **Memory** 解决的是：哪些信息跨会话仍然值得保留

---

## 九、一句话总结

> **上下文压缩的核心，不是尽量少字，而是让模型在更短的活跃上下文里，仍然保住继续工作的连续性。**

---

## 参考资料

- [learn.shareai.run - 上下文压缩](https://learn.shareai.run/zh/s06/) — 教学版上下文压缩实现
- [掘金 - Claude Code 多层渐进式压缩架构深度解析](https://juejin.cn/post/7626946076196880394)
- [CSDN - 突破AI上下文限制：Claude Code四层压缩策略](https://blog.csdn.net/m0_59235945/article/details/160380952)
- [SegmentFault - Claude Code 上下文压缩源码解析](https://segmentfault.com/a/1190000047696883)
- [知乎 - Claude Code 压缩设计深度解读](https://zhuanlan.zhihu.com/p/2024233458180833574)
- [CSDN - Claude Code v2.1.88 三层自愈记忆架构](https://blog.csdn.net/fzuim/article/details/159711970)
- [杨一涛 - Claude Code 上下文管理与自动压缩](https://yangyitao.com/books/claude-code/chapters/16-context-management)
