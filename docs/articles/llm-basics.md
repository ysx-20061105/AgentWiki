---
title: LLM 基础
date: 2026-05-05
categories:
  - Agent
tags: ["AI", "LLM", "大语言模型", "基础概念"]
summary: "介绍大语言模型（LLM）的基础概念、Transformer架构、核心能力、API调用方式及Token计费模型。"
---

# LLM 基础

> 本笔记介绍大语言模型（Large Language Model）的基础概念、工作原理和核心能力。

---

## 什么是 LLM

大语言模型（LLM）是通过海量文本数据训练的自然语言处理模型，具备理解和生成文本的能力。

### 核心特点

| 特点 | 说明 |
|------|------|
| **规模庞大** | 数十亿到上千亿参数 |
| **涌现能力** | 小模型不具备的能力突然出现 |
| **通用性** | 可处理多种任务 |
| **上下文学习** | 从上下文示例中学习 |

---

## LLM 工作原理

### 基本流程

```
输入文本 → Tokenization → 模型推理 → De-tokenization → 输出文本
```

1. **Tokenization**: 将文本转换为数字 token
2. **模型推理**: Transformer 处理，预测下一个 token
3. **De-tokenization**: 将 token 转换回文本

### Transformer 架构

```
┌─────────────────────────────────────────────────┐
│                   Transformer                   │
├─────────────────────────────────────────────────┤
│  Input: "今天天气很好"                          │
│         │                                       │
│         ▼                                       │
│  ┌─────────────────┐                           │
│  │  Embedding Layer │ ← 将token转为向量          │
│  └────────┬────────┘                           │
│           ▼                                      │
│  ┌─────────────────┐                           │
│  │  Self-Attention │ ← 捕捉词间关系             │
│  └────────┬────────┘                           │
│           ▼                                      │
│  ┌─────────────────┐                           │
│  │  Feed Forward    │ ← 非线性变换              │
│  └────────┬────────┘                           │
│           │                                      │
│           ▼ (重复N层)                           │
│  ┌─────────────────┐                           │
│  │  Output Layer    │ ← 输出下一个token概率      │
│  └─────────────────┘                           │
│           │                                      │
│           ▼                                      │
│  Output: "适合出去散步"                          │
└─────────────────────────────────────────────────┘
```

---

## 核心能力

### 1. 文本补全 / 对话

```python
import openai

client = openai.OpenAI()

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "你是一个有帮助的助手"},
        {"role": "user", "content": "解释什么是机器学习"}
    ]
)

print(response.choices[0].message.content)
```

### 2. 上下文学习 (In-Context Learning)

```python
# 通过示例让模型学习模式
messages = [
    {"role": "user", "content": "北京 -> 中国\n东京 -> 日本\n巴黎 -> "},
]

response = client.chat.completions.create(
    model="gpt-4",
    messages=messages
)
# 输出: 法国
```

### 3. Chain-of-Thought (思维链)

```python
# 让模型展示推理过程
prompt = """
问题: 小明有5个苹果，小红给了他3个，他又买了2个，现在有多少苹果？

请逐步推理，展示计算过程。
"""

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": prompt}]
)
```

---

## API 基础

### 主要 API 类型

| API | 用途 |
|-----|------|
| `/chat/completions` | 对话补全（主流） |
| `/completions` | 文本补全（旧版） |
| `/embeddings` | 文本向量化 |

### 核心参数

```python
response = client.chat.completions.create(
    model="gpt-4",                    # 模型选择
    messages=[
        {"role": "user", "content": "..."}
    ],
    temperature=0.7,                  # 创造性（0-2）
    max_tokens=1000,                 # 最大输出token数
    top_p=1.0,                        # 采样策略
    frequency_penalty=0,              # 重复惩罚
    presence_penalty=0,              # 话题惩罚
    stop=["###"]                      # 停止词
)
```

### 参数说明

| 参数 | 作用 | 建议值 |
|------|------|--------|
| `temperature` | 控制随机性 | 精确任务=0.1, 创意任务=0.8 |
| `max_tokens` | 限制输出长度 | 根据任务设置 |
| `top_p` | 核采样 | 与temperature二选一 |
| `stop` | 遇到指定词停止 | 可用于格式化输出 |

---

## 模型选择

| 模型 | 特点 | 适用场景 |
|------|------|---------|
| **GPT-4** | 最强推理能力 | 复杂任务、分析 |
| **GPT-3.5-turbo** | 性价比高 | 日常对话、快速任务 |
| **Claude-3** | 长文本、创意 | 长文分析、写作 |

---

## Token 与费用

### Token 计算

```python
import tiktoken

encoder = tiktoken.encoding_for_model("gpt-4")

text = "你好，世界！"
tokens = encoder.encode(text)
print(f"文本: {text}")
print(f"Token数: {len(tokens)}")
print(f"Tokens: {tokens}")
# 输出: [22865, 50118, 35635, 234]
```

### 费用估算

```python
def estimate_cost(text: str, model: str = "gpt-4") -> dict:
    """估算token数和费用"""
    encoder = tiktoken.encoding_for_model(model)

    # 输入token
    input_tokens = len(encoder.encode(text))

    # 估算输出token（按输入的30%）
    output_tokens = int(input_tokens * 0.3)

    # 价格（每1000 token）
    prices = {
        "gpt-4": {"input": 0.03, "output": 0.06},
        "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002}
    }

    price = prices.get(model, prices["gpt-4"])

    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost": input_tokens / 1000 * price["input"],
        "output_cost": output_tokens / 1000 * price["output"],
        "total_cost": input_tokens / 1000 * price["input"] +
                      output_tokens / 1000 * price["output"]
    }
```

---

## 常见问题

### 1. 最大上下文长度

```python
# 不同模型的最大token数
context_limits = {
    "gpt-4": 8192,
    "gpt-4-32k": 32768,
    "gpt-3.5-turbo": 16385
}

# 检测是否超过限制
def check_context(text: str, model: str) -> bool:
    encoder = tiktoken.encoding_for_model(model)
    tokens = len(encoder.encode(text))
    limit = context_limits.get(model, 8192)
    return tokens <= limit
```

### 2. 处理超长文本

```python
def split_long_text(text: str, model: str, max_tokens: int) -> list:
    """分割超长文本"""
    encoder = tiktoken.encoding_for_model(model)
    tokens = encoder.encode(text)

    # 留出空间给输出
    max_input = max_tokens - 500

    chunks = []
    for i in range(0, len(tokens), max_input):
        chunk_tokens = tokens[i:i + max_input]
        chunk_text = encoder.decode(chunk_tokens)
        chunks.append(chunk_text)

    return chunks
```

---

## 下一步

> LLM 是 Agent 的"大脑"，理解其基本原理后，可以继续学习 2.Prompt工程 来更好地操控 LLM 的行为。
