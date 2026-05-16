---
title: Agent Memory（智能体记忆）
date: 2026-05-06
categories:
  - Agent
tags: ["AI", "Agent", "Memory", "智能体", "OpenAI"]
summary: "Agent记忆系统完全指南，涵盖工作记忆、短期记忆、长期记忆的分类体系、存储方式、修剪策略及5个渐进式实战案例。"
---

# Agent Memory（智能体记忆）

## 一句话理解

> 如果把 LLM 比作 Agent 的**大脑**（CPU），那 Agent Memory 就是它的**笔记本**（RAM + 硬盘）——用来记录刚才发生的事、用户的偏好，以及过去的经验。

**没有记忆的 Agent**：每次对话都是"失忆"状态，用户得从头解释一切。
**有记忆的 Agent**：能记住你是谁、你喜欢什么、上次聊了什么，越用越聪明。

---

## 为什么需要 Agent Memory？

LLM 本身存在天然限制：

| 问题         | 说明                                          |
| ---------- | ------------------------------------------- |
| **容量有限**   | 即使 GPT-4o 支持 128K tokens，对于长期运行的 Agent 仍然不够 |
| **成本增加**   | 上下文窗口越大，推理延迟和计算成本越高                         |
| **注意力稀释**  | 长上下文中，早期信息容易被"遗忘"或误解                        |
| **无跨会话记忆** | 关掉对话窗口，下次打开模型完全不认识你                         |

**Agent Memory 的核心目标**：让 Agent 在**跨会话、长时间交互**中保持连贯性和个性化。

---

## 记忆分类体系

Agent 的记忆系统借鉴了**认知科学**中人类记忆的分类，主要分为以下几种：

### 1. 工作记忆（Working Memory）

- **特点**：任务级、临时、结构化
- **存储**：内存中的字典 / 对象
- **用途**：正在执行的工具调用参数、任务状态
- **类比**：你心算 `24 × 3` 时，脑子里暂存的中间结果

### 2. 短期记忆（Short-term Memory）

- **特点**：容量小、时效短、上下文相关
- **存储**：内存缓存 / 对话历史列表
- **用途**：当前对话内容、任务执行中的临时状态
- **类比**：刚查到的电话号码，拨完号就忘了
- **工程实现**：对应模型的 **Context Window**（上下文窗口）

### 3. 长期记忆（Long-term Memory）

- **特点**：持久存储、可检索、可结构化
- **存储**：数据库 / 向量库 / 知识库
- **用途**：用户历史、知识库、经验沉淀
- **类比**：你记得"10年前去过巴黎"，也记得"骑自行车的技巧"

长期记忆又可细分为：

| 子类型                   | 说明               | 示例              |
| --------------------- | ---------------- | --------------- |
| **情景记忆（Episodic）**    | 记录特定事件（时间+地点+内容） | "上次用户说他喜欢简洁的回答" |
| **语义记忆（Semantic）**    | 抽象知识：事实、概念、规则    | "巴黎是法国首都"       |
| **程序性记忆（Procedural）** | 如何做某事：技能、流程      | 调用工具链、执行计划      |
| **偏好记忆（Preference）**  | 用户兴趣、习惯、风格偏好     | "用户喜欢用中文回复"     |

### 记忆分类全景图

```
┌─────────────────────────────────────────────┐
│              Agent Memory                    │
├──────────────┬──────────────────────────────┤
│  工作记忆     │  任务级临时状态               │
│  (Working)   │  内存字典                     │
├──────────────┼──────────────────────────────┤
│  短期记忆     │  当前会话上下文               │
│  (Short-term)│  Context Window / 缓存       │
├──────────────┼──────────────────────────────┤
│              │  情景记忆 ── 事件+时间线       │
│  长期记忆     │  语义记忆 ── 事实+概念        │
│  (Long-term) │  程序性记忆── 技能+流程       │
│              │  偏好记忆 ── 用户画像          │
│              │  (向量库/数据库/知识库)        │
└──────────────┴──────────────────────────────┘
```

---

## Agent Memory 工作流程

Agent 通常通过以下步骤来管理记忆：

```
用户输入
   │
   ▼
① 记忆检索（Retrieve）── 从存储中检索相关记忆
   │
   ▼
② 上下文构建（Format）── 将检索到的记忆注入 Prompt
   │
   ▼
③ LLM 推理（Reason）── 基于记忆+当前输入生成响应
   │
   ▼
④ 记忆存储（Store）── 将新的交互信息写入记忆
   │
   ▼
⑤ 记忆管理（Maintain）── 压缩、合并、清理过期记忆
```

### 记忆管理的五个维度

| 维度           | 问题   | 常见方案                      |
| ------------ | ---- | ------------------------- |
| **What**     | 记什么？ | 手动管理 vs 自动识别重要信息          |
| **How**      | 怎么存？ | 直接存储 vs 压缩/抽取/摘要          |
| **Where**    | 存哪里？ | 内存 / Redis / 向量数据库 / 图数据库 |
| **Length**   | 存多少？ | Token 限制截断 vs 无限扩展        |
| **Retrieve** | 怎么取？ | 全量获取 vs 语义检索 vs 混合检索      |

---

## 记忆保存方式

记忆从"脑子里"到"硬盘上"，有多种保存策略，各有取舍：

### 1. 原始对话保存（Raw Conversation Storage）

- **做法**：直接保存完整的 messages 列表（user / assistant 轮流交替）
- **优点**：零信息损失，随时可以还原完整对话
- **缺点**：体积增长快，检索困难，Token 成本高
- **存储介质**：JSON 文件 / Redis / SQLite
- **适用场景**：客服系统（需要完整对话回溯）、短期会话

```python
import json
from datetime import datetime

class RawMemoryStore:
    def __init__(self, filepath: str = "conversations.json"):
        self.filepath = filepath
        self.sessions: dict = self._load()

    def save_turn(self, session_id: str, role: str, content: str):
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        self.sessions[session_id].append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
        self._save()

    def get_history(self, session_id: str) -> list[dict]:
        return self.sessions.get(session_id, [])

    def _save(self):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(self.sessions, f, ensure_ascii=False, indent=2)

    def _load(self) -> dict:
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
```

### 2. 摘要保存（Summary Storage）

- **做法**：用 LLM 将多轮对话压缩成一段摘要，只存摘要
- **优点**：大幅减少存储量，保留核心信息
- **缺点**：会丢失细节，摘要质量依赖 LLM
- **存储介质**：文本文件 / 数据库
- **适用场景**：长时间对话、需要回顾但不需要逐字还原

```python
from openai import OpenAI
client = OpenAI()

def summarize_conversation(messages: list[dict]) -> str:
    """将对话历史压缩为摘要"""
    conversation_text = "\n".join(
        f"{m['role']}: {m['content']}" for m in messages
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "system",
            "content": "请将以下对话压缩为一段简洁的摘要，保留关键事实、用户偏好和重要决策。"
        }, {
            "role": "user",
            "content": conversation_text
        }]
    )
    return response.choices[0].message.content
```

### 3. 结构化事实抽取（Structured Fact Extraction）

- **做法**：用 LLM 从对话中抽取关键事实，以结构化格式存储（如 JSON / YAML）
- **优点**：信息密度高，便于检索和更新，支持去重/合并
- **缺点**：抽取可能遗漏或出错，需要额外的 LLM 调用
- **存储介质**：数据库 / JSON 文件
- **适用场景**：用户画像构建、知识库积累

```python
from openai import OpenAI
import json

client = OpenAI()

def extract_facts(conversation: str) -> list[dict]:
    """从对话中抽取结构化事实"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "system",
            "content": """从对话中提取关键事实，返回 JSON 数组。
每个事实格式：{"fact": "事实内容", "category": "分类", "confidence": 0.0-1.0}
只提取明确陈述的事实，不要猜测。"""
        }, {
            "role": "user",
            "content": conversation
        }],
        response_format={"type": "json_object"}
    )
    result = json.loads(response.choices[0].message.content)
    return result.get("facts", [])
```

### 4. Embedding 向量保存（Vector Storage）

- **做法**：将记忆文本通过 Embedding 模型转化为向量，存入向量数据库
- **优点**：支持语义检索（"相似意思"而非"相同关键词"），可扩展性好
- **缺点**：需要向量数据库基础设施，Embedding 调用有成本
- **存储介质**：ChromaDB / Pinecone / Weaviate / pgvector
- **适用场景**：大规模长期记忆、跨会话个性化、知识密集型 Agent

```python
# 使用 ChromaDB 的示例（pip install chromadb openai）
import chromadb
from openai import OpenAI

openai_client = OpenAI()
chroma_client = chromadb.PersistentClient(path="./memory_db")
collection = chroma_client.get_or_create_collection("agent_memory")

def save_memory(text: str, memory_id: str, metadata: dict = None):
    """将记忆以向量形式存入 ChromaDB"""
    embedding = openai_client.embeddings.create(
        model="text-embedding-3-small", input=text
    ).data[0].embedding
    collection.add(
        ids=[memory_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata or {}]
    )

def recall_memory(query: str, top_k: int = 3) -> list[str]:
    """语义检索相关记忆"""
    query_embedding = openai_client.embeddings.create(
        model="text-embedding-3-small", input=query
    ).data[0].embedding
    results = collection.query(query_embeddings=[query_embedding], n_results=top_k)
    return results["documents"][0] if results["documents"] else []
```

### 5. 知识图谱保存（Knowledge Graph Storage）

- **做法**：将记忆中的实体和关系抽取为三元组（主体-关系-客体），存入图数据库
- **优点**：天然支持关系推理，适合复杂关联的知识
- **缺点**：实现复杂度高，抽取质量依赖 NLP 能力
- **存储介质**：Neo4j / FalkorDB / NetworkX（轻量）
- **适用场景**：人物关系、项目依赖、复杂领域知识

### 各保存方式对比

| 方式 | 信息完整度 | 检索效率 | 实现复杂度 | 存储成本 | 适用规模 |
|------|-----------|---------|-----------|---------|---------|
| 原始对话 | ★★★★★ | ★★☆☆☆ | ★☆☆☆☆ | 高 | 小 |
| 摘要保存 | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ | 低 | 中 |
| 事实抽取 | ★★★★☆ | ★★★★☆ | ★★★☆☆ | 低 | 中 |
| 向量存储 | ★★★★☆ | ★★★★★ | ★★★☆☆ | 中 | 大 |
| 知识图谱 | ★★★★☆ | ★★★★☆ | ★★★★★ | 中 | 大 |

> **工程实践建议**：多数生产级系统采用 **混合策略** — 短期用原始对话，长期用事实抽取 + 向量存储。

---

## 短期记忆修剪策略

短期记忆（对话上下文）会不断膨胀，必须主动修剪以控制 Token 消耗和推理成本。以下是常见的修剪策略：

### 1. 滑动窗口（Sliding Window）

最简单直接的方式：只保留最近的 N 条消息，超出则从头部丢弃。

```python
class SlidingWindowMemory:
    """滑动窗口：保留最近 N 轮对话"""

    def __init__(self, max_turns: int = 10):
        self.messages: list[dict] = []
        self.max_turns = max_turns

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        # 每轮对话 = 1条user + 1条assistant，共2条
        max_messages = self.max_turns * 2
        while len(self.messages) > max_messages:
            self.messages.pop(0)  # 从头部移除最早的消息

    def get_messages(self) -> list[dict]:
        return list(self.messages)
```

- **优点**：实现极简，成本可预测
- **缺点**：丢弃时一刀切，可能丢失重要早期信息
- **适用**：闲聊机器人、短任务

### 2. Token 限制裁剪（Token Budget Trimming）

按 Token 数量控制，超限时从最旧消息开始移除，更精确地利用上下文窗口。

```python
import tiktoken

class TokenBudgetMemory:
    """Token 预算裁剪：总 Token 数不超上限"""

    def __init__(self, max_tokens: int = 4000, model: str = "gpt-4o"):
        self.messages: list[dict] = []
        self.max_tokens = max_tokens
        self.enc = tiktoken.encoding_for_model(model)

    def _count_tokens(self, text: str) -> int:
        return len(self.enc.encode(text))

    def _total_tokens(self) -> int:
        return sum(self._count_tokens(m["content"]) for m in self.messages)

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        while self._total_tokens() > self.max_tokens and len(self.messages) > 1:
            self.messages.pop(0)

    def get_messages(self) -> list[dict]:
        return list(self.messages)
```

- **优点**：精确控制成本，适配不同模型的上下文窗口
- **缺点**：仍按时间顺序丢弃，无智能判断
- **适用**：成本敏感的生产环境

### 3. 摘要压缩（Conversation Summarization）

当对话超过阈值时，用 LLM 将旧对话压缩成摘要，用摘要替代原始消息。

```python
from openai import OpenAI

client = OpenAI()

class SummaryCompressedMemory:
    """摘要压缩：旧对话 → 摘要，新对话保留原文"""

    def __init__(self, summarize_threshold: int = 10, keep_recent: int = 4):
        self.messages: list[dict] = []
        self.summary: str = ""
        self.threshold = summarize_threshold
        self.keep_recent = keep_recent  # 保留最近 N 条原文

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        if len(self.messages) > self.threshold:
            self._compress()

    def _compress(self):
        """将旧消息压缩为摘要"""
        # 要压缩的消息 = 总数 - 保留的最近消息
        to_summarize = self.messages[:-self.keep_recent]
        to_keep = self.messages[-self.keep_recent:]

        conversation = "\n".join(
            f"{m['role']}: {m['content']}" for m in to_summarize
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "system",
                "content": "将以下对话压缩为一段简洁的上下文摘要，保留关键信息。"
            }, {"role": "user", "content": conversation}]
        )

        self.summary = response.choices[0].message.content
        self.messages = to_keep  # 只保留最近的原文

    def get_messages(self) -> list[dict]:
        result = []
        if self.summary:
            result.append({
                "role": "system",
                "content": f"[此前对话摘要] {self.summary}"
            })
        result.extend(self.messages)
        return result
```

- **优点**：不丢失关键信息，上下文连续性好
- **缺点**：额外 LLM 调用有延迟和成本，摘要可能引入误差
- **适用**：长时间多轮对话（客服、Coaching、Agent 规划）

### 4. 重要性评分裁剪（Importance Scoring）

对每条消息打分（基于关键词、角色、时间等），优先保留高分消息。

```python
from openai import OpenAI
from datetime import datetime

client = OpenAI()

class ImportanceScoredMemory:
    """重要性评分裁剪：智能保留重要消息"""

    def __init__(self, max_messages: int = 20):
        self.messages: list[dict] = []  # {"role", "content", "score", "timestamp"}
        self.max_messages = max_messages

    def _score_message(self, role: str, content: str) -> float:
        """为消息打分（0-1），可自定义评分逻辑"""
        score = 0.5  # 基础分

        # system 消息最重要
        if role == "system":
            score = 1.0

        # 包含关键信息的消息加分
        important_keywords = ["记住", "重要", "偏好", "决定", "选择", "永远", "不要"]
        for kw in important_keywords:
            if kw in content:
                score += 0.1

        # 包含代码/数据的消息加分
        if "```" in content or "{" in content:
            score += 0.1

        # 较短的寒暄降分
        greetings = ["你好", "谢谢", "好的", "嗯嗯", "哈哈", "OK"]
        if content.strip() in greetings:
            score -= 0.3

        return min(max(score, 0.0), 1.0)

    def add(self, role: str, content: str):
        score = self._score_message(role, content)
        self.messages.append({
            "role": role,
            "content": content,
            "score": score,
            "timestamp": datetime.now().isoformat()
        })

        if len(self.messages) > self.max_messages:
            self._prune()

    def _prune(self):
        """移除得分最低的消息"""
        # 永远不删除 system 消息
        system_msgs = [m for m in self.messages if m["role"] == "system"]
        other_msgs = [m for m in self.messages if m["role"] != "system"]

        # 按分数排序，保留最高的
        other_msgs.sort(key=lambda x: x["score"], reverse=True)
        keep_count = self.max_messages - len(system_msgs)
        kept = other_msgs[:keep_count]

        # 按时间顺序重新排列
        kept.sort(key=lambda x: x["timestamp"])
        self.messages = system_msgs + kept

    def get_messages(self) -> list[dict]:
        return [{"role": m["role"], "content": m["content"]} for m in self.messages]
```

- **优点**：智能保留关键信息，减少信息损失
- **缺点**：评分规则需要针对场景调优
- **适用**：需要记住用户偏好和决策的 Agent

### 5. 分层修剪（Layered Pruning）

结合多种策略，不同阶段使用不同的修剪方式。

```
对话开始
   │
   ▼
消息积累中 → 滑动窗口（轻量级，实时丢弃旧消息）
   │
   ▼
达到中等长度 → 重要性评分（智能判断，保留关键消息）
   │
   ▼
达到长度上限 → 摘要压缩（将旧消息压缩为摘要）
   │
   ▼
会话结束 → 事实抽取（提取关键事实存入长期记忆）
```

### 各修剪策略对比

| 策略 | 实现复杂度 | 信息保留度 | 额外成本 | 实时性 | 适用场景 |
|------|-----------|-----------|---------|--------|---------|
| 滑动窗口 | ★☆☆☆☆ | ★★☆☆☆ | 无 | 极好 | 闲聊、短任务 |
| Token 裁剪 | ★★☆☆☆ | ★★☆☆☆ | 无 | 好 | 成本敏感场景 |
| 摘要压缩 | ★★★☆☆ | ★★★★☆ | LLM 调用 | 中等 | 长对话 |
| 重要性评分 | ★★★☆☆ | ★★★★☆ | 低 | 好 | 需记偏好的 Agent |
| 分层修剪 | ★★★★★ | ★★★★★ | 可变 | 好 | 生产级系统 |

> **工程实践建议**：简单场景用 **滑动窗口 + Token 裁剪** 即可；复杂 Agent 推荐 **分层修剪**，兼顾效率和信息保留。

---

## 实操案例

### 案例一：纯 OpenAI SDK 实现短期记忆（对话历史管理）

这是最基础的记忆实现——把对话历史保存在内存中，每次请求时带上。

```python
"""
案例1：基于 OpenAI SDK 的短期记忆 - 对话历史管理
核心思路：维护一个 messages 列表，每次对话追加进去
"""
from openai import OpenAI

client = OpenAI(api_key="your-api-key")


class ShortTermMemory:
    """短期记忆：基于对话历史列表"""

    def __init__(self, system_prompt: str = "你是一个有帮助的助手。"):
        self.messages: list[dict] = [
            {"role": "system", "content": system_prompt}
        ]

    def chat(self, user_input: str) -> str:
        # 1. 将用户输入加入记忆
        self.messages.append({"role": "user", "content": user_input})

        # 2. 调用 API（携带完整对话历史 = 短期记忆）
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=self.messages
        )

        # 3. 将助手回复也加入记忆
        assistant_reply = response.choices[0].message.content
        self.messages.append({"role": "assistant", "content": assistant_reply})

        return assistant_reply

    def get_history(self) -> list[dict]:
        return self.messages

    def clear(self):
        """清空记忆（开始新会话）"""
        system_msg = self.messages[0]
        self.messages = [system_msg]


# === 使用示例 ===
if __name__ == "__main__":
    memory = ShortTermMemory(system_prompt="你是一个友好的编程助手。")

    # 第一轮：介绍自己
    reply1 = memory.chat("我叫小明，我正在学习 Python。")
    print(f"助手: {reply1}")

    # 第二轮：模型能记住你的名字和正在学什么
    reply2 = memory.chat("你还记得我叫什么吗？我在学什么？")
    print(f"助手: {reply2}")
    # 预期输出：你叫小明，正在学习 Python ✅

    # 查看记忆内容
    print(f"\n记忆条数: {len(memory.get_history())}")
```

**局限性**：对话历史会越来越长，Token 消耗不断增加，且程序重启后记忆丢失。

---

### 案例二：带 Token 限制的滑动窗口记忆

当对话历史超过 Token 限制时，自动丢弃最早的消息（保留 system prompt）。

```python
"""
案例2：滑动窗口记忆 - 自动管理上下文长度
核心思路：限制 messages 的总 token 数，超限时移除最早的消息
"""
import tiktoken
from openai import OpenAI

client = OpenAI(api_key="your-api-key")


class WindowMemory:
    """滑动窗口记忆：保留最近的 N 轮对话"""

    def __init__(
        self,
        system_prompt: str = "你是一个有帮助的助手。",
        max_tokens: int = 4000,
        model: str = "gpt-4o"
    ):
        self.system_message = {"role": "system", "content": system_prompt}
        self.messages: list[dict] = []
        self.max_tokens = max_tokens
        self.model = model
        self.enc = tiktoken.encoding_for_model(model)

    def _count_tokens(self, text: str) -> int:
        return len(self.enc.encode(text))

    def _total_tokens(self) -> int:
        return sum(self._count_tokens(m["content"]) for m in self.messages)

    def _trim_to_fit(self):
        """从最旧的消息开始移除，直到总 token 数在限制内"""
        while self._total_tokens() > self.max_tokens and len(self.messages) > 1:
            self.messages.pop(0)  # 移除最早的消息

    def chat(self, user_input: str) -> str:
        self.messages.append({"role": "user", "content": user_input})
        self._trim_to_fit()

        # 构建请求：system + 窗口内的消息
        full_messages = [self.system_message] + self.messages

        response = client.chat.completions.create(
            model=self.model,
            messages=full_messages
        )

        reply = response.choices[0].message.content
        self.messages.append({"role": "assistant", "content": reply})
        return reply


# === 使用示例 ===
if __name__ == "__main__":
    memory = WindowMemory(max_tokens=2000)

    memory.chat("我叫小明，我喜欢吃火锅。")
    memory.chat("我最喜欢的编程语言是 Python。")
    reply = memory.chat("你还记得我的名字和爱好吗？")
    print(f"助手: {reply}")
    # 在窗口内时能记住；随着对话增多，早期信息可能被丢弃
```

---

### 案例三：长期记忆 — 基于向量数据库的语义记忆

使用 Embedding + 向量检索实现"长期记忆"，即使跨会话也能回忆起相关信息。

```python
"""
案例3：长期记忆 - 基于 Embedding + 向量检索的语义记忆
核心思路：
  1. 每次对话后，将关键信息生成 embedding 并存入向量库
  2. 新对话时，先用用户输入去向量库检索相关记忆
  3. 将检索到的记忆注入 prompt
依赖：pip install openai numpy
（生产环境建议使用 ChromaDB / Pinecone / Weaviate 等向量数据库）
"""
import json
import os
import numpy as np
from openai import OpenAI

client = OpenAI(api_key="your-api-key")

MEMORY_FILE = "agent_long_term_memory.json"


class LongTermMemory:
    """长期记忆：基于 Embedding 语义检索"""

    def __init__(self, embedding_model: str = "text-embedding-3-small"):
        self.embedding_model = embedding_model
        self.memories: list[dict] = []  # [{"content": str, "embedding": list, "metadata": dict}]
        self._load()

    def _get_embedding(self, text: str) -> list[float]:
        """调用 OpenAI Embedding API 生成向量"""
        response = client.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """计算余弦相似度"""
        a, b = np.array(a), np.array(b)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    def add_memory(self, content: str, metadata: dict = None):
        """存储一条记忆"""
        embedding = self._get_embedding(content)
        self.memories.append({
            "content": content,
            "embedding": embedding,
            "metadata": metadata or {}
        })
        self._save()

    def search(self, query: str, top_k: int = 3, threshold: float = 0.5) -> list[str]:
        """语义检索最相关的记忆"""
        if not self.memories:
            return []

        query_embedding = self._get_embedding(query)

        # 计算相似度并排序
        scored = []
        for mem in self.memories:
            sim = self._cosine_similarity(query_embedding, mem["embedding"])
            if sim >= threshold:
                scored.append((sim, mem["content"]))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [content for _, content in scored[:top_k]]

    def _save(self):
        """持久化到磁盘"""
        data = [
            {"content": m["content"], "metadata": m["metadata"]}
            for m in self.memories
        ]
        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load(self):
        """从磁盘加载"""
        if not os.path.exists(MEMORY_FILE):
            return
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        for item in data:
            embedding = self._get_embedding(item["content"])
            self.memories.append({
                "content": item["content"],
                "embedding": embedding,
                "metadata": item.get("metadata", {})
            })


class MemoryAgent:
    """带长期记忆的 Agent"""

    def __init__(self):
        self.memory = LongTermMemory()
        self.conversation: list[dict] = []

    def chat(self, user_input: str) -> str:
        # 1. 检索相关记忆
        relevant_memories = self.memory.search(user_input, top_k=3)

        # 2. 构建系统提示（注入记忆）
        memory_context = ""
        if relevant_memories:
            memory_context = "\n\n以下是与当前对话相关的历史记忆：\n"
            for i, mem in enumerate(relevant_memories, 1):
                memory_context += f"{i}. {mem}\n"

        system_prompt = f"""你是一个有帮助的助手。{memory_context}
请根据以上记忆信息来回答用户问题。"""

        # 3. 调用 LLM
        messages = [
            {"role": "system", "content": system_prompt},
            *self.conversation,
            {"role": "user", "content": user_input}
        ]

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        reply = response.choices[0].message.content

        # 4. 更新短期记忆（对话历史）
        self.conversation.append({"role": "user", "content": user_input})
        self.conversation.append({"role": "assistant", "content": reply})

        # 5. 将本轮关键信息存入长期记忆
        self.memory.add_memory(
            content=f"用户说：{user_input}。助手回复：{reply}",
            metadata={"type": "conversation"}
        )

        return reply


# === 使用示例 ===
if __name__ == "__main__":
    agent = MemoryAgent()

    # 第一次会话
    agent.chat("我叫小明，住在北京，是一名 Python 开发者。")
    agent.chat("我最喜欢的框架是 FastAPI。")

    # ... 模拟程序重启，新的会话 ...
    # 创建新 agent 实例，但长期记忆从文件恢复
    agent2 = MemoryAgent()
    reply = agent2.chat("你知道我是做什么的吗？")
    print(f"助手: {reply}")
    # 预期：能从小明的职业、喜好等长期记忆中回答 ✅
```

---

### 案例四：多层记忆架构（完整版）

结合短期记忆 + 长期记忆 + 用户偏好记忆，实现完整的记忆系统。

```python
"""
案例4：多层记忆架构 - 短期 + 长期 + 偏好
核心思路：三层记忆各司其职，协同工作
"""
import json
import os
from datetime import datetime
from openai import OpenAI

client = OpenAI(api_key="your-api-key")


# ============================================
# 第一层：短期记忆（对话历史 + Token 管理）
# ============================================
class ConversationBuffer:
    """短期记忆：当前会话的对话历史"""

    def __init__(self, max_turns: int = 20):
        self.messages: list[dict] = []
        self.max_turns = max_turns

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        # 超过轮次限制时，移除最早的消息
        while len(self.messages) > self.max_turns * 2:
            self.messages.pop(0)

    def get_messages(self) -> list[dict]:
        return list(self.messages)

    def clear(self):
        self.messages.clear()


# ============================================
# 第二层：长期记忆（持久化的关键事实）
# ============================================
class FactStore:
    """长期记忆：持久化存储关键事实"""

    def __init__(self, filepath: str = "agent_facts.json"):
        self.filepath = filepath
        self.facts: list[dict] = self._load()

    def add_fact(self, content: str, category: str = "general"):
        fact = {
            "content": content,
            "category": category,
            "timestamp": datetime.now().isoformat()
        }
        self.facts.append(fact)
        self._save()

    def search_facts(self, keywords: list[str]) -> list[str]:
        """基于关键词搜索事实"""
        results = []
        for fact in self.facts:
            if any(kw.lower() in fact["content"].lower() for kw in keywords):
                results.append(fact["content"])
        return results

    def get_all_facts(self) -> list[str]:
        return [f["content"] for f in self.facts]

    def _save(self):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(self.facts, f, ensure_ascii=False, indent=2)

    def _load(self) -> list[dict]:
        if os.path.exists(self.filepath):
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        return []


# ============================================
# 第三层：用户偏好记忆
# ============================================
class UserProfile:
    """偏好记忆：用户画像与个性化偏好"""

    def __init__(self, filepath: str = "user_profile.json"):
        self.filepath = filepath
        self.profile: dict = self._load() or {
            "name": None,
            "language": "中文",
            "response_style": "简洁",
            "interests": [],
            "custom_preferences": {}
        }

    def update(self, key: str, value):
        self.profile[key] = value
        self._save()

    def get_system_context(self) -> str:
        """生成用户偏好的系统提示上下文"""
        parts = []
        if self.profile.get("name"):
            parts.append(f"用户名：{self.profile['name']}")
        if self.profile.get("language"):
            parts.append(f"使用语言：{self.profile['language']}")
        if self.profile.get("response_style"):
            parts.append(f"回复风格：{self.profile['response_style']}")
        if self.profile.get("interests"):
            parts.append(f"兴趣：{', '.join(self.profile['interests'])}")
        return " | ".join(parts) if parts else "无已知用户偏好"

    def _save(self):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(self.profile, f, ensure_ascii=False, indent=2)

    def _load(self) -> dict:
        if os.path.exists(self.filepath):
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}


# ============================================
# 整合：多层记忆 Agent
# ============================================
class MultiLayerMemoryAgent:
    """
    多层记忆 Agent
    - 短期记忆：当前对话上下文
    - 长期记忆：持久化的关键事实
    - 偏好记忆：用户画像
    """

    def __init__(self, system_base: str = "你是一个有帮助的AI助手。"):
        self.system_base = system_base
        self.conversation = ConversationBuffer(max_turns=20)
        self.facts = FactStore()
        self.profile = UserProfile()

    def _build_system_prompt(self) -> str:
        """动态构建系统提示：整合三层记忆"""
        parts = [self.system_base]

        # 注入用户偏好
        profile_ctx = self.profile.get_system_context()
        if profile_ctx != "无已知用户偏好":
            parts.append(f"\n[用户画像] {profile_ctx}")

        # 注入相关长期记忆
        recent_facts = self.facts.get_all_facts()[-10:]  # 最近10条事实
        if recent_facts:
            facts_str = "\n".join(f"- {f}" for f in recent_facts)
            parts.append(f"\n[已知事实]\n{facts_str}")

        return "\n".join(parts)

    def chat(self, user_input: str) -> str:
        # 构建完整消息
        system_msg = {"role": "system", "content": self._build_system_prompt()}
        messages = [system_msg] + self.conversation.get_messages()
        messages.append({"role": "user", "content": user_input})

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        reply = response.choices[0].message.content

        # 更新短期记忆
        self.conversation.add("user", user_input)
        self.conversation.add("assistant", reply)

        return reply

    def remember_fact(self, fact: str, category: str = "general"):
        """手动存储一条长期记忆"""
        self.facts.add_fact(fact, category)

    def set_preference(self, key: str, value):
        """设置用户偏好"""
        self.profile.update(key, value)


# === 使用示例 ===
if __name__ == "__main__":
    agent = MultiLayerMemoryAgent()

    # 设置用户偏好
    agent.set_preference("name", "小明")
    agent.set_preference("response_style", "详细且带有代码示例")
    agent.set_preference("interests", ["Python", "AI Agent", "Rust"])

    # 存储长期事实
    agent.remember_fact("小明是一名后端开发者，主要使用 Python 和 FastAPI", "user_info")
    agent.remember_fact("小明的项目使用 PostgreSQL 数据库", "project")

    # 对话
    reply = agent.chat("帮我写一个 REST API 的 hello world")
    print(f"助手: {reply}")
    # 预期：回复会根据小明的偏好（详细+代码示例），使用 FastAPI 框架来写

    reply2 = agent.chat("我的项目用的什么数据库来着？")
    print(f"助手: {reply2}")
    # 预期：能从长期记忆中回答 "PostgreSQL"
```

---

### 案例五：完整 Agent 系统中的 Memory 集成

前四个案例分别演示了单一记忆组件，但**真实 Agent 系统需要将记忆融入整个运行循环**。这个案例展示一个完整的个人助理 Agent，包含工具调用、自动记忆管理、记忆驱动的决策。

```python
"""
案例5：完整 Agent 系统中的 Memory 集成
========================================
一个模拟个人助理的 Agent，展示：
  1. 记忆如何贯穿 Agent 的整个生命周期
  2. Agent 如何自动从对话中提取并存储记忆
  3. Agent 如何利用记忆做出个性化决策
  4. 工具调用的结果如何写入记忆
  5. 会话结束时如何将短期记忆沉淀为长期记忆

依赖：pip install openai
"""
import json
import os
from datetime import datetime
from openai import OpenAI

client = OpenAI(api_key="your-api-key")


# ============================================
# 第一部分：记忆系统（三层记忆）
# ============================================
class MemorySystem:
    """
    统一记忆系统，管理三层记忆：
    - 短期：当前对话上下文
    - 长期：持久化的事实和知识
    - 情景：带时间戳的事件记录
    """

    def __init__(self, session_id: str = "default"):
        self.session_id = session_id
        # 短期记忆
        self.conversation: list[dict] = []
        self.max_turns = 15
        # 长期记忆（持久化文件）
        self.memory_file = f"memory_{session_id}.json"
        self.long_term: dict = self._load_long_term() or {
            "facts": [],          # 关键事实
            "preferences": {},    # 用户偏好
            "events": []          # 情景事件记录
        }

    # ---------- 短期记忆操作 ----------
    def add_message(self, role: str, content: str):
        self.conversation.append({"role": role, "content": content})
        # 滑动窗口：超过限制时移除最早的消息（保留 system）
        while len(self.conversation) > self.max_turns * 2:
            self.conversation.pop(0)

    def get_context(self, system_prompt: str) -> list[dict]:
        """构建完整的上下文（system + 记忆注入 + 对话历史）"""
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(self.conversation)
        return messages

    # ---------- 长期记忆操作 ----------
    def add_fact(self, fact: str, category: str = "general"):
        """存储一个长期事实"""
        entry = {
            "content": fact,
            "category": category,
            "timestamp": datetime.now().isoformat()
        }
        # 简单去重：相同内容不重复存储
        existing = [f["content"] for f in self.long_term["facts"]]
        if fact not in existing:
            self.long_term["facts"].append(entry)
            self._save_long_term()

    def set_preference(self, key: str, value: str):
        """设置用户偏好"""
        self.long_term["preferences"][key] = value
        self._save_long_term()

    def get_preference(self, key: str) -> str | None:
        return self.long_term["preferences"].get(key)

    def log_event(self, event: str, event_type: str = "interaction"):
        """记录情景事件"""
        self.long_term["events"].append({
            "event": event,
            "type": event_type,
            "timestamp": datetime.now().isoformat()
        })
        self._save_long_term()

    def get_relevant_facts(self, query: str, max_items: int = 5) -> list[str]:
        """基于关键词检索相关事实（简化版语义检索）"""
        query_lower = query.lower()
        scored = []
        for fact in self.long_term["facts"]:
            # 简单关键词匹配评分
            words = fact["content"].lower().split()
            overlap = sum(1 for w in query_lower.split() if w in words)
            if overlap > 0:
                scored.append((overlap, fact["content"]))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [s[1] for s in scored[:max_items]]

    # ---------- 持久化 ----------
    def _save_long_term(self):
        with open(self.memory_file, "w", encoding="utf-8") as f:
            json.dump(self.long_term, f, ensure_ascii=False, indent=2)

    def _load_long_term(self) -> dict | None:
        if os.path.exists(self.memory_file):
            with open(self.memory_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    # ---------- 会话结束时沉淀 ----------
    def consolidate(self):
        """
        会话结束时：将短期记忆中的关键信息沉淀到长期记忆
        这是记忆从"短时"到"长时"的关键步骤
        """
        if len(self.conversation) < 2:
            return

        conversation_text = "\n".join(
            f"{m['role']}: {m['content']}" for m in self.conversation
        )

        # 用 LLM 从对话中提取值得长期记住的信息
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "system",
                "content": """从以下对话中提取值得长期记住的信息，返回 JSON：
{
  "facts": ["事实1", "事实2"],
  "preferences": {"key": "value"},
  "important_events": ["事件1"]
}
只提取用户明确表达的信息，不要猜测。如果没有值得记住的内容，返回空数组/对象。"""
            }, {
                "role": "user",
                "content": conversation_text
            }],
            response_format={"type": "json_object"}
        )

        try:
            extracted = json.loads(response.choices[0].message.content)
            for fact in extracted.get("facts", []):
                self.add_fact(fact, category="extracted")
            for key, value in extracted.get("preferences", {}).items():
                self.set_preference(key, value)
            for event in extracted.get("important_events", []):
                self.log_event(event, event_type="extracted")
            print(f"  [记忆沉淀] 提取了 {len(extracted.get('facts', []))} 条事实, "
                  f"{len(extracted.get('preferences', {}))} 条偏好")
        except json.JSONDecodeError:
            pass


# ============================================
# 第二部分：工具系统
# ============================================
class ToolSystem:
    """Agent 可调用的工具集合"""

    @staticmethod
    def search_web(query: str) -> str:
        """模拟网页搜索（实际应调用搜索 API）"""
        return f"搜索结果：关于「{query}」的最新信息。[模拟数据]"

    @staticmethod
    def calculate(expression: str) -> str:
        """计算器工具"""
        try:
            result = eval(expression)  # 生产环境请用安全的表达式解析器
            return f"计算结果：{expression} = {result}"
        except Exception as e:
            return f"计算错误：{e}"

    @staticmethod
    def get_current_time() -> str:
        return f"当前时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"


# ============================================
# 第三部分：Agent 核心
# ============================================
class PersonalAssistantAgent:
    """
    个人助理 Agent —— 记忆贯穿整个运行循环

    运行流程：
    用户输入
       │
       ▼
    ① 记忆注入 → 从记忆系统获取相关事实 + 偏好 + 最近事件
       │
       ▼
    ② 构建 Prompt → system_prompt + 记忆上下文 + 对话历史
       │
       ▼
    ③ LLM 推理 → 生成响应（可能包含工具调用）
       │
       ▼
    ④ 工具执行 → 调用工具并将结果写入记忆
       │
       ▼
    ⑤ 响应返回 → 同时更新短期记忆
       │
       ▼
    ⑥ （会话结束时）记忆沉淀 → 短期 → 长期
    """

    def __init__(self, session_id: str = "default"):
        self.memory = MemorySystem(session_id)
        self.tools = ToolSystem()
        self.model = "gpt-4o"

        # 工具定义（给 LLM 看的）
        self.tool_definitions = [
            {
                "type": "function",
                "function": {
                    "name": "search_web",
                    "description": "搜索互联网获取信息",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "搜索关键词"}
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "calculate",
                    "description": "执行数学计算",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "expression": {"type": "string", "description": "数学表达式"}
                        },
                        "required": ["expression"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_current_time",
                    "description": "获取当前时间",
                    "parameters": {"type": "object", "properties": {}}
                }
            }
        ]

    def _build_system_prompt(self) -> str:
        """
        ① 记忆注入：动态构建系统提示，将记忆嵌入其中
        这是 Agent "回忆" 的核心步骤
        """
        parts = [
            "你是一个个人助理 AI，名字叫 Clau。",
            "你能记住用户的偏好和过去的对话，并据此提供个性化服务。"
        ]

        # 注入用户偏好
        prefs = self.memory.long_term.get("preferences", {})
        if prefs:
            pref_lines = [f"  - {k}: {v}" for k, v in prefs.items()]
            parts.append("\n[用户偏好]\n" + "\n".join(pref_lines))

        # 注入相关长期事实
        if self.memory.conversation:
            last_user_msg = ""
            for m in reversed(self.memory.conversation):
                if m["role"] == "user":
                    last_user_msg = m["content"]
                    break
            if last_user_msg:
                relevant = self.memory.get_relevant_facts(last_user_msg)
                if relevant:
                    parts.append("\n[相关记忆]\n" + "\n".join(f"  - {f}" for f in relevant))

        # 注入最近的事件记录
        recent_events = self.memory.long_term.get("events", [])[-3:]
        if recent_events:
            event_lines = [
                f"  - [{e['timestamp'][:10]}] {e['event']}" for e in recent_events
            ]
            parts.append("\n[最近事件]\n" + "\n".join(event_lines))

        return "\n".join(parts)

    def _call_tool(self, tool_name: str, arguments: dict) -> str:
        """④ 工具执行 + 记录到记忆"""
        result = ""
        if tool_name == "search_web":
            result = self.tools.search_web(**arguments)
        elif tool_name == "calculate":
            result = self.tools.calculate(**arguments)
        elif tool_name == "get_current_time":
            result = self.tools.get_current_time()
        else:
            result = f"未知工具：{tool_name}"

        # 工具调用结果写入情景记忆
        self.memory.log_event(
            f"调用了工具 {tool_name}({arguments}) → {result[:80]}",
            event_type="tool_use"
        )
        return result

    def chat(self, user_input: str) -> str:
        """完整的 Agent 对话循环"""

        # ⑤ 更新短期记忆
        self.memory.add_message("user", user_input)

        # ② 构建完整上下文
        system_prompt = self._build_system_prompt()
        messages = self.memory.get_context(system_prompt)

        # ③ LLM 推理（带工具支持）
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=self.tool_definitions,
            tool_choice="auto"
        )

        message = response.choices[0].message

        # 处理工具调用循环
        while message.tool_calls:
            # 将助手的工具调用意图加入上下文
            messages.append(message)

            for tool_call in message.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)

                # ④ 执行工具并记录
                tool_result = self._call_tool(func_name, func_args)

                # 将工具结果加入上下文
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result
                })

            # 再次调用 LLM，让其基于工具结果生成最终回复
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=self.tool_definitions,
                tool_choice="auto"
            )
            message = response.choices[0].message

        # 获取最终回复
        reply = message.content or "(无回复)"

        # ⑤ 更新短期记忆
        self.memory.add_message("assistant", reply)

        return reply

    def end_session(self):
        """
        ⑥ 会话结束：记忆沉淀
        将本次对话中的关键信息从短期记忆提取到长期记忆
        """
        print("\n[会话结束] 正在沉淀记忆...")
        self.memory.consolidate()
        print("[会话结束] 记忆沉淀完成。")


# ============================================
# 运行示例
# ============================================
if __name__ == "__main__":
    # 创建 Agent（同一 session_id 会加载之前的长期记忆）
    agent = PersonalAssistantAgent(session_id="xiaoming")

    print("=" * 50)
    print("个人助理 Clau 已启动（输入 'quit' 退出）")
    print("=" * 50)

    while True:
        user_input = input("\n你: ").strip()
        if user_input.lower() in ("quit", "exit", "退出"):
            agent.end_session()
            print("再见！")
            break
        if not user_input:
            continue

        reply = agent.chat(user_input)
        print(f"\nClau: {reply}")

    # --- 模拟交互流程（非交互模式测试）---
    # agent = PersonalAssistantAgent(session_id="xiaoming")
    #
    # # 第一次会话
    # print(agent.chat("我叫小明，我喜欢吃川菜"))
    # print(agent.chat("请帮我算一下 128 * 365 等于多少"))
    # print(agent.chat("记住我偏好简洁的回答风格"))
    # agent.end_session()  # 沉淀记忆
    #
    # # 第二次会话（模拟重启后）
    # agent2 = PersonalAssistantAgent(session_id="xiaoming")
    # print(agent2.chat("你知道我喜欢吃什么吗？"))       # 从长期记忆回答
    # print(agent2.chat("你还记得我的回答风格偏好吗？"))  # 从偏好记忆回答
    # agent2.end_session()
```

### 案例五的架构图

```
┌──────────────────────────────────────────────────────┐
│                  PersonalAssistantAgent               │
│                                                      │
│  ┌─────────────┐  ①注入   ┌──────────────────────┐  │
│  │  chat()入口  │ ──────→ │  _build_system_prompt │  │
│  └──────┬──────┘         │  从记忆系统读取:       │  │
│         │                │  · 用户偏好            │  │
│         ▼                │  · 相关事实            │  │
│  ┌─────────────┐         │  · 最近事件            │  │
│  │  构建消息    │ ②       └──────────────────────┘  │
│  │  system +   │                                     │
│  │  记忆 +     │                                     │
│  │  对话历史   │                                     │
│  └──────┬──────┘                                     │
│         │                                            │
│         ▼                                            │
│  ┌─────────────┐         ┌──────────────────────┐  │
│  │  LLM 推理   │ ③  工具  │     ToolSystem       │  │
│  │  (循环)     │ ←─────→ │  · search_web        │  │
│  │             │  ④调用   │  · calculate         │  │
│  └──────┬──────┘         │  · get_current_time  │  │
│         │                └──────────────────────┘  │
│         ▼                                            │
│  ┌─────────────┐         ┌──────────────────────┐  │
│  │  返回响应    │ ⑤更新   │    MemorySystem      │  │
│  └──────┬──────┘ ──────→ │  ┌─────────────────┐ │  │
│         │                │  │ 短期: 对话历史   │ │  │
│         │   (退出时)      │  ├─────────────────┤ │  │
│         │    ⑥沉淀       │  │ 长期: 事实+偏好  │ │  │
│         └──────────────→ │  ├─────────────────┤ │  │
│                          │  │ 情景: 事件记录   │ │  │
│                          │  └─────────────────┘ │  │
│                          │  → memory_xiaoming.json│  │
│                          └──────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 案例五的关键设计要点

| 步骤           | 位置                                | 说明                                       |
| ------------ | --------------------------------- | ---------------------------------------- |
| **① 记忆注入**   | `_build_system_prompt()`          | 每次对话前，从记忆系统读取偏好、事实、事件，嵌入 system prompt   |
| **② 上下文构建**  | `chat()`                          | system prompt + 短期记忆（对话历史）组装为完整 messages |
| **③ LLM 推理** | `chat()`                          | 基于完整上下文推理，可能触发工具调用                       |
| **④ 工具执行**   | `_call_tool()`                    | 执行工具后，结果自动写入情景记忆                         |
| **⑤ 响应更新**   | `chat()`                          | 用户输入和助手回复都追加到短期记忆                        |
| **⑥ 记忆沉淀**   | `end_session()` → `consolidate()` | 用 LLM 从短期记忆提取关键信息存入长期记忆                  |

---

## 主流开源记忆框架对比

| 框架                    | 特点                                   | 适用场景                            |
| --------------------- | ------------------------------------ | ------------------------------- |
| **Mem0**              | 专为 Agent 设计的记忆层，支持自动记忆提取、向量检索、冲突解决   | 需要开箱即用的记忆增强                     |
| **LlamaIndex Memory** | 短期/长期记忆分离，支持 token 限制 + 持久化          | 已使用 LlamaIndex 生态的项目            |
| **LangChain Memory**  | 多种内存策略（Buffer/Window/Summary/Entity） | 已使用 LangChain 生态的项目             |
| **OpenAI Agents SDK** | 内置 `examples/memory`，轻量级             | 使用 OpenAI Agents SDK 构建的多 Agent |
| **agents.md**         | 将记忆写入文件，实现跨会话持续学习                    | 轻量级、无需额外依赖                      |

---

## 记忆策略选择指南

```
你的 Agent 需要什么记忆？
│
├── 只需要当前对话 → 案例一（对话历史列表）
│
├── 对话很长但只需最近内容 → 案例二（滑动窗口）
│
├── 需要跨会话记住事实 → 案例三（向量检索）
│
└── 完整的个性化体验 → 案例四（多层架构）
```

---

## 关键设计原则

1. **不要把所有东西都存进上下文** — 只检索与当前对话最相关的记忆
2. **记忆需要定期维护** — 合并重复记忆、清理过期信息
3. **区分记忆类型** — 不同类型的记忆用不同的存储和检索策略
4. **保护用户隐私** — 敏感信息加密存储，提供遗忘/删除机制
5. **记忆可解释性** — 让用户知道 Agent 记住了什么

---

## 参考资料

- [解密prompt系列55.Agent Memory的工程实现 - Mem0 & LlamaIndex](https://cloud.tencent.com/developer/article/2528447)
- [Agent 记忆系统完整实现系列](https://blog.csdn.net/sgr011215/article/details/159426099)
- [MemOS 源码笔记 — 记忆分类](https://www.cnblogs.com/rossiXYZ/p/19347325)
- [Agentic Memory: 大模型智能体的统一记忆管理框架](https://blog.csdn.net/wangjunaijiao/article/details/157405306)
- [OpenAI Agents SDK GitHub](https://github.com/openai/openai-agents-python)
- [腾讯云 Agent Memory 服务](https://so.html5.qq.com/page/real/search_news?docid=70000021_82769cf4f9f88152)
- [一口气读完 Agent Memory 的 21 篇核心论文](https://github.com/adongwanai/AgentGuide/blob/main/resources/agent/papers/agent_memory/)
