---
title: MCP模型上下文协议完全指南
date: 2026-05-05
categories:
  - Agent
tags: ["AI", "MCP", "Python", "智能体", "技术学习"]
summary: "MCP（模型上下文协议）完全指南，介绍Anthropic推出的开放标准协议，统一LLM与外部数据源和工具的通信方式。"
---

# MCP模型上下文协议完全指南

## 一、什么是MCP？

### 1.1 基本定义

**MCP (Model Context Protocol，模型上下文协议)** 是由 Anthropic 公司于2024年11月底推出的**开放标准协议**，旨在统一大型语言模型(LLM)与外部数据源、工具之间的通信方式。

> 💡 **类比理解**：如果说USB协议让各种设备能和电脑通信，那么MCP就是让AI智能体能和各种数据源、工具通信的"USB协议"。

### 1.2 MCP解决什么问题？

在没有MCP之前：
- 每个AI应用需要为每个数据源/工具单独开发集成代码
- 开发者需要重复做大量适配工作
- 工具和数据源的组合使用非常麻烦

```
传统方式 (每个AI应用 × 每个工具 = N×M个工作):
┌─────────────┐     ┌─────────────┐
│  AI应用A    │────▶│   工具1     │
└─────────────┘     └─────────────┘
       │                   ▲
       │                   │
       ▼                   │
┌─────────────┐     ┌─────────────┐
│  AI应用B    │────▶│   工具1     │
└─────────────┘     └─────────────┘
       │
       │                   ▼
       ▼            ┌─────────────┐
┌─────────────┐    │   工具2     │
│  AI应用C    │────▶└─────────────┘
└─────────────┘
```

使用MCP之后：
- **一次开发，处处运行** — 开发者只需写一个MCP服务器，所有支持MCP的AI客户端都能用
- **安全可控** — 用户精确控制AI能访问哪些数据
- **即插即用** — 像USB设备一样，插上就能用

```
MCP方式 (每个工具只开发一次):
┌─────────────────────────────────────────┐
│              MCP生态系统                 │
│  ┌─────────┐                            │
│  │ MCP服务器 │◀───文件系统服务器          │
│  │ (工具)   │                            │
│  └────┬────┘                            │
│       │                                  │
│  ┌────▼────┐                            │
│  │ MCP客户端│───▶ Claude Desktop        │
│  │ (AI应用) │───▶ Cursor               │
│  └─────────┘───▶ 任何支持MCP的应用      │
└─────────────────────────────────────────┘
```

### 1.3 MCP的官方资源

| 资源 | 链接 |
|------|------|
| 官方网站 | modelcontextprotocol.io |
| Python SDK | GitHub |
| MCP Servers | 官方示例服务器 |
| 客户端支持 | MCP支持的应用列表 |

---

## 二、MCP核心概念

### 2.1 架构概述

MCP遵循**客户端-服务器架构**，包含四个核心组件：

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP架构                                │
│                                                             │
│   ┌─────────┐      ┌─────────┐      ┌─────────┐            │
│   │  Host   │      │ Client  │◀────▶│ Server  │            │
│   │ (主机)  │─────▶│ (客户端)│      │ (服务端)│            │
│   └─────────┘      └─────────┘      └───┬───┘            │
│       │                                  │                │
│       │                                  ▼                │
│       │                          ┌─────────────┐          │
│       │                          │ Data Sources │          │
│       │                          │  (数据源)    │          │
│       └──────────────────────────│本地│远程│API│          │
│                                   └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 四大核心组件

#### 2.2.1 Prompts (提示模板)

**定义**：可重用的提示模板，用于定义AI助手的行为模式和响应风格。

**作用**：
- 定义系统角色的行为准则
- 提供标准化的对话模板
- 支持动态参数注入

**示例场景**：
```python
# 数学问题求解提示
# 引导AI逐步解决数学问题

# 代码审查提示
# 定义代码检查的标准流程

# 文档生成提示
# 规范文档结构和格式
```

#### 2.2.2 Resources (资源)

**定义**：静态或动态的数据源，通过URI（统一资源标识符）进行访问。

**特性**：
- 支持模板URI（如 `greeting://{name}`）
- 可返回文本、JSON等多种格式
- 支持动态数据生成

**示例场景**：
```
config://app           → 配置文件读取
greeting://{username}  → 个性化问候
constant://pi         → 常量数据
file://document/report → 文件内容读取
```

#### 2.2.3 Tools (工具) ⭐最重要

**定义**：可执行的函数，供AI助手调用以完成特定任务。

**特点**：
- 明确的参数类型定义
- 标准化的返回格式
- 支持错误处理机制

**示例场景**：
```
数学运算:  加减乘除、幂运算、平方根
数据查询:  数据库检索、API调用
文件操作:  读写文件、目录遍历
网络请求:  HTTP请求、邮件发送
```

#### 2.2.4 Transport (传输层)

**定义**：客户端和服务器之间的通信机制。

**支持的传输方式**：
- **stdio**: 标准输入/输出，适合本地进程通信
- **HTTP/SSE**: 基于HTTP的Server-Sent Events，适合远程服务
- **WebSocket**: 双向实时通信

**通信协议**：基于 JSON-RPC 2.0

### 2.3 通信流程

MCP Client的工作流程如下：

```
1. MCP Client 从 MCP Server 获取可用的工具列表
        │
        ▼
2. 将用户的查询连同工具描述通过 function calling 一起发送给 LLM
        │
        ▼
3. LLM 决定是否需要使用工具以及使用哪些工具
        │
        ├── 是 ──▶ 4. MCP Client 通过 MCP Server 执行工具调用
        │
        └── 否 ──▶ 6. 直接生成响应
        │
        ▼
5. 工具调用结果被发送回 LLM
        │
        ▼
6. LLM 基于所有信息生成自然语言响应
        │
        ▼
7. 将响应展示给用户
```

---

## 三、如何使用MCP

### 3.1 环境准备

**基础要求**：
- Python 3.10+
- 支持MCP的AI客户端（如 Claude Desktop、Cursor 等）

**安装MCP工具**：

使用Claude Desktop：
1. 设置 → MCP Server → 添加新的MCP服务器

使用Cursor：
1. 设置 → MCP → 添加服务器

### 3.2 快速配置官方服务器

#### 3.2.1 文件系统服务器示例

**安装**：
```bash
npm install @modelcontextprotocol/server-filesystem
```

**配置JSON** (在 `mcp.json` 中)：
```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "./data"]
    }
  }
}
```

#### 3.2.2 常用官方服务器

| 服务器 | 用途 | 安装命令 |
|--------|------|----------|
| filesystem | 文件系统操作 | `npm install @modelcontextprotocol/server-filesystem` |
| git | Git操作 | `npm install @modelcontextprotocol/server-git` |
| slack | Slack集成 | `npm install @modelcontextprotocol/server-slack` |
| fetch | HTTP请求 | `npm install @modelcontextprotocol/server-fetch` |

### 3.3 使用Cursor测试MCP

**步骤**：

1. **打开Cursor设置**
   - 启动 Cursor
   - Preferences → Cursor Settings

2. **添加MCP服务器**
   - 在设置界面找到 **MCP** 选项卡
   - 点击 **"Add a new global MCP server"**
   - 首次配置会提示创建 `mcp.json` 文件

3. **编辑配置**
   ```json
   {
     "mcpServers": {
       "my-server": {
         "command": "python",
         "args": ["path/to/your/server.py"],
         "env": {}
       }
     }
   }
   ```

4. **测试连接**
   - 重启Cursor
   - 在聊天中使用 `/` 查看可用的MCP工具

---

## 四、用Python制作MCP

### 4.1 开发框架选择

推荐使用 **FastMCP** 框架，它是目前最简单易用的Python MCP开发库。

**官网**：[https://gofastmcp.com](https://gofastmcp.com)

**安装**：
```bash
pip install fastmcp
```

### 4.2 创建第一个MCP服务器

#### 4.2.1 最简结构

```python
from mcp.server.fastmcp import FastMCP

# 创建MCP服务器实例
mcp = FastMCP("我的第一个MCP服务器")

# 添加工具
@mcp.tool()
def add(a: int, b: int) -> int:
    """计算两个数的和"""
    return a + b

# 添加资源
@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """获取个性化的问候信息"""
    return f"你好，{name}！"

# 运行服务器
if __name__ == "__main__":
    mcp.run()
```

#### 4.2.2 带参数描述的Tool

**推荐写法**：使用 `Annotated` 和 `Field` 标记参数描述

```python
from typing import Annotated
from fastmcp import FastMCP
from pydantic import Field

mcp = FastMCP("数据分析助手")

@mcp.tool()
def calculate_average(
    numbers: Annotated[
        list[float],
        Field(description="用于计算平均值的数字列表")
    ]
) -> dict:
    """
    计算一组数字的平均值

    Args:
        numbers: 数字列表

    Returns:
        包含平均值、最大值、最小值的字典
    """
    if not numbers:
        return {"error": "数字列表不能为空"}

    return {
        "average": sum(numbers) / len(numbers),
        "max": max(numbers),
        "min": min(numbers),
        "count": len(numbers)
    }
```

### 4.3 实战项目：天气查询服务器

#### 4.3.1 环境搭建

```bash
# 创建项目
uv init weather
cd weather

# 创建虚拟环境
uv venv
source .venv/bin/activate  # Linux/Mac
# 或: .venv\Scripts\activate  # Windows

# 安装依赖
uv add "mcp[cli]" httpx
```

#### 4.3.2 完整代码实现

```python
from fastmcp import FastMCP, Context
from pydantic import Field
from typing import Annotated
import httpx
import json

# 初始化MCP服务器
mcp = FastMCP(
    name="天气查询服务",
    instructions="提供天气预报和天气查询功能"
)

# ==================== Tool 示例 ====================

@mcp.tool()
async def get_weather(
    city: Annotated[
        str,
        Field(description="城市名称，如：北京、上海、Tokyo")
    ],
    days: Annotated[
        int,
        Field(description="预报天数，1-7之间", ge=1, le=7)
    ] = 1
) -> dict:
    """
    获取指定城市的天气预报

    Args:
        city: 城市名称
        days: 预报天数

    Returns:
        天气信息字典
    """
    # 这里是模拟数据，实际使用时可调用真实API
    return {
        "city": city,
        "forecast": [
            {"day": i+1, "weather": "晴", "temp": 20+i, "humidity": 60+i*2}
            for i in range(min(days, 7))
        ]
    }


@mcp.tool()
def currency_converter(
    amount: Annotated[float, Field(description="要转换的金额")],
    from_currency: Annotated[str, Field(description="源货币代码，如：USD、CNY")],
    to_currency: Annotated[str, Field(description="目标货币代码，如：USD、CNY")]
) -> dict:
    """
    货币转换（模拟数据）

    Args:
        amount: 金额
        from_currency: 源货币
        to_currency: 目标货币
    """
    # 模拟汇率
    rates = {"USD_CNY": 7.2, "CNY_USD": 0.14, "USD_JPY": 149}

    key = f"{from_currency}_{to_currency}"
    if key in rates:
        result = amount * rates[key]
    else:
        result = amount * rates.get(f"{to_currency}_{from_currency}", 1)
        result = amount / (1/rates.get(f"{to_currency}_{from_currency}", 1)) if f"{to_currency}_{from_currency}" in rates else amount

    return {
        "original": f"{amount} {from_currency}",
        "converted": f"{result:.2f} {to_currency}",
        "rate": rates.get(key, 1)
    }


# ==================== Resource 示例 ====================

@mcp.resource("weather://{city}")
def get_city_weather(city: str) -> str:
    """获取城市天气资源"""
    return f"获取 {city} 的天气信息..."


@mcp.resource("config://app")
def get_app_config() -> str:
    """获取应用配置"""
    return json.dumps({
        "version": "1.0.0",
        "theme": "dark",
        "language": "zh-CN"
    })


# ==================== Prompt 示例 ====================

@mcp.prompt()
def weather_report_prompt(city: str, period: str) -> str:
    """生成天气报告提示词"""
    return f"""请为{period}的{city}生成一份详细的天气报告，包括：
1. 温度变化趋势
2. 建议的穿着
3. 出行注意事项
4. 健康提示"""


# 运行服务器
if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### 4.4 使用Context进行高级操作

```python
from fastmcp import FastMCP, Context

mcp = FastMCP("高级MCP服务器")

@mcp.tool()
async def complex_task(
    ctx: Context,
    filename: str,
    content: str
) -> dict:
    """
    带日志和进度报告的复杂任务

    Args:
        ctx: 上下文对象，用于报告进度和日志
        filename: 要处理的文件名
        content: 文件内容
    """
    # 报告进度
    await ctx.info(f"开始处理文件: {filename}")
    await ctx.progress(0, 100)

    # 执行业务逻辑
    lines = content.split('\n')
    await ctx.progress(50, 100)

    # 发送日志
    await ctx.log(level="info", data=f"处理了 {len(lines)} 行")

    await ctx.progress(100, 100)

    return {
        "filename": filename,
        "lines": len(lines),
        "status": "success"
    }
```

### 4.5 测试MCP服务器

#### 4.5.1 使用FastMCP客户端测试

```python
from fastmcp import FastMCPClient
import asyncio

async def test_server():
    # 连接到MCP服务器
    async with FastMCPClient("python /path/to/server.py") as client:
        # 列出可用工具
        tools = await client.list_tools()
        print("可用工具:", [t.name for t in tools])

        # 调用工具
        result = await client.call_tool("add", {"a": 5, "b": 3})
        print("计算结果:", result)

asyncio.run(test_server())
```

#### 4.5.2 在Cursor中使用

1. 将服务器代码放在项目目录
2. 在 `~/.cursor/mcp.json` 添加配置：
```json
{
  "mcpServers": {
    "weather": {
      "command": "python",
      "args": ["/path/to/weather_server.py"]
    }
  }
}
```
3. 重启Cursor即可使用

---

## 五、MCP进阶主题

### 5.1 安全考虑

**关键安全原则**：

| 原则 | 说明 |
|------|------|
| 最小权限 | 只暴露必要的工具和资源 |
| 输入验证 | 严格验证所有输入参数 |
| 沙箱环境 | 考虑在隔离环境中运行敏感操作 |
| 用户确认 | 对于危险操作添加确认机制 |

### 5.2 传输方式对比

| 传输方式 | 适用场景 | 优点 | 缺点 |
|----------|----------|------|------|
| **stdio** | 本地进程 | 简单、低延迟 | 不适合远程访问 |
| **HTTP/SSE** | 远程服务 | 支持跨网络 | 需要部署服务器 |
| **WebSocket** | 实时应用 | 双向通信 | 配置较复杂 |

### 5.3 多客户端连接

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("多客户端服务器")

@mcp.tool()
async def shared_tool(data: str) -> str:
    """
    可被多个客户端共享的工具
    """
    return f"处理数据: {data}"

# 服务器会同时处理来自多个客户端的请求
if __name__ == "__main__":
    mcp.run(transport="sse")  # 支持多客户端
```

---

## 六、学习路径与资源

### 6.1 推荐学习顺序

```
1. 基础概念 ──────────────────────────────────▶ 理解MCP解决了什么问题
       │
       ▼
2. 核心组件 ──────────────────────────────────▶ 掌握 Tools/Resources/Prompts
       │
       ▼
3. 环境搭建 ──────────────────────────────────▶ 配置一个官方MCP服务器
       │
       ▼
4. Python入门 ────────────────────────────────▶ 用FastMCP创建简单工具
       │
       ▼
5. 实战项目 ──────────────────────────────────▶ 开发完整的功能服务器
       │
       ▼
6. 进阶优化 ──────────────────────────────────▶ 安全、性能、错误处理
```

### 6.2 相关链接

| 类型 | 链接 | 说明 |
|------|------|------|
| 官方文档 | MCP官网 | 官方完整文档 |
| Python SDK | GitHub | Python开发库 |
| 官方服务器 | GitHub | 官方示例 |
| FastMCP文档 | gofastmcp.com | FastMCP框架 |
| 微软教程 | mcp-for-beginners | 微软开源教程 |

---

## 七、快速参考

### 7.1 常用命令速查

```bash
# 安装FastMCP
pip install fastmcp

# 安装官方MCP服务器
npm install @modelcontextprotocol/server-filesystem
npm install @modelcontextprotocol/server-git

# 验证MCP服务器
npx @modelcontextprotocol/server-filesystem ./path
```

### 7.2 FastMCP装饰器速查

```python
from fastmcp import FastMCP

mcp = FastMCP("服务器名称")

@mcp.tool()                    # 定义工具
@mcp.resource("uri://{param}") # 定义资源
@mcp.prompt()                  # 定义提示模板
@mcp.resource_template()       # 带参数的动态资源
```

---

## 八、总结

### MCP的核心价值

| 维度 | 价值 |
|------|------|
| **标准化** | 统一AI与外部工具的通信协议 |
| **复用性** | 一次开发，多端使用 |
| **安全性** | 用户可控的数据访问权限 |
| **生态性** | 越来越丰富的MCP服务器生态 |

### 下一步学习建议

1. ✅ 先用官方服务器体验MCP
2. ✅ 用FastMCP创建自己的第一个工具
3. ✅ 尝试连接数据库、API等真实数据源
4. ✅ 探索多工具组合的复杂场景
5. ✅ 关注MCP生态系统的发展

> 🚀 **提示**：MCP正处于快速发展期，建议定期关注官方更新和新出的MCP服务器！

---

*本文档最后更新于 2026-05-05*
