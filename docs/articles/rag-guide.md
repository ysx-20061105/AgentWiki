---
title: RAG（检索增强生成）
date: 2026-05-12
categories:
  - Agent
tags: ["AI", "RAG", "Embedding", "向量数据库", "检索增强生成", "大模型应用"]
summary: "RAG（检索增强生成）完全指南，涵盖文档处理、向量化、检索策略、生成优化及生产级RAG系统构建。"
---

# RAG（检索增强生成）

> 参考资料：[Datawhale All-in-RAG](https://github.com/datawhalechina/all-in-rag) —— 大模型应用开发实战：RAG 技术全栈指南

## 一句话理解

> RAG = **Retrieval-Augmented Generation**（检索增强生成）
> 你可以把它想象成：**给 LLM 配一个"开卷考试"的翻书助手**——先帮你翻到最相关的几页资料，再让 LLM 基于这些资料来回答问题。

**为什么需要 RAG？** 因为纯 LLM 有三大硬伤：

| 硬伤 | 说明 | 例子 |
|------|------|------|
| **知识过时** | 训练数据有截止日期 | 问 GPT-4o "今天天气怎样？"它不知道 |
| **幻觉（Hallucination）** | 编造不存在的事实 | 一本正经地胡说某个论文的内容 |
| **无法访问私有数据** | 没见过你的文档 | 问你公司内部的规章制度，它答不了 |

**RAG 的解决思路**：不改模型本身，而是在生成答案前，先从外部知识库中检索相关内容，塞进上下文里，让 LLM "有据可依"。

---

## 一、RAG 的发展历程

RAG 从 2020 年提出至今，经历了三个阶段：

```
朴素 RAG（Naive RAG，2020-2023）
  │  最简单的"检索→拼接→生成"三步走
  │
  ▼
高级 RAG（Advanced RAG，2023-2024）
  │  增加了查询改写、重排序、压缩等优化环节
  │
  ▼
模块化 RAG（Modular RAG，2024-2025）
  │  把每个环节变成可插拔的模块，按需组合
  │
  ▼
┌─────────────────┬──────────────────┐
│                 │                  │
▼                 ▼                  ▼
Graph RAG        Agentic RAG       Self-RAG
（知识图谱索引）   （Agent 驱动检索）   （自我反思检索）
解决跨文档关联     Agent 自主决策       模型动态判断
支持多跳推理      何时检索、检索什么     是否需要检索
```

### 1.1 朴素 RAG（Naive RAG）

最简单的三步走：

```
用户提问 → 向量检索 Top-K 相关文档 → 拼接到 Prompt → LLM 生成答案
```

**优点**：简单、快速搭建
**缺点**：检索质量不稳定、无法处理复杂问题、存在"大海捞针"问题

### 1.2 高级 RAG（Advanced RAG）

在朴素 RAG 基础上增加了多个优化环节：

| 优化环节                           | 作用             | 说明                          |
| ------------------------------ | -------------- | --------------------------- |
| **查询改写（Query Rewriting）**      | 把模糊问题变成精确查询    | "这个东西怎么用？" → "如何安装和配置 XXX？" |
| **混合检索（Hybrid Search）**        | 语义检索 + 关键词检索结合 | 兼顾"理解意思"和"精确匹配"             |
| **重排序（Reranker）**              | 对检索结果二次排序      | 用专门的模型把最相关的排到最前面            |
| **上下文压缩（Context Compression）** | 去掉检索结果中的冗余信息   | 只保留与问题相关的部分                 |

### 1.3 模块化 RAG（Modular RAG）

把 RAG 的每个环节变成**可插拔的模块**，根据场景灵活组装：

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ 数据加载  │→│ 文本分块  │→│ Embedding │→│ 向量存储  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
                                                │
┌──────────┐  ┌──────────┐  ┌──────────┐        │
│ LLM 生成  │←│ 重排序    │←│ 向量检索  │←───────┘
└──────────┘  └──────────┘  └──────────┘
```

### 1.4 2025-2026 前沿方向

| 方向 | 核心思想 | 适用场景 |
|------|---------|---------|
| **Graph RAG** | 用知识图谱索引替代纯向量索引 | 需要多跳推理的复杂问题 |
| **Agentic RAG** | 让 Agent 自主决定何时检索、检索什么 | 动态查询、多轮对话 |
| **Self-RAG** | 模型在生成过程中动态判断是否需要检索 | 减少不必要的检索开销 |
| **CAG（Cache-Augmented Generation）** | 预加载知识到上下文 + KV Cache | 知识库小且稳定的场景 |

> 详细的前沿方向分析见 0.学习路线#4.2 RAG 进阶（检索增强生成）

---

## 二、RAG 的完整流程

一个完整的 RAG 系统分为 **离线（准备阶段）** 和 **在线（查询阶段）** 两个部分：

### 2.1 流程全景图

```
═══════════════════ 离线阶段（做一次） ═══════════════════

  原始文档（PDF/Word/网页/数据库）
       │
       ▼
  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ ① 数据  │ ──→ │ ② 文本  │ ──→ │ ③ 向量  │ ──→ │ ④ 存入  │
  │   加载   │     │   分块   │     │   化     │     │  向量库  │
  └─────────┘     └─────────┘     └─────────┘     └─────────┘
  (Document       (Chunking)      (Embedding)     (Vector DB)
   Loading)

═══════════════════ 在线阶段（每次查询） ═══════════════════

  用户提问
       │
       ▼
  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ ⑤ 查询  │ ──→ │ ⑥ 相似  │ ──→ │ ⑦ 拼接  │ ──→ │ ⑧ LLM  │
  │  向量化   │     │  度检索  │     │  Prompt  │     │  生成    │
  └─────────┘     └─────────┘     └─────────┘     └─────────┘
                                                    │
                                                    ▼
                                               返回给用户
```

### 2.2 每一步做什么？

| 步骤  | 阶段  | 做什么           | 输入 → 输出               |
| :-: | :-: | ------------- | --------------------- |
|  ①  | 离线  | **数据加载**      | 各种格式的文件 → 纯文本         |
|  ②  | 离线  | **文本分块**      | 长文本 → 多个短文本块（chunk）   |
|  ③  | 离线  | **向量化**       | 文本块 → 数字向量（数组）        |
|  ④  | 离线  | **存入向量库**     | 向量 → 向量数据库（如 Qdrant）   |
|  ⑤  | 在线  | **查询向量化**     | 用户问题 → 问题向量           |
|  ⑥  | 在线  | **相似度检索**     | 问题向量 → Top-K 最相关的文本块  |
|  ⑦  | 在线  | **拼接 Prompt** | 问题 + 相关文本 → 完整 Prompt |
|  ⑧  | 在线  | **LLM 生成**    | 完整 Prompt → 最终答案      |

---

## 三、各流程如何实现

### 3.1 数据加载（Document Loading）

> 目标：把各种格式的文件变成干净的纯文本

| 格式 | 常用工具 | 说明 |
|------|---------|------|
| PDF | `PyPDFLoader`、`Unstructured` | 提取文字、表格 |
| Word | `UnstructuredWordDocumentLoader` | .docx 文件 |
| Markdown | `UnstructuredMarkdownLoader` | .md 文件 |
| 网页 | `WebBaseLoader`、BeautifulSoup | HTML 爬取清洗 |
| 数据库 | `SQLDatabase` | 结构化数据 |
| CSV/Excel | `CSVLoader`、`PandasLoader` | 表格数据 |

**Python 实现示例**（使用 `pypdf` 原生库）：

```python
from pypdf import PdfReader

# 加载 PDF 文件
reader = PdfReader("data/产品手册.pdf")

documents = []
for i, page in enumerate(reader.pages):
    text = page.extract_text()
    if text.strip():  # 跳过空白页
        documents.append({
            "content": text,
            "metadata": {
                "source": "data/产品手册.pdf",
                "page": i + 1
            }
        })

# 查看加载结果
print(f"共加载 {len(documents)} 页")
print(f"第一页内容预览：{documents[0]['content'][:200]}")
print(f"元数据：{documents[0]['metadata']}")  # 包含页码、来源等信息
```

> 安装：`pip install pypdf`

### 3.2 文本分块（Chunking）

> 目标：把长文档切成适合检索和 LLM 处理的小块

**为什么要分块？**
- 太长：检索不够精准，超出模型上下文限制
- 太短：语义不完整，丢失上下文
- 最佳实践：500-1000 字一块，相邻块之间重叠 100-200 字

#### 常见分块策略

| 策略 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **固定大小分块** | 按字符/Token 数切分 | 简单、确定性 | 可能切断句子 |
| **递归字符分块** | 按 `\n\n` → `\n` → `.` → 空格 逐级切分 | 保留更多语义边界 | 略复杂 |
| **语义分块** | 根据语义相似度动态切分 | 语义最完整 | 计算成本高 |
| **结构化分块** | 按文档结构（标题、段落）切分 | 保留文档结构 | 依赖文档格式 |

**Python 实现示例**（纯 Python 实现递归字符分块）：

```python
def recursive_split(text: str, chunk_size: int = 500, chunk_overlap: int = 100,
                    separators: list[str] = None) -> list[str]:
    """递归字符分块：优先在语义边界处切分"""
    if separators is None:
        separators = ["\n\n", "\n", "。", "！", "？", "，", ".", "!", "?", ", ", " ", ""]

    # 如果文本已经足够短，直接返回
    if len(text) <= chunk_size:
        return [text.strip()] if text.strip() else []

    # 尝试用当前分隔符切分
    sep = separators[0]
    remaining_seps = separators[1:]

    if sep == "":
        # 最后一层：按字符硬切
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start = end - chunk_overlap
        return [c.strip() for c in chunks if c.strip()]

    parts = text.split(sep)
    chunks = []
    current = ""

    for part in parts:
        candidate = current + sep + part if current else part
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            if current:
                # 当前块太大，递归用更细的分隔符再切
                if len(current) > chunk_size:
                    chunks.extend(recursive_split(current, chunk_size, chunk_overlap, remaining_seps))
                else:
                    chunks.append(current)
            current = part

    if current:
        if len(current) > chunk_size:
            chunks.extend(recursive_split(current, chunk_size, chunk_overlap, remaining_seps))
        else:
            chunks.append(current)

    return [c.strip() for c in chunks if c.strip()]

# 使用示例
all_chunks = []
for doc in documents:
    doc_chunks = recursive_split(doc["content"], chunk_size=500, chunk_overlap=100)
    for chunk in doc_chunks:
        all_chunks.append({
            "content": chunk,
            "metadata": doc["metadata"]  # 继承来源信息
        })

print(f"原始文档被切分为 {len(all_chunks)} 个块")
print(f"第一块内容：{all_chunks[0]['content'][:100]}...")
```

**重叠（Overlap）的作用示意**：

```
文档原文：
"...人工智能正在改变世界。机器学习是AI的核心技术。深度学习是机器学习的子集。..."

无重叠切分：
块1: "...人工智能正在改变世界。机器学习是AI的核心"  ← "技术"被切断
块2: "技术。深度学习是机器学习的子集。..."

有重叠切分（overlap=50字符）：
块1: "...人工智能正在改变世界。机器学习是AI的核心技术。深度学习"
块2: "机器学习是AI的核心技术。深度学习是机器学习的子集。..."  ← 信息完整
```

### 3.3 向量化（Embedding）

> 详见下方 [第四章：什么是 Embedding](#四什么是-embedding为什么要-embedding)

### 3.4 向量存储（Vector Database）

> 目标：把向量存起来，支持高效的相似度搜索

#### 常见向量数据库

| 数据库          | 特点               | 适用场景     |
| ------------ | ---------------- | -------- |
| **Chroma**   | 轻量、嵌入式、Python 原生 | 原型开发、小规模 |
| **FAISS**    | Meta 开源、速度极快     | 大规模检索、研究 |
| **Milvus**   | 分布式、生产级          | 企业级部署    |
| **Pinecone** | 云托管、零运维          | 快速上线     |
| **Weaviate** | 支持混合搜索           | 多模态检索    |
| **Qdrant**   | 高性能、Rust 实现      | 高并发场景    |

**Python 实现示例**（使用 Qdrant + OpenAI SDK）：

```python
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

# 0. 初始化客户端
openai_client = OpenAI()
qdrant = QdrantClient(path="./qdrant_db")  # 本地文件存储（也可连接远程服务端）

# 1. 创建集合（如果不存在）
COLLECTION_NAME = "my_docs"
EMBEDDING_MODEL = "text-embedding-3-small"
DIMENSION = 1536  # text-embedding-3-small 的维度

if not qdrant.collection_exists(COLLECTION_NAME):
    qdrant.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=DIMENSION, distance=Distance.COSINE)
    )

# 2. 批量 Embedding
texts = [chunk["content"] for chunk in all_chunks]
response = openai_client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
vectors = [item.embedding for item in response.data]

# 3. 存入 Qdrant
points = []
for i, (chunk, vector) in enumerate(zip(all_chunks, vectors)):
    points.append(PointStruct(
        id=i,
        vector=vector,
        payload={"content": chunk["content"], **chunk["metadata"]}
    ))

qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
print(f"成功存入 {len(points)} 个向量")
```

> 安装：`pip install qdrant-client openai`

### 3.5 检索（Retrieval）

> 目标：根据用户问题，找到最相关的文本块

#### 检索方式对比

| 方式               | 原理                | 优点          | 缺点        |
| ---------------- | ----------------- | ----------- | --------- |
| **向量检索（稠密检索）**   | 计算问题向量与文档向量的余弦相似度 | 理解语义，支持模糊匹配 | 可能漏掉精确关键词 |
| **关键词检索（稀疏检索）**  | BM25 等传统算法，基于词频匹配 | 精确匹配速度快     | 不理解语义     |
| **混合检索（Hybrid）** | 向量 + 关键词结合        | 兼顾语义和精确性    | 需要调权重     |

**Python 实现示例**（使用 Qdrant + OpenAI SDK）：

```python
def search(query: str, top_k: int = 3) -> list[dict]:
    """向量检索：把问题向量化，找最相似的文档块"""
    # 1. 将问题向量化（使用同一个 Embedding 模型）
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=query
    )
    query_vector = response.data[0].embedding

    # 2. 在 Qdrant 中检索最相似的 Top-K
    results = qdrant.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=top_k
    )

    return [
        {
            "content": point.payload.get("content", ""),
            "source": point.payload.get("source", "未知"),
            "page": point.payload.get("page", "?"),
            "score": point.score  # 相似度分数（0~1）
        }
        for point in results.points
    ]

# 使用
results = search("如何配置数据库连接？", top_k=3)

for i, r in enumerate(results):
    print(f"--- 结果 {i+1} (来源: {r['source']} 第{r['page']}页, 相似度: {r['score']:.3f}) ---")
    print(r["content"][:200])
    print()
```

#### 带重排序的检索（Advanced RAG）

> 基本思路：先用向量检索多取一些（如 Top-10），再用 Reranker 模型精排，挑出最相关的 Top-3。

```python
# 方案一：使用 OpenAI LLM 做重排序（无需额外模型）
def rerank_with_llm(query: str, candidates: list[dict], top_n: int = 3) -> list[dict]:
    """让 LLM 根据相关性对候选文档排序"""
    # 把候选文档编号
    docs_text = "\n\n".join(
        f"[{i+1}] {c['content'][:300]}" for i, c in enumerate(candidates)
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {"role": "system", "content": "你是文档排序助手。根据查询与文档的相关性，返回最相关的文档编号列表（JSON数组）。"},
            {"role": "user", "content": f"查询：{query}\n\n候选文档：\n{docs_text}\n\n请返回最相关的 {top_n} 个文档编号，格式：[1, 3, 5]"}
        ]
    )

    import json
    ranked_ids = json.loads(response.choices[0].message.content)
    return [candidates[i - 1] for i in ranked_ids if 0 < i <= len(candidates)]

# 方案二：使用 Cohere Rerank API（效果更好）
def rerank_with_cohere(query: str, candidates: list[dict], top_n: int = 3) -> list[dict]:
    """使用 Cohere Rerank 重排序（需安装 cohere: pip install cohere）"""
    import cohere
    co = cohere.ClientV2(api_key="your-cohere-api-key")

    response = co.rerank(
        model="rerank-v3.5",
        query=query,
        documents=[c["content"] for c in candidates],
        top_n=top_n
    )

    return [candidates[r.index] for r in response.results]

# 使用：先检索 Top-10，再重排序取 Top-3
candidates = search("如何配置数据库连接？", top_k=10)
reranked = rerank_with_llm("如何配置数据库连接？", candidates, top_n=3)

for r in reranked:
    print(f"[相似度: {r['score']:.3f}] {r['content'][:150]}")
```

### 3.6 生成（Generation）

> 目标：把检索到的相关文档 + 用户问题一起发给 LLM，生成最终答案

**Python 实现示例**（完整 RAG 链路，纯 OpenAI SDK）：

```python
def rag_answer(question: str, top_k: int = 3) -> str:
    """完整 RAG：检索 → 拼接 Prompt → LLM 生成"""

    # ⑤⑥ 检索相关文档
    docs = search(question, top_k=top_k)
    context = "\n\n".join(f"[来源: {d['source']} 第{d['page']}页]\n{d['content']}" for d in docs)

    # ⑦ 构建 Prompt
    prompt = f"""你是一个有帮助的助手。请根据以下参考资料回答用户的问题。
如果参考资料中没有相关信息，请如实说明不要编造。

参考资料：
{context}

用户问题：{question}

请回答："""

    # ⑧ LLM 生成
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {"role": "system", "content": "你是一个基于参考资料回答问题的助手。"},
            {"role": "user", "content": prompt}
        ]
    )

    return response.choices[0].message.content

# 使用
answer = rag_answer("如何配置数据库连接？")
print(answer)
```

### 3.7 最小可运行 RAG（完整示例）

把上面所有步骤串起来，**一个完整的最小 RAG，基于 OpenAI SDK + Qdrant**：

```python
"""
最小可运行 RAG 完整示例
依赖：pip install openai qdrant-client pypdf numpy
"""
import json
import numpy as np
from openai import OpenAI
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

# ========== 配置 ==========
PDF_PATH = "data/产品手册.pdf"
COLLECTION = "my_docs"
EMBED_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4o-mini"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100
TOP_K = 3

# ========== 初始化 ==========
client = OpenAI()
qdrant = QdrantClient(path="./qdrant_db")


# ========== ① 加载 PDF ==========
def load_pdf(path: str) -> list[dict]:
    reader = PdfReader(path)
    return [
        {"content": page.extract_text(), "source": path, "page": i + 1}
        for i, page in enumerate(reader.pages) if page.extract_text().strip()
    ]


# ========== ② 分块 ==========
def split_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    seps = ["\n\n", "\n", "。", "！", "？", "，", " "]
    if len(text) <= size:
        return [text.strip()]
    for sep in seps:
        if sep not in text:
            continue
        parts, chunks, cur = text.split(sep), [], ""
        for part in parts:
            nxt = (cur + sep + part) if cur else part
            if len(nxt) <= size:
                cur = nxt
            else:
                if cur:
                    chunks.append(cur)
                cur = part
        if cur:
            chunks.append(cur)
        # 处理仍然过大的块
        result = []
        for c in chunks:
            if len(c) > size:
                result.extend(split_text(c, size, overlap))
            else:
                result.append(c)
        return result
    # 无分隔符可切，硬切
    return [text[i:i+size] for i in range(0, len(text), size - overlap)]


def chunk_docs(docs: list[dict]) -> list[dict]:
    chunks = []
    for doc in docs:
        for text in split_text(doc["content"]):
            chunks.append({"content": text, "source": doc["source"], "page": doc["page"]})
    return chunks


# ========== ③ Embedding + ④ 存入 Qdrant ==========
def build_index(chunks: list[dict]):
    if not qdrant.collection_exists(COLLECTION):
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
        )
    texts = [c["content"] for c in chunks]
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    points = [
        PointStruct(id=i, vector=resp.data[i].embedding, payload=chunks[i])
        for i in range(len(chunks))
    ]
    qdrant.upsert(collection_name=COLLECTION, points=points)
    print(f"✅ 已索引 {len(points)} 个文档块")


# ========== ⑤⑥ 检索 ==========
def search(query: str, k: int = TOP_K) -> list[dict]:
    vec = client.embeddings.create(model=EMBED_MODEL, input=query).data[0].embedding
    hits = qdrant.query_points(collection_name=COLLECTION, query=vec, limit=k)
    return [{"content": h.payload["content"], "source": h.payload["source"],
             "page": h.payload["page"], "score": h.score} for h in hits.points]


# ========== ⑦⑧ RAG 生成 ==========
def ask(question: str) -> str:
    docs = search(question)
    context = "\n\n".join(f"[{d['source']} p.{d['page']}]\n{d['content']}" for d in docs)
    resp = client.chat.completions.create(
        model=CHAT_MODEL, temperature=0,
        messages=[
            {"role": "system", "content": "根据参考资料回答，没有信息就如实说不知道。"},
            {"role": "user", "content": f"参考资料：\n{context}\n\n问题：{question}"}
        ]
    )
    return resp.choices[0].message.content


# ========== 主流程 ==========
if __name__ == "__main__":
    # 离线阶段：加载 → 分块 → 索引
    raw_docs = load_pdf(PDF_PATH)
    chunks = chunk_docs(raw_docs)
    build_index(chunks)

    # 在线阶段：提问 → 检索 → 生成
    print(ask("这个产品有哪些功能？"))
```

---

## 四、什么是 Embedding？为什么要 Embedding？

### 4.1 一句话理解

> Embedding（嵌入）= **把文字变成一组数字（向量）**，让计算机能"计算"文字之间的语义关系。

### 4.2 为什么需要 Embedding？

**计算机无法直接理解文字**。传统方式用关键词匹配（"苹果" 只能匹配 "苹果"），但：

| 场景 | 关键词匹配 | Embedding 语义匹配 |
|------|-----------|-------------------|
| "忘记密码" vs "账号被锁" | ❌ 没有共同关键词 | ✅ 语义相近，向量距离近 |
| "苹果公司" vs "苹果手机" | ❌ 关键词相同但含义不同 | ✅ 语义相近（都是科技产品） |
| "machine learning" vs "机器学习" | ❌ 不同语言 | ✅ 语义相同，向量距离近 |

### 4.3 Embedding 的工作原理

```
输入文本
    │
    ▼
┌──────────────────┐
│   Embedding 模型   │   ← 预训练的神经网络（如 BERT、BGE、text-embedding-3）
│  （语义编码器）     │
└──────────────────┘
    │
    ▼
浮点数向量（如 1536 维）
[0.12, -0.34, 0.56, 0.78, ..., -0.91]
```

**核心思想**：语义相似的文本 → 向量空间中距离近的点

```
        向量空间（简化为 2D 示意）

    ↑ 维度2
    │        ★ "如何学习Python"
    │       ★ "Python入门教程"
    │
    │                    ★ "今天天气不错"
    │                   ★ "明天会下雨吗"
    │
    └──────────────────→ 维度1

    "如何学习Python" 和 "Python入门教程" 距离近 → 语义相似
    "如何学习Python" 和 "今天天气不错" 距离远 → 语义不相关
```

### 4.4 相似度计算方法

最常用的是**余弦相似度（Cosine Similarity）**：

```python
import numpy as np

def cosine_similarity(a, b):
    """计算两个向量的余弦相似度"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# 模拟 Embedding 向量
vec_如何学习 = [0.8, 0.6, 0.1, 0.2]
vec_Python入门 = [0.75, 0.55, 0.15, 0.25]  # 语义相近
vec_今天天气 = [0.1, 0.05, 0.9, 0.85]       # 语义不同

print(f""如何学习Python" vs "Python入门教程"：{cosine_similarity(vec_如何学习, vec_Python入门):.3f}")
# → 0.995（非常相似）

print(f""如何学习Python" vs "今天天气不错"：{cosine_similarity(vec_如何学习, vec_今天天气):.3f}")
# → 0.321（不相似）
```

### 4.5 常用 Embedding 模型

| 模型 | 维度 | 说明 | 推荐场景 |
|------|:----:|------|---------|
| **text-embedding-3-small** | 1536 | OpenAI，性价比高 | 快速开发、英文为主 |
| **text-embedding-3-large** | 3072 | OpenAI，最高精度 | 高精度要求 |
| **BGE-M3** | 1024 | 智源 BAAI，支持多语言 | 中文场景 ⭐推荐 |
| **BGE-large-zh** | 1024 | 智源 BAAI，中文优化 | 纯中文场景 |
| **M3E** | 768 | Moka AI，中文开源 | 中文免费方案 |
| **Qwen3-Embedding-8B** | 可变 | 通义千问，最新最强 | 中文高性能需求 |

### 4.6 Python 实战：Embedding 调用

```python
from openai import OpenAI

client = OpenAI()

# 单个文本 Embedding
response = client.embeddings.create(
    model="text-embedding-3-small",
    input="RAG 是一种检索增强生成技术"
)

vector = response.data[0].embedding
print(f"向量维度：{len(vector)}")  # 1536
print(f"前 5 个值：{vector[:5]}")  # [0.12, -0.34, 0.56, ...]

# 批量 Embedding（一次请求处理多个文本）
texts = [
    "RAG 是检索增强生成技术",
    "Retrieval Augmented Generation",
    "今天天气真好"
]

response = client.embeddings.create(
    model="text-embedding-3-small",
    input=texts
)

# 计算相似度
import numpy as np

vectors = [item.embedding for item in response.data]

for i in range(len(texts)):
    for j in range(i + 1, len(texts)):
        sim = np.dot(vectors[i], vectors[j]) / (
            np.linalg.norm(vectors[i]) * np.linalg.norm(vectors[j])
        )
        print(f""{texts[i]}" vs "{texts[j]}"：{sim:.3f}")

# 输出示例：
# "RAG是检索增强生成技术" vs "Retrieval Augmented Generation"：0.876（相似）
# "RAG是检索增强生成技术" vs "今天天气真好"：0.152（不相似）
```

### 4.7 Embedding 技术演进

```
① 静态词嵌入（2013-2017）
   Word2Vec、GloVe
   每个词只有一个固定的向量
   "苹果"无论是水果还是公司 → 同一个向量 ❌
        │
        ▼
② 动态上下文嵌入（2018-2022）
   BERT、RoBERTa
   根据上下文动态调整向量
   "苹果公司发布新产品" vs "吃了一个苹果" → 不同向量 ✅
        │
        ▼
③ 大规模多语言嵌入（2023-2026）
   BGE-M3、text-embedding-3、Qwen3-Embedding
   支持多语言、超长文本、多粒度（词/句/段/文档）
```

---

## 五、RAG 评估

### 5.1 为什么需要评估？

> 如果你不能衡量它，你就不能改进它。—— 彼得·德鲁克

RAG 系统有两个核心环节需要分别评估：
- **检索质量**：找到的内容是否正确、完整？
- **生成质量**：生成的答案是否准确、忠实？

### 5.2 RAGAS：最主流的 RAG 评估框架

[RAGAS](https://github.com/explodinggradients/ragas)（Retrieval-Augmented Generation Assessment）是目前最流行的 RAG 自动评估框架，核心优势：

- ✅ **无参考评估**：大部分指标不需要标准答案
- ✅ **全链路覆盖**：同时测检索和生成
- ✅ **可量化**：0~1 分，分数越高越好

#### 四大核心指标

| 指标 | 评估对象 | 衡量什么 | 大白话 |
|------|---------|---------|--------|
| **Context Precision（上下文精度）** | 检索 | 检索到的内容中有用的占比 | "检索准不准" |
| **Context Recall（上下文召回）** | 检索 | 所需信息被检索到的比例 | "检索全不全" |
| **Faithfulness（忠实度）** | 生成 | 答案是否基于检索到的上下文 | "有没有编造" |
| **Answer Relevancy（答案相关性）** | 生成 | 答案是否直接回答了问题 | "答非所问了吗" |

#### 指标详解图

```
┌─────────────────────────────────────────────────┐
│                 RAG 评估体系                      │
├────────────────────┬────────────────────────────┤
│    检索质量         │        生成质量              │
├────────────────────┼────────────────────────────┤
│ Context Precision  │ Faithfulness               │
│ 上下文精度          │ 忠实度                       │
│ → 检索到的东西准不准？│ → 有没有根据上下文回答？       │
│                    │                             │
│ Context Recall     │ Answer Relevancy            │
│ 上下文召回          │ 答案相关性                    │
│ → 该找到的都找到了？ │ → 回答是否切题？              │
└────────────────────┴────────────────────────────┘
```

### 5.3 RAGAS 指标计算逻辑

#### 1. Faithfulness（忠实度）

```
忠实度 = 被上下文支持的声明数 / 答案中的总声明数

示例：
  检索上下文："Python 由 Guido van Rossum 于 1991 年发布"
  生成答案："Python 由 Guido 于 1991 年发布，是世界上最流行的编程语言"

  声明1："Python 由 Guido 于 1991 年发布" → ✅ 上下文支持
  声明2："是世界上最流行的编程语言"        → ❌ 上下文没说

  忠实度 = 1/2 = 0.5
```

#### 2. Answer Relevancy（答案相关性）

```
计算方式（巧妙！不需要标准答案）：
  1. 给 LLM 看生成的答案，让它反推"这个答案在回答什么问题？"
  2. 生成 3 个"假设问题"
  3. 计算假设问题与原始问题的余弦相似度
  4. 取平均值

示例：
  原始问题："Python 什么时候发布的？"
  生成答案："Python 由 Guido 于 1991 年发布"

  LLM 反推问题：
    Q1: "Python 的发布时间是什么？"        → 与原问题相似度 0.92
    Q2: "谁创建了 Python？"               → 与原问题相似度 0.65
    Q3: "Python 是哪一年问世的？"           → 与原问题相似度 0.95

  答案相关性 = (0.92 + 0.65 + 0.95) / 3 = 0.84
```

#### 3. Context Precision（上下文精度）

```
上下文精度 = 检索到的相关文档数 / 检索到的总文档数

示例：检索 Top-5 文档
  文档1: ✅ 相关    → 累计精度 1/1 = 1.0
  文档2: ✅ 相关    → 累计精度 2/2 = 1.0
  文档3: ❌ 不相关  → 累计精度 2/3 = 0.67
  文档4: ❌ 不相关  → 累计精度 2/4 = 0.50
  文档5: ✅ 相关    → 累计精度 3/5 = 0.60

  上下文精度 = (1.0 + 1.0 + 0.67 + 0.50 + 0.60) / 3 = 0.94
  （注意：只对相关文档位置取平均）
```

#### 4. Context Recall（上下文召回）

```
上下文召回 = 检索到的关键信息数 / 标准答案中应有的总关键信息数

需要标准答案（Ground Truth）来计算
```

### 5.4 Python 实战：用 RAGAS 评估

```python
from ragas import evaluate
from ragas.metrics import (
    faithness,
    answer_relevancy,
    context_precision,
    context_recall
)
from datasets import Dataset

# 准备评估数据
eval_data = {
    "question": [
        "Python 是谁发明的？",
        "RAG 的全称是什么？"
    ],
    "answer": [  # RAG 系统生成的答案
        "Python 由 Guido van Rossum 于 1991 年发明。",
        "RAG 的全称是 Retrieval-Augmented Generation，即检索增强生成。"
    ],
    "contexts": [  # 检索到的上下文（列表的列表）
        ["Python 是一种高级编程语言，由 Guido van Rossum 在 1991 年首次发布。"],
        ["Retrieval-Augmented Generation (RAG) 是一种结合检索和生成的技术框架。"]
    ],
    "ground_truth": [  # 标准答案（用于 context_recall 等指标）
        "Python 由 Guido van Rossum 于 1991 年发明。",
        "RAG 的全称是 Retrieval-Augmented Generation。"
    ]
}

dataset = Dataset.from_dict(eval_data)

# 运行评估
results = evaluate(
    dataset=dataset,
    metrics=[faithness, answer_relevancy, context_precision, context_recall]
)

# 查看结果
print(results)
# {'faithfulness': 0.95, 'answer_relevancy': 0.88,
#  'context_precision': 1.0, 'context_recall': 0.92}
```

### 5.5 经典检索评估指标

除了 RAGAS 的四大指标，还有一些传统检索指标也常用：

| 指标 | 全称 | 说明 | 适用场景 |
|------|------|------|---------|
| **Hit Rate** | 命中率 | Top-K 结果中是否包含正确答案 | 快速评估检索是否"找得到" |
| **MRR** | Mean Reciprocal Rank | 第一个正确结果排第几 | 评估排序质量 |
| **Precision@K** | 前 K 个结果的精度 | Top-K 中有多少是相关的 | 关注前几个结果 |
| **Recall@K** | 前 K 个结果的召回 | 相关文档被找到的比例 | 关注完整性 |
| **NDCG** | Normalized Discounted Cumulative Gain | 排序质量的综合评分 | 需要精细排序评估 |

### 5.6 评估优化策略

```
评估结果不佳？
    │
    ├── 检索质量低（Context Precision/Recall 低）
    │     ├── 调整分块策略（大小、重叠、语义分块）
    │     ├── 更换 Embedding 模型（如 BGE-M3 → text-embedding-3-large）
    │     ├── 加入混合检索（向量 + BM25）
    │     └── 加入重排序（Reranker）
    │
    ├── 生成质量低（Faithfulness 低 → 幻觉严重）
    │     ├── 优化 Prompt（强调"只基于给定上下文回答"）
    │     ├── 使用更强的 LLM
    │     └── 增加检索文档数量
    │
    └── 答案不切题（Answer Relevancy 低）
          ├── 查询改写（Query Rewriting）
          └── 优化 Prompt（明确回答要求）
```

---

## 六、知识全景图

```
RAG 技术全景
├── 数据层
│   ├── 文档加载（PDF/Word/网页/数据库）
│   ├── 文本分块（固定/递归/语义/结构化）
│   └── 数据清洗（去噪、去重、格式化）
│
├── 索引层
│   ├── Embedding 向量化（OpenAI/BGE/Qwen3）
│   ├── 向量数据库（Qdrant/FAISS/Milvus）
│   └── 知识图谱（Graph RAG）
│
├── 检索层
│   ├── 向量检索（语义相似度）
│   ├── 关键词检索（BM25）
│   ├── 混合检索（向量 + 关键词）
│   └── 重排序（Reranker）
│
├── 生成层
│   ├── Prompt 模板设计
│   ├── 上下文压缩
│   └── LLM 生成（GPT-4o/Claude/DeepSeek）
│
└── 评估层
    ├── RAGAS（四大核心指标）
    ├── Hit Rate / MRR / NDCG
    └── 人工评估
```

---

## 七、技术选型速查表

| 环节 | 推荐方案（初学者） | 推荐方案（生产） |
|------|-------------------|-----------------|
| **文档加载** | pypdf（PDF）+ 原生读取 | Unstructured |
| **文本分块** | 递归字符分块（自写 ~30 行） | 语义分块 + 结构化分块 |
| **Embedding** | OpenAI text-embedding-3-small | BGE-M3（中文）/ text-embedding-3-large |
| **向量数据库** | Qdrant（本地文件模式） | Qdrant / Milvus（分布式服务端） |
| **检索方式** | 向量检索 | 混合检索 + Reranker |
| **LLM** | OpenAI GPT-4o-mini | GPT-4o / Claude 3.5 Sonnet / DeepSeek |
| **评估** | RAGAS 自动评估 | RAGAS + 人工评估 |
| **SDK** | OpenAI Python SDK（统一 Embedding + Chat） | OpenAI SDK / Anthropic SDK |

---

## 八、一句话总结每个知识点

| 知识点 | 一句话 |
|--------|--------|
| **RAG 是什么** | 给 LLM 配一个"开卷考试翻书助手" |
| **数据加载** | 把各种格式的文件变成纯文本 |
| **文本分块** | 把长文档切成 500-1000 字的小块，留点重叠 |
| **Embedding** | 把文字变成一组数字，语义相近的文字数字也相近 |
| **向量数据库** | 存放这些数字的仓库，支持快速找"最像的" |
| **检索** | 用户提问也变数字，找最像的几个文档块 |
| **生成** | 把问题和文档块塞进 Prompt，让 LLM 回答 |
| **RAGAS 评估** | 用四个指标（精度/召回/忠实度/相关性）给 RAG 打分 |

---

*参考资料：*
- [Datawhale All-in-RAG](https://github.com/datawhalechina/all-in-rag)
- [RAG 2026 全景：从朴素检索到 Agentic RAG](https://juejin.cn/post/7629915861765275699)
- [RAGAS 官方文档](https://docs.ragas.io/)
- [Qdrant Python 官方文档](https://qdrant.tech/documentation/concepts/client-libraries/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
