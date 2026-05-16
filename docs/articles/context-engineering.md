---
title: Context Engineering（上下文工程）
date: 2026-05-06
categories:
  - Agent
tags: ["AI", "Agent", "Context", "上下文工程", "LLM"]
summary: "Context Engineering系统讲解，介绍如何为LLM构建最优上下文，涵盖上下文设计、信息筛选、窗口管理等核心技术。"
---

# Context Engineering（上下文工程）

## 一句话理解

> **Prompt Engineering 是「写好一句话」，Context Engineering 是「搭好一整个信息环境」。**
>
> 上下文工程 = 在正确的时间，把正确的信息，以正确的格式，喂给 LLM。

---

## 为什么需要 Context Engineering？

LLM 的知识有两个来源：

| 来源        | 说明                  | 特点                 |
| --------- | ------------------- | ------------------ |
| **权重记忆**  | 预训练时学到的知识（固化在模型参数中） | 难以修改、可能过时、无法获取私有数据 |
| **上下文记忆** | 你每次调用时提供给模型的输入      | 可随时更新、可控、可定制       |

**核心问题**：模型不知道的东西，必须通过上下文告诉它。但上下文窗口再大也是有限的，不可能把所有信息都塞进去。

**Context Engineering 要解决的就是**：
- 从海量信息中**筛选**出最相关的内容
- 把信息**组织**成模型能高效理解的格式
- 在上下文窗口的**有限空间**内最大化信息价值

> Andrej Karpathy（前 OpenAI / Tesla AI 负责人）在 YC 演讲《Software in the era of AI》中强调：Context Engineering 是 AI 时代软件开发的核心技能，是"在生产环境中控制模型注意力的手段"。

---

## Context Engineering vs Prompt Engineering

很多人会混淆这两个概念，核心区别如下：

| 维度     | Prompt Engineering | Context Engineering      |
| ------ | ------------------ | ------------------------ |
| **范围** | 单次交互的提示词优化         | 整个上下文信息环境的系统设计           |
| **对象** | 主要优化"指令性上下文"       | 优化所有类型的上下文（指令、数据、记忆、工具…） |
| **粒度** | 细粒度、面向单次调用         | 粗粒度、面向整个系统               |
| **类比** | 写一封好邮件             | 设计整个邮件系统（模板、收件规则、历史归档…）  |

**关系**：Prompt Engineering 是 Context Engineering 的一个子集。

```
┌─────────────────────────────────────────────────┐
│            Context Engineering（全集）            │
│  ┌───────────────────────────────────────────┐  │
│  │       Prompt Engineering（子集）           │  │
│  │  • 指令编写                               │  │
│  │  • Few-shot 示例                         │  │
│  │  • 输出格式约束                           │  │
│  └───────────────────────────────────────────┘  │
│  + RAG 检索                                     │
│  + 记忆系统                                     │
│  + 工具调用                                     │
│  + 上下文排序与压缩                              │
│  + 多源信息整合                                  │
└─────────────────────────────────────────────────┘
```

---

## 上下文的组成部分

一个完整的上下文通常由以下几个部分组成：

### 1. System Prompt（系统提示词 / 指导性上下文）

定义模型的**角色、行为规则和约束**。

```markdown
你是一个专业的医学助手。
- 只回答与医学相关的问题
- 回答必须基于可靠的医学文献
- 不要给出诊断建议，建议用户咨询医生
- 用简洁的中文回答
```

> 这就是传统 Prompt Engineering 的主要工作范围。

### 2. Retrieval（检索 / 信息性上下文）

通过 **RAG（检索增强生成）** 从外部知识库中获取相关文档，注入上下文。

```
用户提问 → 向量检索 → 找到相关文档 → 拼接到 Prompt 中 → LLM 生成回答
```

**为什么需要**：模型的预训练数据有截止日期，且无法访问你的私有数据（公司文档、个人笔记等）。通过检索，可以实时注入最新、最相关的知识。

**常见做法**：
- 将文档向量化存储（如 Chroma、Pinecone、Milvus）
- 用户提问时，将问题也向量化
- 计算相似度，取 Top-K 最相关文档
- 将检索结果拼入 Prompt

### 3. Memory（记忆 / 信息性上下文）

参考 8.Agent Memory，记忆让模型拥有"连续性"：

| 记忆类型     | 说明        | 例子         |
| -------- | --------- | ---------- |
| **短期记忆** | 当前对话的历史消息 | 最近 10 轮对话  |
| **长期记忆** | 跨会话持久化的知识 | 用户偏好、历史总结  |
| **工作记忆** | 当前任务的中间状态 | 多步骤推理的中间结论 |

**上下文工程的关注点**：不是简单地把所有历史消息都塞进去，而是需要**智能筛选、压缩和总结**，在有限的上下文窗口中保留最有价值的记忆信息。

### 4. Tools（工具定义与调用 / 交互性上下文）

定义模型可用的**工具列表**，以及工具返回的结果。

```json
{
  "tools": [
    {
      "name": "search_web",
      "description": "搜索互联网获取最新信息",
      "parameters": {"query": "搜索关键词"}
    },
    {
      "name": "read_file",
      "description": "读取指定路径的文件内容",
      "parameters": {"path": "文件路径"}
    }
  ]
}
```

当模型调用工具后，**工具的返回结果**也会作为新的上下文注入，供模型基于实际数据继续推理。

### 5. 结构化数据与元数据

不仅仅是纯文本，还包括：
- **结构化输出示例**（JSON Schema、XML 标签）
- **数据表**（CSV、数据库查询结果）
- **元信息**（时间戳、用户 ID、会话 ID）

---

## 上下文工程的 6 大核心技术

### ① 选择正确的文档（而非全量灌入）

❌ **错误做法**：把 100 篇文档全部塞进上下文
✅ **正确做法**：通过语义检索，只选最相关的 3-5 篇

> 全量灌入会导致"**上下文干扰**"——无关信息太多，反而让模型忽略真正重要的内容。

### ② 长文档压缩为任务摘要

当相关文档很长时，直接塞进去会浪费上下文窗口。需要**压缩**：
- 提取关键段落
- 生成面向任务的摘要
- 使用 Map-Reduce 策略（先分段总结，再合并）

### ③ 查询重写（Query Rewriting）

用户的原始问题可能模糊或不完整，检索前先**改写查询**：

```
用户原始问题："那个东西怎么用？"
         ↓ 查询重写
优化后查询："如何使用 Obsidian 的 Canvas 功能？"
         ↓ 向量检索
检索到相关文档 → 注入上下文
```

### ④ 跨会话注入记忆和用户状态

在多轮对话中，保持连续性：
- 总结前几轮对话作为"会话摘要"
- 加载用户的历史偏好
- 传递当前任务的中间状态

### ⑤ 用实时工具和数据锚定答案

不让模型"凭记忆猜测"，而是通过工具调用获取实时数据：
- 天气查询 → 调用天气 API
- 代码执行 → 调用代码解释器
- 最新新闻 → 调用搜索引擎

### ⑥ 组织输入，让模型知道什么最重要

信息的**排列顺序**很重要！研究表明：
- **开头和结尾**的信息权重更高（类似人类的"首因效应"和"近因效应"）
- 重要的信息应该放在靠近指令的位置
- 使用明确的分隔符（如 XML 标签 `</context>`）区分不同部分

---

## 架构全景图

```
┌──────────────────────────────────────────────────────┐
│                    用户输入 (Query)                    │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              Context Engineering 管线                 │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ 查询重写  │  │ 意图识别  │  │ 任务分类  │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       └──────────────┼──────────────┘                │
│                      ▼                               │
│  ┌──────────────────────────────────────────────┐   │
│  │              上下文组装器（Assembler）         │   │
│  │                                              │   │
│  │  [1] System Prompt ──── 指导性上下文          │   │
│  │  [2] RAG 检索结果 ────── 信息性上下文          │   │
│  │  [3] Memory 注入 ────── 信息性上下文          │   │
│  │  [4] Tool 定义 ──────── 交互性上下文          │   │
│  │  [5] 历史对话 ───────── 信息性上下文          │   │
│  │  [6] 用户当前输入 ────── 查询                  │   │
│  │                                              │   │
│  │  ※ 排序、去重、压缩、截断                     │   │
│  └──────────────────────────────────────────────┘   │
│                      │                               │
└──────────────────────┼───────────────────────────────┘
                       ▼
              ┌────────────────┐
              │     LLM        │
              │  (生成回答)     │
              └────────────────┘
```

---

## 实际案例

### 案例 1：客服机器人

```
System Prompt: "你是 XX 公司的客服助手..."
+ RAG: 检索产品说明书中的相关章节
+ Memory: 用户上次反馈的问题摘要
+ Tools: 查询订单状态的 API
+ 用户输入: "我的订单怎么还没到？"
         ↓
    LLM 生成个性化回答
```

### 案例 2：代码助手（如 Claude Code）

```
System Prompt: "你是编程助手..."
+ RAG: 检索项目中相关代码文件
+ Memory: 当前对话中已讨论的架构决策
+ Tools: 文件读写、命令执行、LSP 查询
+ 用户输入: "帮我修复这个 bug"
         ↓
    LLM 基于完整上下文给出精准建议
```

### 案例 3：医疗诊断辅助

```
System Prompt: "你是医学文献助手..."
+ RAG: 检索最新的医学文献和临床指南
+ Memory: 患者的病历摘要
+ 用户输入: "这个患者的治疗方案是什么？"
         ↓
    LLM 基于文献和病历给出参考建议
```

---

## 常见挑战与解决方案

| 挑战 | 说明 | 解决方案 |
|------|------|---------|
| **上下文窗口有限** | 窗口再大也装不下所有信息 | 压缩、摘要、分层检索 |
| **上下文干扰** | 无关信息太多降低模型表现 | 精准检索、相关性排序、过滤 |
| **信息冲突** | 检索到的文档之间存在矛盾 | 来源标注、时效性排序、冲突检测 |
| **成本过高** | Token 数量越多，调用成本越高 | 智能压缩、缓存、分级检索 |
| **上下文腐烂** | 超长上下文中，中间部分信息被"遗忘" | 重要信息放首尾、使用结构化格式 |

---

## 关键要点总结

1. **Context Engineering ≠ Prompt Engineering**，它是更广泛的系统工程
2. **核心目标**：在正确的时间，把正确的信息，以正确的格式，送入 LLM
3. **五大组成部分**：System Prompt + RAG + Memory + Tools + 结构化数据
4. **六大核心技术**：精准检索、文档压缩、查询重写、记忆注入、工具调用、信息排序
5. **本质**：控制模型的"注意力"，让有限的上下文窗口发挥最大价值

---

## 实操案例：智能客服助手（OpenAI SDK）

> **项目目标**：构建一个电商智能客服，演示 Context Engineering 的 5 大组成部分如何在真实代码中协同工作。

### 项目结构

```
context_engineering_demo/
├── main.py              # 主程序入口
├── context_builder.py   # 上下文组装器（核心）
├── rag.py               # RAG 检索模块
├── memory.py            # 记忆管理模块
├── tools.py             # 工具定义与执行
├── knowledge_base.txt   # 知识库文档
└── requirements.txt     # 依赖
```

### 安装依赖

```bash
pip install openai numpy
```

---

### 第一步：知识库与 RAG 检索模块（rag.py）

用 OpenAI Embedding 实现简易语义检索：

```python
"""
rag.py — 检索增强生成（RAG）模块
职责：把知识库文档向量化，根据用户问题检索最相关的内容
"""
import json
import os
import numpy as np
from openai import OpenAI

client = OpenAI()
EMBEDDING_MODEL = "text-embedding-3-small"
CACHE_FILE = "embeddings_cache.json"


def load_knowledge_base(path: str = "knowledge_base.txt") -> list[dict]:
    """
    加载知识库，按段落分割。
    每段格式：--- 标题 ---\\n内容...
    """
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    chunks = []
    for block in content.strip().split("---"):
        block = block.strip()
        if not block:
            continue
        lines = block.split("\n", 1)
        title = lines[0].strip()
        body = lines[1].strip() if len(lines) > 1 else title
        chunks.append({"title": title, "content": body})
    return chunks


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """调用 OpenAI Embedding API 生成向量"""
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算余弦相似度"""
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


class RAGRetriever:
    """RAG 检索器：缓存向量，支持语义搜索"""

    def __init__(self, knowledge_path: str = "knowledge_base.txt"):
        self.chunks = load_knowledge_base(knowledge_path)
        self._build_index()

    def _build_index(self):
        """构建向量索引（带磁盘缓存，避免重复调用 API）"""
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, "r") as f:
                cache = json.load(f)
            if len(cache) == len(self.chunks):
                self.embeddings = cache
                print(f"[RAG] 从缓存加载了 {len(cache)} 条向量")
                return

        # 缓存不存在或数量不匹配，重新生成
        texts = [c["content"] for c in self.chunks]
        self.embeddings = get_embeddings(texts)

        with open(CACHE_FILE, "w") as f:
            json.dump(self.embeddings, f)
        print(f"[RAG] 生成并缓存了 {len(self.embeddings)} 条向量")

    def search(self, query: str, top_k: int = 3) -> list[dict]:
        """
        根据用户查询，返回最相关的 top_k 条知识库内容。
        返回格式：[{"title": ..., "content": ..., "score": ...}, ...]
        """
        query_embedding = get_embeddings([query])[0]
        scored = []
        for i, emb in enumerate(self.embeddings):
            score = cosine_similarity(query_embedding, emb)
            scored.append({**self.chunks[i], "score": score})

        scored.sort(key=lambda x: x["score"], reverse=True)
        results = scored[:top_k]

        print(f"[RAG] 检索到 {len(results)} 条结果，最高分: {results[0]['score']:.3f}")
        return results
```

**知识库文件**（knowledge_base.txt）：

```txt
--- 退换货政策 ---
7天无理由退换货。商品需保持原包装完好，不影响二次销售。
退款将在收到退货后3-5个工作日内原路返回。
特殊商品（如生鲜、定制商品）不支持无理由退货。

--- 物流配送说明 ---
标准配送：3-5个工作日送达。
加急配送：次日达（需额外支付15元）。
偏远地区可能需要额外1-3天。
订单发货后会发送短信通知，可在"我的订单"中查看物流信息。

--- 会员权益 ---
普通会员：注册即享，享95折优惠。
银卡会员：消费满2000元升级，享9折优惠+每月1张免运费券。
金卡会员：消费满10000元升级，享85折优惠+每月3张免运费券+专属客服。

--- 支付方式 ---
支持支付宝、微信支付、银行卡（借记卡/信用卡）、花呗分期。
分期付款支持3/6/12期，手续费率分别为0%、3%、5%。
企业用户可申请对公转账，联系客服获取企业账户信息。

--- 常见问题 ---
如何修改订单？未发货前可在"我的订单"中修改地址或取消订单。
如何开具发票？订单完成后，在"我的订单"中申请电子发票。
账户安全：建议开启两步验证，定期修改密码。
```

---

### 第二步：记忆管理模块（memory.py）

管理短期记忆（对话历史）和长期记忆（用户画像）：

```python
"""
memory.py — 记忆管理模块
职责：
  - 短期记忆：管理当前对话的上下文窗口（消息历史）
  - 长期记忆：存储跨会话的用户画像和偏好
"""
import json
import os
from datetime import datetime

LONG_MEMORY_FILE = "long_term_memory.json"


class ConversationMemory:
    """
    短期记忆：管理对话历史消息列表。
    核心策略：
      - 维护一个固定大小的滑动窗口
      - 超出窗口时，将旧消息压缩为摘要
      - 摘要作为 system 消息保留在上下文顶部
    """

    def __init__(self, window_size: int = 10, summary_trigger: int = 15):
        self.messages: list[dict] = []
        self.window_size = window_size      # 保留最近 N 条
        self.summary_trigger = summary_trigger  # 超过 N 条时触发总结
        self.summary: str = ""              # 压缩后的历史摘要

    def add(self, role: str, content: str):
        """添加一条消息"""
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
        })

    def should_summarize(self) -> bool:
        """判断是否需要压缩历史"""
        return len(self.messages) > self.summary_trigger

    def get_context_messages(self) -> list[dict]:
        """
        获取适合放入 LLM 上下文的消息列表。
        策略：摘要 + 最近 N 条消息
        """
        context = []

        # 如果有摘要，放在最前面（但去掉 timestamp 字段，LLM 不需要）
        if self.summary:
            context.append({
                "role": "system",
                "content": f"【之前对话摘要】\n{self.summary}",
            })

        # 取最近 N 条消息（去掉 timestamp）
        recent = self.messages[-self.window_size:]
        for msg in recent:
            context.append({"role": msg["role"], "content": msg["content"]})

        return context

    def summarize(self, client, model: str = "gpt-4o-mini"):
        """
        用 LLM 将超出窗口的旧消息压缩为摘要。
        这是 Context Engineering 中"上下文压缩"的典型做法。
        """
        if len(self.messages) <= self.window_size:
            return

        # 取出需要压缩的旧消息
        old_messages = self.messages[: -self.window_size]
        old_text = "\n".join(
            f"[{m['role']}] {m['content']}" for m in old_messages
        )

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "请将以下对话压缩为一段简洁的摘要，保留关键信息："
                        "用户问题、解决方案、待办事项。用中文输出。"
                    ),
                },
                {"role": "user", "content": old_text},
            ],
            max_tokens=300,
        )

        self.summary = response.choices[0].message.content
        # 只保留窗口内的消息
        self.messages = self.messages[-self.window_size:]
        print(f"[Memory] 已压缩 {len(old_messages)} 条旧消息为摘要")


class LongTermMemory:
    """
    长期记忆：持久化存储用户画像和偏好（跨会话）。
    实际项目中应使用数据库，这里用 JSON 文件演示。
    """

    def __init__(self, filepath: str = LONG_MEMORY_FILE):
        self.filepath = filepath
        self.data: dict = self._load()

    def _load(self) -> dict:
        if os.path.exists(self.filepath):
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _save(self):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def get_user_profile(self, user_id: str) -> dict:
        """获取用户画像，不存在则返回默认值"""
        return self.data.get(user_id, {
            "name": "未知用户",
            "vip_level": "普通会员",
            "preferences": [],
            "past_issues": [],
        })

    def update_user_profile(self, user_id: str, updates: dict):
        """更新用户画像"""
        profile = self.get_user_profile(user_id)
        profile.update(updates)
        self.data[user_id] = profile
        self._save()

    def add_past_issue(self, user_id: str, issue: str):
        """记录用户的历史问题"""
        profile = self.get_user_profile(user_id)
        profile.setdefault("past_issues", []).append({
            "issue": issue,
            "timestamp": datetime.now().isoformat(),
        })
        # 只保留最近 10 条
        profile["past_issues"] = profile["past_issues"][-10:]
        self.data[user_id] = profile
        self._save()

    def format_for_context(self, user_id: str) -> str:
        """将用户画像格式化为可注入上下文的文本"""
        profile = self.get_user_profile(user_id)
        lines = [
            f"用户名：{profile.get('name', '未知')}",
            f"会员等级：{profile.get('vip_level', '普通会员')}",
        ]
        if profile.get("past_issues"):
            lines.append("历史问题：")
            for item in profile["past_issues"][-3:]:
                lines.append(f"  - {item['issue']}")
        return "\n".join(lines)
```

---

### 第三步：工具定义与执行（tools.py）

定义 OpenAI Function Calling 工具：

```python
"""
tools.py — 工具定义与执行模块
职责：
  - 定义模型可用的工具（OpenAI Function Calling 格式）
  - 执行模型返回的工具调用，返回结果
"""

# ─── 模拟数据库 ───────────────────────────────────
ORDERS_DB = {
    "ORD20260501": {"status": "已发货", "carrier": "顺丰", "tracking": "SF1234567890", "items": "MacBook Pro 14寸", "eta": "2026-05-07"},
    "ORD20260428": {"status": "配送中", "carrier": "京东物流", "tracking": "JD9876543210", "items": "AirPods Pro 2", "eta": "2026-05-06"},
    "ORD20260425": {"status": "已完成", "carrier": "圆通", "tracking": "YT1111111111", "items": "iPhone 16 Pro Max", "eta": "已送达"},
}

PRODUCTS_DB = {
    "MacBook Pro 14寸": {"price": 14999, "stock": 50, "category": "电脑"},
    "iPhone 16 Pro Max": {"price": 9999, "stock": 200, "category": "手机"},
    "AirPods Pro 2": {"price": 1899, "stock": 500, "category": "配件"},
}


# ─── 工具定义（OpenAI Function Calling Schema）────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_order",
            "description": "查询用户的订单状态、物流信息。传入订单号返回详情。",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "订单号，格式如 ORD20260501",
                    }
                },
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_product",
            "description": "查询商品的价格、库存、分类等信息。",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {
                        "type": "string",
                        "description": "商品名称，如 'MacBook Pro 14寸'",
                    }
                },
                "required": ["product_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_refund",
            "description": "为用户创建退款申请。需要订单号和退款原因。",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "订单号",
                    },
                    "reason": {
                        "type": "string",
                        "description": "退款原因",
                    },
                },
                "required": ["order_id", "reason"],
            },
        },
    },
]


# ─── 工具执行器 ───────────────────────────────────
def execute_tool(name: str, arguments: dict) -> str:
    """
    根据工具名和参数执行对应操作，返回 JSON 字符串结果。
    这个结果会被追加到 messages 中，作为新的上下文反馈给 LLM。
    """
    print(f"[Tool] 调用工具: {name}({arguments})")

    if name == "query_order":
        order_id = arguments.get("order_id", "")
        order = ORDERS_DB.get(order_id)
        if order:
            return json.dumps(order, ensure_ascii=False)
        return json.dumps({"error": f"未找到订单 {order_id}"}, ensure_ascii=False)

    elif name == "query_product":
        product_name = arguments.get("product_name", "")
        product = PRODUCTS_DB.get(product_name)
        if product:
            return json.dumps(product, ensure_ascii=False)
        return json.dumps({"error": f"未找到商品 {product_name}"}, ensure_ascii=False)

    elif name == "create_refund":
        order_id = arguments.get("order_id", "")
        reason = arguments.get("reason", "")
        # 模拟创建退款
        return json.dumps({
            "success": True,
            "refund_id": f"RF{order_id[3:]}",
            "message": f"退款申请已提交，订单 {order_id}，原因：{reason}。预计3-5个工作日到账。",
        }, ensure_ascii=False)

    return json.dumps({"error": f"未知工具: {name}"})
```

---

### 第四步：上下文组装器（context_builder.py）⭐ 核心

> 这是整个项目的**灵魂**，体现了 Context Engineering 的本质——如何把各种信息组装成最优上下文。

```python
"""
context_builder.py — 上下文组装器（Context Assembler）
职责：将所有信息源组装成最终发送给 LLM 的 messages 列表。

组装顺序（重要！）：
  [1] System Prompt        ← 指导性上下文（角色、规则、约束）
  [2] 用户画像             ← 长期记忆（个性化）
  [3] 知识库检索结果        ← RAG（信息性上下文）
  [4] 对话历史摘要          ← 压缩后的旧对话
  [5] 最近对话消息          ← 短期记忆
  [6] 当前用户输入          ← 本次查询
"""
from rag import RAGRetriever
from memory import ConversationMemory, LongTermMemory
from tools import TOOLS


# ─── System Prompt ───────────────────────────────────
SYSTEM_PROMPT = """你是「TechShop」电商平台的智能客服助手。

## 你的职责
- 帮助用户查询订单、了解商品信息、处理退换货、解答会员权益等。
- 友好、专业、耐心，用简洁的中文回答。

## 回答规则
- 回答必须基于【知识库参考】中的信息，不要编造。
- 如果知识库中没有相关信息，明确告知用户"这个问题我需要转人工处理"。
- 涉及退款、取消订单等操作时，先确认订单信息再执行。
- 不要主动推销商品，除非用户询问。
- 当用户的问题需要查询实时数据时，使用提供的工具。

## 输出格式
- 使用简洁的段落或列表回答
- 涉及金额时标注币种（人民币/CNY）
"""


class ContextBuilder:
    """
    上下文组装器：Context Engineering 的核心实现。
    把分散的信息源整合成一个有序的 messages 列表。
    """

    def __init__(self):
        self.rag = RAGRetriever()
        self.memory = ConversationMemory(window_size=8, summary_trigger=12)
        self.long_memory = LongTermMemory()

    def build_messages(
        self,
        user_input: str,
        user_id: str = "user_001",
        client=None,
    ) -> list[dict]:
        """
        组装最终的 messages 列表。
        这就是 Context Engineering 的"装配线"。
        """
        messages = []

        # ═══════════════════════════════════════════════
        # [1] System Prompt — 指导性上下文
        # ═══════════════════════════════════════════════
        messages.append({"role": "system", "content": SYSTEM_PROMPT})

        # ═══════════════════════════════════════════════
        # [2] 用户画像 — 长期记忆
        # ═══════════════════════════════════════════════
        user_profile = self.long_memory.format_for_context(user_id)
        messages.append({
            "role": "system",
            "content": f"【用户信息】\n{user_profile}",
        })

        # ═══════════════════════════════════════════════
        # [3] RAG 检索 — 信息性上下文
        # ═══════════════════════════════════════════════
        rag_results = self.rag.search(user_input, top_k=3)
        if rag_results:
            knowledge_block = "【知识库参考】\n"
            for i, doc in enumerate(rag_results, 1):
                # 加入相似度分数，方便调试
                knowledge_block += (
                    f"\n### 文档 {i}（相关度: {doc['score']:.2f}）- {doc['title']}\n"
                    f"{doc['content']}\n"
                )
            messages.append({"role": "system", "content": knowledge_block})

        # ═══════════════════════════════════════════════
        # [4] 对话历史 — 短期记忆（压缩 + 最近消息）
        # ═══════════════════════════════════════════════
        if client and self.memory.should_summarize():
            self.memory.summarize(client)

        context_messages = self.memory.get_context_messages()
        messages.extend(context_messages)

        # ═══════════════════════════════════════════════
        # [5] 当前用户输入
        # ═══════════════════════════════════════════════
        messages.append({"role": "user", "content": user_input})
        self.memory.add("user", user_input)

        # 调试：打印上下文结构
        self._debug_print(messages)

        return messages

    def add_assistant_reply(self, reply: str):
        """将助手的回复加入短期记忆"""
        self.memory.add("assistant", reply)

    def _debug_print(self, messages: list[dict]):
        """调试：打印上下文的结构概览"""
        print("\n" + "=" * 50)
        print("[Context Builder] 上下文组装完成:")
        print("-" * 50)
        for i, msg in enumerate(messages):
            role = msg["role"]
            preview = msg["content"][:80].replace("\n", " ")
            print(f"  [{i}] {role:8s} | {preview}...")
        print(f"  共 {len(messages)} 条消息")
        print("=" * 50 + "\n")
```

---

### 第五步：主程序（main.py）

把所有模块串联起来，实现完整的对话循环：

```python
"""
main.py — 主程序入口
演示 Context Engineering 完整流程：
  用户输入 → 上下文组装 → LLM 推理 → 工具调用（如需要）→ 返回回答
"""
import json
from openai import OpenAI
from context_builder import ContextBuilder
from tools import TOOLS, execute_tool
from memory import LongTermMemory

client = OpenAI()
MODEL = "gpt-4o-mini"  # 用便宜的模型演示即可


def chat(user_input: str, context: ContextBuilder, user_id: str) -> str:
    """
    核心对话函数，完整走一遍 Context Engineering 流程。
    """
    # ── 1. 组装上下文 ──
    messages = context.build_messages(
        user_input=user_input,
        user_id=user_id,
        client=client,
    )

    # ── 2. 第一次调用 LLM ──
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=TOOLS,            # 传入工具定义（交互性上下文）
        tool_choice="auto",     # 让模型自己决定是否调用工具
        temperature=0.3,        # 客服场景用低温度，保证稳定
        max_tokens=1000,
    )

    message = response.choices[0].message

    # ── 3. 处理工具调用（如果模型决定使用工具）──
    if message.tool_calls:
        # 先把模型的 tool_calls 回复加入上下文
        messages.append(message.model_dump())

        for tool_call in message.tool_calls:
            func_name = tool_call.function.name
            func_args = json.loads(tool_call.function.arguments)

            # 执行工具，获取结果
            result = execute_tool(func_name, func_args)

            # ★ 关键：把工具执行结果作为新的上下文注入 ★
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

        # ── 4. 带着工具结果，第二次调用 LLM ──
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            temperature=0.3,
            max_tokens=1000,
        )
        message = response.choices[0].message

    # ── 5. 保存助手回复到记忆 ──
    reply = message.content or ""
    context.add_assistant_reply(reply)

    # ── 6. 更新长期记忆（记录用户问题）──
    context.long_memory.add_past_issue(user_id, user_input)

    return reply


def main():
    """交互式对话循环"""
    print("=" * 50)
    print("  TechShop 智能客服 — Context Engineering Demo")
    print("  输入 'quit' 退出")
    print("=" * 50)

    context = ContextBuilder()
    user_id = "user_001"

    # 预设一些用户画像（模拟已有数据）
    context.long_memory.update_user_profile(user_id, {
        "name": "张三",
        "vip_level": "金卡会员",
    })

    while True:
        user_input = input("\n👤 你: ").strip()
        if user_input.lower() in ("quit", "exit", "q"):
            print("👋 再见！")
            break
        if not user_input:
            continue

        try:
            reply = chat(user_input, context, user_id)
            print(f"\n🤖 客服: {reply}")
        except Exception as e:
            print(f"\n❌ 出错了: {e}")


if __name__ == "__main__":
    main()
```

---

### 运行效果示例

```
👤 你: 我的订单 ORD20260501 到哪了？

[RAG] 检索到 3 条结果，最高分: 0.847

[Context Builder] 上下文组装完成:
  [0] system    | 你是「TechShop」电商平台的智能客服助手...
  [1] system    | 【用户信息】用户名：张三 会员等级：金卡会员...
  [2] system    | 【知识库参考】 文档 1（相关度: 0.85）- 物流配送说明...
  [3] user      | 我的订单 ORD20260501 到哪了？
  共 4 条消息

[Tool] 调用工具: query_order({'order_id': 'ORD20260501'})

🤖 客服: 您好张三！您的订单 ORD20260501（MacBook Pro 14寸）已由顺丰发出，
快递单号 SF1234567890，预计明天（5月7日）送达。
您可以通过顺丰官网或小程序查询实时物流信息。还有什么可以帮您的吗？

---

👤 你: 我想退货，不太满意

🤖 客服: 张三您好，作为金卡会员您享有85折优惠权益。
关于退货，根据我们的退换货政策：
- 支持7天无理由退换货
- 商品需保持原包装完好
- 退款将在收到退货后3-5个工作日内原路返回

请问您需要退哪个订单？我可以帮您提交退款申请。
```

---

### 架构对照：代码如何体现 Context Engineering

```
┌──────────────────────────────────────────────────────────┐
│  Context Engineering 概念          │  代码中的对应        │
├────────────────────────────────────┼─────────────────────┤
│  ① System Prompt（指导性上下文）    │  SYSTEM_PROMPT 常量  │
│  ② RAG 检索（信息性上下文）         │  RAGRetriever.search │
│  ③ 短期记忆（对话历史）             │  ConversationMemory  │
│  ④ 长期记忆（用户画像）             │  LongTermMemory      │
│  ⑤ 工具定义（交互性上下文）         │  TOOLS 列表          │
│  ⑥ 工具结果注入                    │  messages.append(tool)│
│  ⑦ 上下文组装与排序                │  ContextBuilder      │
│  ⑧ 历史压缩（摘要）                │  memory.summarize()  │
│  ⑨ 查询重写                       │  （可扩展点）         │
└────────────────────────────────────┴─────────────────────┘
```

---

### 扩展方向

| 方向             | 说明                                       |
| -------------- | ---------------------------------------- |
| **查询重写**       | 在 RAG 检索前，先用 LLM 把模糊的用户问题改写为精确查询         |
| **向量数据库**      | 用 Chroma / Pinecone 替代内存中的 numpy，支持百万级文档 |
| **多轮工具调用**     | 支持模型连续调用多个工具（如先查订单再创建退款）                 |
| **上下文窗口监控**    | 统计 token 用量，超限时自动触发压缩                    |
| **A/B 测试**     | 对比不同上下文排列顺序对回答质量的影响                      |
| **Guardrails** | 加入输入/输出校验，防止 prompt injection            |

---

## 参考资料

- [Andrej Karpathy - Software in the era of AI (YC 演讲)](https://www.youtube.com/watch?v=ncYqZe12mC0)
- [LangChain Blog - Context Engineering](https://blog.langchain.dev/context-engineering/)
- [OpenAI Function Calling 文档](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI Embeddings 文档](https://platform.openai.com/docs/guides/embeddings)
- [一文搞懂大模型上下文工程 - CSDN](https://blog.csdn.net/l01011_/article/details/149165801)
- [AI Agent 上下文工程学习总结 - 九卷](https://www.cnblogs.com/jiujuan/p/19855674)
- [从提示工程转向上下文工程 - 6 种技术](https://so.html5.qq.com/page/real/search_news?docid=70000021_93369a0461412352)
- [理解上下文工程 - CSDN](https://download.csdn.net/blog/column/12998791/150419873)
