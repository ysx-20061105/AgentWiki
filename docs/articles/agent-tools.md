---
title: AI Tool Use（工具调用）完全指南
date: 2026-05-07
categories:
  - Agent
tags: ["AI", "LLM", "ToolUse", "FunctionCalling", "学习笔记"]
summary: "Agent工具系统详解，介绍Tool的设计原则、实现方式、错误处理及与Function Calling的协同工作机制。"
---

# AI Tool Use（工具调用）完全指南

## 一、学习路线图

```
第1步：理解概念 ──→ 什么是 Tool？为什么需要它？
    │
第2步：核心原理 ──→ 大模型怎么"调用"工具？请求/响应流程
    │
第3步：定义工具 ──→ JSON Schema 怎么写？
    │
第4步：实战对比 ──→ OpenAI vs Anthropic 的异同
    │
第5步：动手实操 ──→ 写一个天气查询机器人
```

---

## 二、什么是 Tool Use（工具调用）？

### 2.1 一句话理解

> **让大模型学会"打电话求助"——当它自己做不到时，告诉你该调用哪个函数、传什么参数。**

### 2.2 一个比喻 🎯

想象你是一个**非常聪明但被关在房间里的人**：

- 你能思考、推理、写文章 ✅
- 但你看不到外面的天气、查不了数据库、发不了邮件 ❌

**Tool Use 就是给你一部电话** ☎️：
1. 你（大模型）分析用户的问题
2. 你说："帮我打个电话给天气服务，问北京今天天气"
3. 你的助手（程序）真的去打电话，拿到结果
4. 把结果告诉你，你再组织语言回复用户

### 2.3 大模型的局限性 → 为什么需要 Tool

| 大模型能做的 ✅ | 大模型做不到的 ❌ |
|---|---|
| 理解自然语言 | 获取实时数据（天气、股价） |
| 推理和分析 | 执行操作（发邮件、写数据库） |
| 生成文本/代码 | 进行精确计算 |
| 决定该用哪个工具 | 访问私有系统（你的日历、订单） |

> 核心要点
> 大模型是"大脑"，负责**理解**和**决策**；工具是"手和脚"，负责**执行**和**获取数据**。

---

## 三、核心原理：它是怎么工作的？

### 3.1 完整流程（4 步循环）

```
用户: "北京今天天气怎么样？"
        │
        ▼
┌─────────────────────────────┐
│  第1步：发送请求给大模型      │
│  消息 + 工具定义列表          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  第2步：大模型决定调用工具    │
│  返回: "请调用 get_weather   │
│         参数: city=北京"     │
│  ⚠️ 注意：模型只是"说"要调用 │
│  它并不真的去调用！          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  第3步：你的代码执行工具      │
│  调用天气API → 拿到结果       │
│  "北京，晴，25°C"           │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  第4步：把结果返回给大模型    │
│  大模型整合信息，生成最终回复  │
│  "北京今天天气晴朗，气温25°C" │
└─────────────────────────────┘
```

> 关键理解
> **大模型本身不会执行任何工具！** 它只是告诉你"我想调用这个函数，参数是这些"。真正的执行由你的代码完成。

### 3.2 对比：有 Tool vs 没 Tool

**没有 Tool：**
```
用户：北京天气怎么样？
模型：我是AI，无法获取实时天气数据...（瞎编或拒绝）
```

**有 Tool：**
```
用户：北京天气怎么样？
模型：[请求调用 get_weather(city="北京")]
你的代码：[执行，返回 "晴，25°C"]
模型：北京今天天气晴朗，气温25°C，适合出门！
```

---

## 四、如何定义一个工具？

### 4.1 工具定义的三要素

每个工具都需要告诉大模型三件事：

| 要素 | 说明 | 例子 |
|---|---|---|
| **name** | 工具的名字 | `get_weather` |
| **description** | 这个工具是干什么的 | "获取指定城市的天气信息" |
| **parameters** | 需要哪些参数（JSON Schema 格式） | `city: string, 必填` |

### 4.2 JSON Schema 参数定义速查

```json
{
  "type": "object",
  "properties": {
    "city": {
      "type": "string",
      "description": "城市名称，如'北京'"
    },
    "days": {
      "type": "integer",
      "description": "查询未来几天的天气",
      "enum": [1, 3, 7]
    }
  },
  "required": ["city"]
}
```

常见类型：
- `"type": "string"` — 文本
- `"type": "integer"` / `"number"` — 数字
- `"type": "boolean"` — 布尔值
- `"type": "array"` — 列表
- `"type": "object"` — 对象/嵌套
- `"enum": [...]` — 限定可选值

---

## 五、OpenAI vs Anthropic 对比

### 5.1 工具定义格式对比

**OpenAI 格式：**
```json
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
```

**Anthropic 格式：**
```json
{
  "name": "get_weather",
  "description": "获取指定城市的当前天气",
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
```

> 区别
> OpenAI 多了一层 `"type": "function"` 和 `"function"` 包裹；Anthropic 直接用 `name`、`description`、`input_schema`，更扁平。

### 5.2 请求方式对比

**OpenAI（Python）：**
```python
from openai import OpenAI
client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "北京天气怎么样？"}],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市名称"}
                },
                "required": ["city"]
            }
        }
    }]
)

# 检查模型是否想调用工具
if response.choices[0].message.tool_calls:
    tool_call = response.choices[0].message.tool_calls[0]
    function_name = tool_call.function.name
    arguments = json.loads(tool_call.function.arguments)
    print(f"模型想调用: {function_name}，参数: {arguments}")
```

**Anthropic（Python）：**
```python
import anthropic
client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "北京天气怎么样？"}],
    tools=[{
        "name": "get_weather",
        "description": "获取指定城市的当前天气",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名称"}
            },
            "required": ["city"]
        }
    }]
)

# 检查模型是否想调用工具
if response.stop_reason == "tool_use":
    tool_block = response.content[-1]
    print(f"模型想调用: {tool_block.name}，参数: {tool_block.input}")
```

### 5.3 返回工具结果对比

**OpenAI：**
```python
# 把工具执行结果返回给模型
messages.append(response.choices[0].message)  # 先加入模型的回复
messages.append({
    "role": "tool",
    "tool_call_id": tool_call.id,
    "content": "北京，晴，25°C"
})

final_response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    tools=tools
)
```

**Anthropic：**
```python
# 把工具执行结果返回给模型
messages.append({"role": "assistant", "content": response.content})
messages.append({
    "role": "user",
    "content": [{
        "type": "tool_result",
        "tool_use_id": tool_block.id,
        "content": "北京，晴，25°C"
    }]
})

final_response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=messages,
    tools=tools
)
```

### 5.4 关键差异总结

| 特性 | OpenAI | Anthropic |
|---|---|---|
| 参数字段名 | `parameters` | `input_schema` |
| 外层包裹 | `"type": "function"` + `"function"` | 直接平铺 |
| 停止原因 | `finish_reason: "tool_calls"` | `stop_reason: "tool_use"` |
| 工具结果角色 | `"role": "tool"` | `"role": "user"` + `tool_result` |
| 强制调用 | `tool_choice` 参数 | `tool_choice` 参数 |
| 并行调用 | 支持（一次返回多个 tool_calls） | 支持（可返回多个 tool_use blocks） |

---

## 六、重要参数详解

### 6.1 tool_choice — 控制是否调用工具

| 值 | 含义 | 使用场景 |
|---|---|---|
| `auto`（默认） | 模型自己决定 | 一般场景 |
| `none` | 强制不调用任何工具 | 调试、测试 |
| `required` | 强制调用至少一个工具 | 确保必须用工具 |
| 指定某个工具 | 强制调用指定工具 | 特定场景 |

OpenAI 示例：
```python
tool_choice={"type": "function", "function": {"name": "get_weather"}}
```

Anthropic 示例：
```python
tool_choice={"type": "tool", "name": "get_weather"}
```

---

## 七、实操案例：天气查询机器人 🌤️

### 7.1 目标

用 Python 写一个完整的天气查询机器人，包含：
1. 定义一个天气查询工具
2. 用户用自然语言提问
3. 大模型决定调用工具
4. 代码执行工具（模拟天气 API）
5. 大模型生成最终回复

### 7.2 完整代码（OpenAI 版本 — Tool 注册机制）

> 思路：写一个 `ToolRegistry` 类，用 `@registry.register` 装饰器注册函数。
> 注册时自动从函数签名提取参数 schema，生成 OpenAI 工具定义 + 分发表。
> **新增工具只需加一个函数 + 一行装饰器，零改动主逻辑。**

```python
"""
天气 & 时间查询机器人 - OpenAI 版本
演示：Tool 注册机制 —— 新增工具零改动主逻辑
"""
import json
import inspect
from datetime import datetime
from openai import OpenAI

client = OpenAI(api_key="your-api-key")

# ========== 第1步：实现工具注册器 ==========

class ToolRegistry:
    def __init__(self):
        self._tools = []       # OpenAI 工具定义列表
        self._handlers = {}    # name → 函数

    def register(self, func):
        """装饰器：自动从函数签名生成 OpenAI 工具定义"""
        name = func.__name__
        description = func.__doc__ or ""
        sig = inspect.signature(func)

        # 自动从类型注解 + 参数注释生成 JSON Schema
        properties = {}
        required = []
        for param_name, param in sig.parameters.items():
            prop = {"description": param_name}
            # 类型映射
            type_map = {str: "string", int: "integer", float: "number", bool: "boolean"}
            if param.annotation != inspect.Parameter.empty:
                prop["type"] = type_map.get(param.annotation, "string")
            else:
                prop["type"] = "string"
            properties[param_name] = prop
            if param.default == inspect.Parameter.empty:
                required.append(param_name)

        # 生成 OpenAI 格式的工具定义
        tool_def = {
            "type": "function",
            "function": {
                "name": name,
                "description": description.strip(),
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required
                }
            }
        }
        self._tools.append(tool_def)
        self._handlers[name] = func
        return func

    def get_tools(self):
        """返回给 OpenAI API 的工具列表"""
        return self._tools

    def dispatch(self, name: str, arguments: dict) -> str:
        """根据工具名 + 参数，执行对应函数"""
        if name not in self._handlers:
            return f"未知工具: {name}"
        try:
            return self._handlers[name](**arguments)  # 关键：用 ** 解包参数
        except Exception as e:
            return f"工具执行出错: {e}"


# ========== 第2步：注册工具（只需加函数 + 装饰器） ==========

registry = ToolRegistry()

@registry.register
def get_weather(city: str) -> str:
    """获取指定城市的当前天气信息，包括温度、天气状况"""
    weather_data = {
        "北京": "晴，25°C，空气质量良好",
        "上海": "多云，22°C，有微风",
        "深圳": "阵雨，28°C，湿度较高",
        "广州": "阴天，26°C，可能有雨",
    }
    return weather_data.get(city, f"{city}：暂无天气数据")

@registry.register
def get_time(timezone: str) -> str:
    """获取指定时区的当前时间"""
    return f"{timezone} 当前时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

# 想加新工具？再写一个函数 + @registry.register 就完事了：
#
# @registry.register
# def search_web(query: str) -> str:
#     """搜索互联网获取信息"""
#     return f"搜索结果：关于'{query}'的最新信息..."

# ========== 第3步：主对话（不用改！） ==========

def chat(user_message: str):
    messages = [
        {"role": "system", "content": "你是一个助手，可以查询天气和时间。"},
        {"role": "user", "content": user_message}
    ]

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=registry.get_tools()  # ← 从注册器拿工具列表
    )

    assistant_message = response.choices[0].message

    if assistant_message.tool_calls:
        messages.append(assistant_message)

        for tool_call in assistant_message.tool_calls:
            name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)
            print(f"🔧 调用工具: {name}({arguments})")

            result = registry.dispatch(name, arguments)  # ← 注册器自动分发

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result
            })

        final_response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=registry.get_tools()
        )
        print(f"🤖 助手: {final_response.choices[0].message.content}")
    else:
        print(f"🤖 助手: {assistant_message.content}")

# ========== 第4步：测试 ==========
if __name__ == "__main__":
    chat("北京今天天气怎么样？")
    print("---")
    chat("纽约现在几点了？")
```

> 注册机制的精髓
> 你看第3步的主对话代码，完全不需要知道具体有哪些工具。
> 新增工具 = 写一个函数 + 一行 `@registry.register`，**主逻辑零改动**。
> 这就是"注册机制"的威力：**工具和逻辑解耦**。

### 7.3 运行结果示例

```
用户: 北京今天天气怎么样？
🔧 调用工具: get_weather({'city': '北京'})
🤖 助手: 北京今天天气晴朗，气温25°C，空气质量良好。是个适合出门的好天气！☀️

---
用户: 上海和深圳哪个更热？
🔧 调用工具: get_weather({'city': '上海'})
🔧 调用工具: get_weather({'city': '深圳'})  ← 一次并行调用了两个工具！
🤖 助手: 根据天气数据，深圳（28°C）比上海（22°C）更热。

---
用户: 纽约现在几点了？
🔧 调用工具: get_time({'timezone': 'America/New_York'})  ← 模型自动选了 get_time
🤖 助手: 纽约现在是2026-05-07 04:30:00（美东时间）。

---
（Anthropic 装饰器版还多一个 calculate 工具）
用户: 帮我算一下 (25 + 37) * 3 等于多少？
🔧 调用工具: calculate({'expression': '(25 + 37) * 3'})  ← 模型自动选了 calculate
🤖 助手: (25 + 37) * 3 = 186
```

### 7.4 Anthropic 版本 — @tool 装饰器

> 思路：写一个 `@tool` 装饰器，函数被装饰后自动"变身"为工具。
> 从函数名、docstring、类型注解自动提取工具定义。
> **写函数就像写普通 Python 函数，装饰器帮你搞定一切对接。**

```python
"""
天气 & 时间查询机器人 - Anthropic 版本
演示：@tool 装饰器 —— 普通函数一键变工具
"""
import inspect
from datetime import datetime
import anthropic

client = anthropic.Anthropic(api_key="your-api-key")

# ========== 第1步：实现 @tool 装饰器 ==========

class ToolManager:
    def __init__(self):
        self._tools = {}       # name → tool 定义
        self._handlers = {}    # name → 函数

    def tool(self, func):
        """装饰器：把普通函数变成 Anthropic 工具"""
        name = func.__name__
        description = func.__doc__ or ""
        sig = inspect.signature(func)

        # 从类型注解自动生成 input_schema
        properties = {}
        required = []
        type_map = {str: "string", int: "integer", float: "number", bool: "boolean"}

        for param_name, param in sig.parameters.items():
            prop = {"description": param_name}
            prop["type"] = type_map.get(param.annotation, "string")
            properties[param_name] = prop
            if param.default == inspect.Parameter.empty:
                required.append(param_name)

        # 生成 Anthropic 格式的工具定义
        tool_def = {
            "name": name,
            "description": description.strip(),
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        }

        self._tools[name] = tool_def
        self._handlers[name] = func
        return func

    def get_tools(self) -> list:
        """返回给 Anthropic API 的工具列表"""
        return list(self._tools.values())

    def dispatch(self, name: str, input_data: dict) -> str:
        """根据工具名 + 参数，执行对应函数"""
        if name not in self._handlers:
            return f"未知工具: {name}"
        try:
            return self._handlers[name](**input_data)
        except Exception as e:
            return f"工具执行出错: {e}"


# ========== 第2步：注册工具（只需 @manager.tool） ==========

manager = ToolManager()
tool = manager.tool  # 短别名，用起来更简洁

@tool
def get_weather(city: str) -> str:
    """获取指定城市的当前天气信息，包括温度、天气状况"""
    weather_data = {
        "北京": "晴，25°C，空气质量良好",
        "上海": "多云，22°C，有微风",
        "深圳": "阵雨，28°C，湿度较高",
    }
    return weather_data.get(city, f"{city}：暂无天气数据")

@tool
def get_time(timezone: str) -> str:
    """获取指定时区的当前时间"""
    return f"{timezone} 当前时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

@tool
def calculate(expression: str) -> str:
    """执行数学计算，传入数学表达式如 '2+3*4'"""
    try:
        result = eval(expression)  # 生产环境请用安全的数学解析器
        return f"{expression} = {result}"
    except Exception as e:
        return f"计算错误: {e}"

# ========== 第3步：主对话（不用改！） ==========

def chat(user_message: str):
    messages = [{"role": "user", "content": user_message}]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=messages,
        tools=manager.get_tools()  # ← 从管理器拿工具列表
    )

    if response.stop_reason == "tool_use":
        tool_results = []

        for block in response.content:
            if block.type == "tool_use":
                print(f"🔧 调用工具: {block.name}({block.input})")

                result = manager.dispatch(block.name, block.input)  # ← 自动分发

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result
                })

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})

        final_response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=messages,
            tools=manager.get_tools()
        )
        print(f"🤖 助手: {final_response.content[0].text}")
    else:
        print(f"🤖 助手: {response.content[0].text}")

# ========== 第4步：测试 ==========
if __name__ == "__main__":
    chat("北京今天天气怎么样？")
    print("---")
    chat("帮我算一下 (25 + 37) * 3 等于多少？")
```

> 装饰器的精髓
> 看第2步的代码，`get_weather` 就是一个**普通 Python 函数**：
> - 函数名 → 自动成为工具名
> - docstring → 自动成为工具描述
> - 类型注解 `city: str` → 自动生成参数 schema
>
> `@tool` 装饰器帮你完成了所有"函数 ↔ API 工具定义"的转换工作。
> 想加新工具？**写个函数，加个 `@tool`，完事。**

### 7.5 两种模式对比：注册机制 vs 装饰器

```
┌─────────────────────────────────────────────────────────────┐
│                 注册机制 (OpenAI 版)                          │
│                                                             │
│  @registry.register          手动注册到注册器                 │
│  def get_weather(city):       ↓                              │
│      ...                     注册器收集函数 → 生成工具定义     │
│                              注册器收集函数 → 生成分发表       │
│  调用：registry.dispatch(name, args)                         │
├─────────────────────────────────────────────────────────────┤
│                 装饰器 (Anthropic 版)                         │
│                                                             │
│  @tool                       装饰器"改造"函数本身              │
│  def get_weather(city):       ↓                              │
│      ...                     函数被装饰后自动拥有 .tool_def    │
│                              管理器统一收集，提供 get_tools()  │
│  调用：manager.dispatch(name, args)                          │
└─────────────────────────────────────────────────────────────┘
```

| 对比 | 注册机制 `@registry.register` | 装饰器 `@tool` |
|---|---|---|
| 核心思想 | 注册器是"管理员"，函数是"员工" | 装饰器给函数"穿装备" |
| 新增工具 | `@registry.register` + 函数 | `@tool` + 函数 |
| 自动提取 | ✅ 函数名、docstring、类型注解 | ✅ 函数名、docstring、类型注解 |
| 主逻辑改动 | ❌ 不用改 | ❌ 不用改 |
| 灵活性 | 注册器可以有多个实例 | 装饰器更简洁，一个 `@tool` 搞定 |

> 本质一样，只是"包装方式"不同
> 两者的核心都是 **三个自动**：
> 1. 自动从函数名 → 工具名
> 2. 自动从 docstring → 工具描述
> 3. 自动从类型注解 → 参数 schema
>
> 选哪个取决于个人偏好，原理完全相同。

---

## 八、最佳实践 ✅

### 8.1 工具定义

1. **描述要清晰具体** — 不要写"查询数据"，要写"根据订单ID查询订单的发货日期"
2. **参数名要语义化** — 用 `city` 而不是 `c`，用 `order_id` 而不是 `id`
3. **善用 enum** — 如果参数有固定选项，用 `enum` 限定，减少模型出错
4. **标注 required** — 明确哪些参数必填

### 8.2 安全与错误处理

1. **永远验证参数** — 模型生成的参数可能有误，必须校验
2. **设置超时** — 工具调用可能涉及外部 API，要有超时机制
3. **权限控制** — 不是所有工具都应该被所有用户调用
4. **处理异常** — 工具执行失败时，把错误信息返回给模型让它处理

```python
def execute_tool_safely(function_name: str, arguments: dict) -> str:
    try:
        if function_name == "get_weather":
            return get_weather(arguments["city"])
        else:
            return f"未知工具: {function_name}"
    except Exception as e:
        return f"工具执行出错: {str(e)}"
```

### 8.3 常见坑

| 坑 | 解决方案 |
|---|---|
| **硬编码调用某个工具** ❌ | 用 `block.name` 做路由分发，不要直接调用固定函数 |
| 模型"幻觉"调用不存在的工具 | 代码中加 `if name in TOOL_DISPATCH` 判断，返回错误信息 |
| 模型生成了错误格式的参数 | 代码中做参数验证和类型转换 |
| 多轮对话中工具调用丢失 | 完整保留消息历史中的 tool_call 和 tool_result |
| 工具太多导致模型选择困难 | 工具描述要足够清晰，减少歧义 |

> 工具路由分发模式
> 不管有几个工具，都应该用 **注册机制/装饰器** 而不是手动维护路由表：
> ```python
> # ✅ 正确：注册机制 / 装饰器（自动分发）
> registry.dispatch(name, args)     # 注册机制
> manager.dispatch(name, input)     # 装饰器
>
> # ✅ 也行：手动路由表（适合简单场景）
> TOOL_DISPATCH = {"get_weather": lambda args: get_weather(**args)}
> result = TOOL_DISPATCH[name](args)
>
> # ❌ 错误：硬编码（只有一个工具时能跑，加工具就炸）
> result = get_weather(args["city"])
> ```
>
> 注意 `dispatch` 内部用 `**arguments` 解包参数，这样函数签名和参数名一致就能自动匹配：
> ```python
> # 模型返回: {"city": "北京"}
> # 函数签名: def get_weather(city: str)
> # **{"city": "北京"} → get_weather(city="北京")  ✅ 自动匹配
> ```

---

## 九、进阶概念

### 9.1 并行工具调用

> 用户问"北京、上海、深圳天气分别怎么样？"，模型会**一次返回 3 个 tool_call**。
> 你的代码应该**同时执行**（并发），而不是一个一个排队执行。

#### 流程图

```
用户："北京、上海、深圳天气分别怎么样？"
                │
                ▼
     ┌──────────────────────┐
     │  模型一次返回 3 个调用  │
     │  tool_call[0]: 北京    │
     │  tool_call[1]: 上海    │
     │  tool_call[2]: 深圳    │
     └──────┬───────────────┘
            │
     ┌──────┴──────────────────────────┐
     │  ❌ 串行（慢）                    │
     │  先查北京 → 等完 → 查上海 → 等完 → 查深圳  │
     │  总耗时 = T1 + T2 + T3           │
     └─────────────────────────────────┘

     ┌─────────────────────────────────┐
     │  ✅ 并行（快）                    │
     │  查北京 ─┐                       │
     │  查上海 ─┼─ 同时进行              │
     │  查深圳 ─┘                       │
     │  总耗时 = max(T1, T2, T3)        │
     └─────────────────────────────────┘
```

#### 串行 vs 并行代码对比

```python
import json
import asyncio
import aiohttp
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key="your-api-key")

# ========== 真实的异步天气 API ==========
async def get_weather(city: str) -> str:
    """调用真实天气 API（这里用 httpbin 模拟延迟）"""
    async with aiohttp.ClientSession() as session:
        # 模拟每个 API 调用需要 1 秒
        async with session.get(f"https://httpbin.org/delay/1") as resp:
            return f"{city}：晴，25°C"

# ========== ❌ 串行执行（慢） ==========
async def call_tools_sequential(tool_calls):
    """一个一个排队执行"""
    results = []
    for tc in tool_calls:
        args = json.loads(tc.function.arguments)
        result = await get_weather(args["city"])  # 等上一个完才开始下一个
        results.append({"tool_call_id": tc.id, "content": result})
    return results
    # 3 个城市 → 耗时约 3 秒

# ========== ✅ 并行执行（快） ==========
async def call_tools_parallel(tool_calls):
    """同时执行所有工具调用"""
    async def _run_one(tc):
        args = json.loads(tc.function.arguments)
        result = await get_weather(args["city"])
        return {"tool_call_id": tc.id, "content": result}

    # asyncio.gather 同时执行所有任务
    results = await asyncio.gather(*[_run_one(tc) for tc in tool_calls])
    return results
    # 3 个城市 → 耗时约 1 秒！
```

#### 完整案例：并行天气查询（Anthropic 版）

```python
import asyncio
import anthropic

client = anthropic.AsyncAnthropic(api_key="your-api-key")

# ========== 模拟耗时工具 ==========
async def get_weather(city: str) -> str:
    """模拟天气 API（实际可能需要 1-2 秒网络请求）"""
    await asyncio.sleep(1)  # 模拟网络延迟
    data = {"北京": "晴 25°C", "上海": "多云 22°C", "深圳": "阵雨 28°C"}
    return data.get(city, f"{city}：暂无数据")

async def get_stock(symbol: str) -> str:
    """模拟股票 API"""
    await asyncio.sleep(1.5)  # 模拟更慢的网络
    data = {"AAPL": "189.50 美元", "GOOG": "175.20 美元"}
    return data.get(symbol, f"{symbol}：暂无数据")

TOOLS = [...]  # 工具定义同前面的例子

# ========== 并行执行核心逻辑 ==========
async def chat_parallel(user_message: str):
    messages = [{"role": "user", "content": user_message}]

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=messages,
        tools=TOOLS
    )

    if response.stop_reason == "tool_use":
        tool_blocks = [b for b in response.content if b.type == "tool_use"]

        print(f"🎯 模型想同时调用 {len(tool_blocks)} 个工具")

        # 路由表
        dispatch = {
            "get_weather": lambda inp: get_weather(inp["city"]),
            "get_stock": lambda inp: get_stock(inp["symbol"]),
        }

        # ✅ asyncio.gather 并行执行
        async def run_one(block):
            print(f"  🔧 开始: {block.name}({block.input})")
            result = await dispatch[block.name](block.input)
            print(f"  ✅ 完成: {block.name} → {result}")
            return {"type": "tool_result", "tool_use_id": block.id, "content": result}

        tool_results = await asyncio.gather(*[run_one(b) for b in tool_blocks])

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})

        final = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=messages,
            tools=TOOLS
        )
        print(f"\n🤖 助手: {final.content[0].text}")

# ========== 测试 ==========
if __name__ == "__main__":
    asyncio.run(chat_parallel(
        "帮我查一下北京、上海、深圳的天气，还有 AAPL 的股价"
    ))
```

#### 运行效果

```
🎯 模型想同时调用 4 个工具
  🔧 开始: get_weather({'city': '北京'})
  🔧 开始: get_weather({'city': '上海'})
  🔧 开始: get_weather({'city': '深圳'})
  🔧 开始: get_stock({'symbol': 'AAPL'})
  ✅ 完成: get_weather → 北京：晴 25°C
  ✅ 完成: get_weather → 上海：多云 22°C
  ✅ 完成: get_weather → 深圳：阵雨 28°C
  ✅ 完成: get_stock → AAPL：189.50 美元

🤖 助手: 北京晴天25°C，上海多云22°C，深圳阵雨28°C。AAPL 当前股价 189.50 美元。

串行耗时: 1+1+1+1.5 = 4.5 秒
并行耗时: max(1, 1, 1, 1.5) = 1.5 秒  ← 快了 3 倍！
```

> 并行的条件
> 只有当工具调用之间**没有依赖关系**时才能并行。
> 比如"先查天气，再根据天气推荐穿什么"——第二个依赖第一个的结果，就必须串行。

### 9.2 强制工具调用

使用 `tool_choice` 强制模型调用特定工具：
- 适用于：你明确知道需要调用某个工具的场景
- 例如：用户说了"查天气"，你确定要调用 `get_weather`

### 9.3 工具与 Agent 的关系

```
Agent = LLM（大脑） + Tools（手脚） + Memory（记忆） + Planning（规划）
```

Tool Use 是构建 AI Agent 的**核心基础能力**。当你学会 Tool Use 后，下一步就是学习如何构建 Agent。

---

## 十、总结

```
Tool Use 的本质 = 让大模型从"只会说话"变成"能做事情"

关键流程：
  用户提问 → 模型决定用哪个工具 → 你的代码执行 → 结果返回模型 → 模型总结回复

核心要点：
  1. 模型只是"建议"调用工具，真正的执行在你的代码
  2. 用 JSON Schema 定义工具参数
  3. OpenAI 和 Anthropic 格式略有不同，但原理一样
  4. 永远验证模型生成的参数
  5. 用路由表分发工具，不要硬编码调用某个函数
```

---

## 参考资料

- [OpenAI Function Calling 官方文档](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use 官方文档](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview)
- [OpenAI Function Calling 最佳实践 (2025)](https://platform.openai.com/docs/guides/function-calling#best-practices-for-defining-functions)
