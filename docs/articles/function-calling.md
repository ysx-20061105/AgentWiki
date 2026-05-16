---
title: Function Calling 学习笔记
date: 2026-05-07
categories:
  - Agent
tags: ["AI", "LLM", "FunctionCalling", "工具调用", "学习笔记"]
summary: "Function Calling完全指南，讲解LLM如何通过结构化JSON输出调用外部函数，包含OpenAI SDK完整实现案例。"
---

# Function Calling 完全学习指南

## 1. 什么是 Function Calling？

### 一句话解释

> Function Calling = 让 AI **告诉你**"我想调用什么函数、传什么参数"，然后由**你的代码**去执行。

### ⚠️ 最重要的误区

很多人以为 Function Calling 是"AI 直接调用函数"。**这是错的！**

```
❌ 错误理解：AI 直接执行函数
✅ 正确理解：AI 输出结构化 JSON → 你的程序解析 → 你的程序执行函数 → 结果返回给 AI
```

AI 模型本身**没有任何执行能力**，它只是"会说话"。Function Calling 让它学会说一种**结构化语言（JSON）**，告诉你的程序该做什么。

### 打个比方 🍕

想象你去餐厅吃饭：
- **你** = 用户
- **服务员** = AI 模型（能理解你要什么，但不做饭）
- **厨师** = 你的代码/外部 API（真正干活的人）

你告诉服务员："我想要一个披萨"。服务员理解后，写了一张**订单**（JSON）传给厨房。厨师做好后，服务员再把结果告诉你。

**Function Calling 就是那张"订单"。**

---

## 2. 为什么需要 Function Calling？

### LLM 的两大先天缺陷

| 缺陷       | 说明              | 举例                |
| -------- | --------------- | ----------------- |
| **知识冻结** | 训练完就不再更新        | "今天北京天气如何？" → 不知道 |
| **无法行动** | 只能输出文字，不能操作任何系统 | "给我发一封邮件" → 做不到   |

### Function Calling 解决了什么？

```
用户："现在北京的天气怎么样？"
                    ↓
AI 想：我查不到实时天气，需要调工具
                    ↓
AI 输出：{ "name": "get_weather", "arguments": { "city": "北京" } }
                    ↓
你的代码：调用天气 API → 返回 "晴天，25°C"
                    ↓
AI 整合回复："北京现在是晴天，气温 25°C。"
```

**核心价值**：让 AI 从"只会聊天"变成"能做事"。

---

## 3. 工作原理

### 整体架构

```
┌─────────────┐     ① 用户问题      ┌─────────────┐
│    用户     │ ──────────────────→ │   AI 模型   │
└─────────────┘                    └──────┬──────┘
                                          │
                            ② AI 分析：需要调用工具吗？
                                          │
                                          ▼
                                 ③ 输出结构化 JSON
                                 { name, arguments }
                                          │
                                          ▼
┌─────────────┐     ④ 执行函数     ┌─────────────┐
│  外部工具   │ ←──────────────── │  你的代码   │
│ (API/数据库)│ ─────────────────→ │  (中间层)   │
└─────────────┘     ⑤ 返回结果     └──────┬──────┘
                                          │
                                          ▼
                            ⑥ 结果返回给 AI，AI 生成最终回复
                                          │
                                          ▼
┌─────────────┐     ⑦ 最终回答     ┌─────────────┐
│    用户     │ ←───────────────── │   AI 模型   │
└─────────────┘                    └─────────────┘
```

### 关键点

- AI 模型**不执行**任何函数，只负责"理解意图 + 输出结构化请求"
- 你的代码负责**真正执行**函数并将结果返回
- 这是一个**多轮对话**过程：用户→AI→你的代码→AI→用户

---

## 4. JSON Schema 函数定义

### 什么是 JSON Schema？

JSON Schema 是一种**描述 JSON 数据格式的标准**。在 Function Calling 中，我们用它来告诉 AI：

> "我有这些函数可以用，每个函数叫什么名字、做什么、需要什么参数。"

### 基本结构

```json
{
  "name": "函数名",
  "description": "这个函数是做什么的（AI 根据这个判断是否调用）",
  "parameters": {
    "type": "object",
    "properties": {
      "参数名1": {
        "type": "string",
        "description": "这个参数是什么意思"
      },
      "参数名2": {
        "type": "number",
        "description": "这个参数是什么意思"
      }
    },
    "required": ["参数名1"]
  }
}
```

### 实际例子：天气查询函数

```json
{
  "name": "get_current_weather",
  "description": "获取指定城市的当前天气信息",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "城市名称，如：北京、上海"
      },
      "unit": {
        "type": "string",
        "enum": ["celsius", "fahrenheit"],
        "description": "温度单位：celsius（摄氏度）或 fahrenheit（华氏度）"
      }
    },
    "required": ["location"]
  }
}
```

### 常用数据类型

| 类型 | 说明 | 示例值 |
|------|------|--------|
| `string` | 文本 | `"北京"` |
| `number` | 数字 | `25`、`3.14` |
| `boolean` | 布尔值 | `true`、`false` |
| `array` | 数组 | `["北京","上海"]` |
| `object` | 嵌套对象 | `{"key": "value"}` |
| `enum` | 枚举（限定值） | `["男","女"]` |

---

## 5. 完整调用流程（5 步走）

### 第 1 步：定义工具

告诉 AI 你有哪些函数可以用：

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称"
                    }
                },
                "required": ["city"]
            }
        }
    }
]
```

### 第 2 步：发送用户消息

```python
messages = [
    {"role": "user", "content": "北京今天天气怎么样？"}
]
```

### 第 3 步：AI 返回工具调用请求

AI 不会直接回答，而是返回类似这样的结果：

```json
{
  "tool_calls": [
    {
      "function": {
        "name": "get_weather",
        "arguments": "{\"city\": \"北京\"}"
      }
    }
  ]
}
```

### 第 4 步：你的代码执行函数

```python
import json

# 解析 AI 返回的参数
arguments = json.loads(ai_response.tool_calls[0].function.arguments)
city = arguments["city"]

# 真正去调用天气 API
weather_result = get_weather(city)  # 这是你自己的函数
# 返回: "晴天，25°C，微风"
```

### 第 5 步：把结果返回给 AI

```python
# 把工具执行结果追加到消息列表
messages.append(ai_response)  # AI 的回复（包含 tool_calls）
messages.append({
    "role": "tool",
    "tool_call_id": ai_response.tool_calls[0].id,
    "content": "晴天，25°C，微风"
})

# 再次调用 AI，让它生成最终回复
final_response = client.chat.completions.create(
    model="gpt-4",
    messages=messages
)

print(final_response.choices[0].message.content)
# 输出："北京现在是晴天，气温 25°C，有微风，很适合出门！"
```

---

## 6. OpenAI 实战示例

### 完整 Python 代码

```python
from openai import OpenAI
import json

client = OpenAI(api_key="your-api-key")

# 第 1 步：定义一个实际函数
def get_weather(city: str) -> str:
    """模拟天气查询（实际中应该调用真实天气 API）"""
    weather_data = {
        "北京": "晴天，25°C，微风",
        "上海": "多云，22°C，东南风",
        "广州": "阵雨，28°C，南风",
    }
    return weather_data.get(city, f"{city}的天气信息暂不可用")

# 第 2 步：定义工具描述
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "城市名称，如：北京、上海"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

# 第 3 步：发起对话
messages = [{"role": "user", "content": "北京和上海今天天气怎么样？"}]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=tools,
    tool_choice="auto"  # 让 AI 自己决定是否调用工具
)

# 第 4 步：检查 AI 是否需要调用工具
if response.choices[0].message.tool_calls:
    # AI 想调用工具
    assistant_message = response.choices[0].message
    messages.append(assistant_message)

    # 遍历所有工具调用（可能一次调用多个）
    for tool_call in assistant_message.tool_calls:
        function_name = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)

        # 执行函数
        if function_name == "get_weather":
            result = get_weather(arguments["city"])

        # 把结果返回给 AI
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": result
        })

    # 第 5 步：获取最终回复
    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=tools
    )
    print(final_response.choices[0].message.content)
else:
    # AI 直接回复了，不需要工具
    print(response.choices[0].message.content)
```

### 输出示例

```
用户：北京和上海今天天气怎么样？
AI 执行过程：
  → 调用 get_weather(city="北京")  → 返回 "晴天，25°C，微风"
  → 调用 get_weather(city="上海")  → 返回 "多云，22°C，东南风"
最终回复：北京今天是晴天，气温25°C，有微风；上海今天多云，气温22°C，有东南风。
```

---

## 7. Claude (Anthropic) 实战示例

### Claude 的叫法不同

在 Claude 中，Function Calling 被称为 **Tool Use（工具使用）**，但原理完全一样。

### Python 代码示例

```python
import anthropic
import json

client = anthropic.Anthropic(api_key="your-api-key")

# 定义工具
tools = [
    {
        "name": "get_weather",
        "description": "获取指定城市的当前天气信息",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "城市名称"
                }
            },
            "required": ["city"]
        }
    }
]

# 发送请求
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    messages=[
        {"role": "user", "content": "北京天气怎么样？"}
    ]
)

# 检查是否需要调用工具
if response.stop_reason == "tool_use":
    # 提取工具调用信息
    tool_use_block = next(
        block for block in response.content
        if block.type == "tool_use"
    )
    tool_name = tool_use_block.name
    tool_input = tool_use_block.input

    # 执行函数
    if tool_name == "get_weather":
        result = get_weather(tool_input["city"])

    # 把结果返回给 Claude
    final_response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        tools=tools,
        messages=[
            {"role": "user", "content": "北京天气怎么样？"},
            {"role": "assistant", "content": response.content},
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use_block.id,
                        "content": result
                    }
                ]
            }
        ]
    )
    print(final_response.content[0].text)
```

### OpenAI 与 Claude 的关键区别

| 特性 | OpenAI | Claude (Anthropic) |
|------|--------|--------------------|
| 术语 | Function Calling | Tool Use |
| 工具定义字段 | `parameters` | `input_schema` |
| 检测工具调用 | `tool_calls` 列表 | `stop_reason == "tool_use"` |
| 结果返回 | `role: "tool"` | `role: "user"` + `tool_result` |
| 返回格式 | 需要 JSON 解析 `arguments` | 直接用 `tool_use_block.input` |

---

## 8. 常见应用场景

### 场景 1：实时数据查询

```python
# 查询天气、股票、汇率等实时信息
{
    "name": "get_stock_price",
    "description": "查询股票实时价格",
    "parameters": {
        "type": "object",
        "properties": {
            "symbol": {"type": "string", "description": "股票代码如 AAPL"}
        }
    }
}
```

### 场景 2：结构化数据提取

```python
# 从非结构化文本中提取结构化信息
{
    "name": "extract_invoice_info",
    "description": "从发票文本中提取结构化信息",
    "parameters": {
        "type": "object",
        "properties": {
            "company_name": {"type": "string"},
            "date": {"type": "string"},
            "amount": {"type": "number"},
            "items": {
                "type": "array",
                "items": {"type": "string"}
            }
        },
        "required": ["company_name", "amount"]
    }
}
```

### 场景 3：执行操作

```python
# 发邮件、创建日程、操作数据库等
{
    "name": "send_email",
    "description": "发送电子邮件",
    "parameters": {
        "type": "object",
        "properties": {
            "to": {"type": "string", "description": "收件人邮箱"},
            "subject": {"type": "string", "description": "邮件主题"},
            "body": {"type": "string", "description": "邮件正文"}
        },
        "required": ["to", "subject", "body"]
    }
}
```

### 场景 4：多工具协作

```
用户："帮我查一下飞往北京最早的航班，然后发邮件告诉老板"
    ↓
AI 调用 → search_flights(destination="北京", sort="earliest")
    ↓
AI 调用 → send_email(to="老板", subject="航班信息", body=航班结果)
```

---

## 9. 最佳实践与注意事项

### ✅ 最佳实践

1. **函数描述要清晰详细**
   - AI 完全依赖你的 `description` 来理解函数用途
   - 描述越清楚，AI 选择和参数提取越准确

2. **参数命名要语义化**
   ```
   ❌ "arg1", "arg2"
   ✅ "city_name", "search_query"
   ```

3. **设置 `required` 字段**
   - 明确哪些参数是必须的，哪些是可选的
   - 减少 AI 生成错误参数的概率

4. **处理 AI 幻觉**
   - AI 可能生成不存在的参数值
   - 在执行前做参数校验

5. **错误处理**
   - 工具执行可能失败，要返回有意义的错误信息
   - 让 AI 有机会根据错误信息调整

### ⚠️ 安全注意事项

```
🔒 安全清单：
├── 1. 不要让 AI 直接执行删除、支付等高风险操作
├── 2. 所有函数调用必须经过人工确认或安全检查
├── 3. 对 AI 生成的参数做输入校验（防注入）
├── 4. 限制函数调用的权限范围
└── 5. 记录所有函数调用日志，便于审计
```

### 🔧 调试技巧

```python
# 打印 AI 的原始响应，方便调试
print("=== AI 原始响应 ===")
print(response)
print("=== 工具调用 ===")
for tc in response.choices[0].message.tool_calls:
    print(f"函数名: {tc.function.name}")
    print(f"参数: {tc.function.arguments}")
```

---

## 10. 支持 Function Calling 的主流模型

| 厂商 | 模型 | 术语 | 状态 |
|------|------|------|------|
| OpenAI | GPT-4o, GPT-4, GPT-3.5-turbo | Function Calling | ✅ 原生支持 |
| Anthropic | Claude 3.5/4 系列 | Tool Use | ✅ 原生支持 |
| Google | Gemini 1.5/2.0 | Function Calling | ✅ 原生支持 |
| DeepSeek | DeepSeek-V3 | Function Calling | ✅ 原生支持 |
| 阿里 | Qwen 2.5 | Function Calling | ✅ 原生支持 |

---

## 11. 与 Agent 的关系

```
Function Calling = Agent 的核心基础设施
```

- **Function Calling** 是一种**能力**（让 AI 输出结构化的工具调用请求）
- **Agent** 是一种**架构**（用 AI 做决策，自动调用工具完成复杂任务）

一个 Agent 通常会多次使用 Function Calling 来完成一个多步骤任务。

```
Agent 工作示例：
用户：帮我分析这份报告的要点，并生成 PPT
  ↓
Agent 决策 1：调用 read_file() 读取报告
Agent 决策 2：调用 analyze_text() 提取要点
Agent 决策 3：调用 create_ppt() 生成演示文稿
Agent 决策 4：调用 send_email() 发送给团队
  ↓
完成任务！
```


## 📖 参考资料

- [OpenAI Function Calling 官方文档](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use 官方文档](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
- [LLM Function Calling 原理与实例讲解 (CSDN)](https://download.csdn.net/blog/column/12252923/151769801)
- [Function Calling 是什么 (CSDN)](https://blog.csdn.net/weixin_44705554/article/details/147193935)
- [Function Calling 完整指南 2026 (博客园)](https://www.cnblogs.com/qiniushanghai/p/19937290)
- [掘金 - Function Calling 学习](https://juejin.cn/post/7372466344145109033)
