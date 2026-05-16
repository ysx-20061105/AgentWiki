---
title: SubAgent（子智能体）完全指南
date: 2026-05-11
categories:
  - Agent
tags: ["AI", "LLM", "SubAgent", "子智能体", "多智能体", "OpenAI", "LangChain", "Claude", "学习笔记"]
summary: "SubAgent（子智能体）架构详解，介绍如何将复杂任务拆分给专门的子Agent执行，实现关注点分离。"
---

# SubAgent（子智能体）完全指南

## 什么是 SubAgent？

### 一句话理解
> SubAgent（子智能体）= 让一个"总管"AI 把任务拆分给多个"专家"AI 来做。

### 生活化类比
想象你开了一家餐厅：
- **主 Agent（总管/经理）**：负责接单、分配任务、汇总结果
- **SubAgent A（厨师）**：只负责做菜
- **SubAgent B（服务员）**：只负责上菜和客户沟通
- **SubAgent C（采购）**：只负责采购食材

每个"专家"只专注自己领域的事，做完把结果汇报给"总管"，总管再汇总给用户。

---

## 为什么需要 SubAgent？

### 单 Agent 的问题

| 问题 | 说明 |
|------|------|
| **上下文膨胀** | 一个 Agent 做太多事，对话历史越来越长，性能下降 |
| **角色混淆** | 同时负责写代码、审查代码、写文档，容易"串台" |
| **无法并行** | 任务只能串行执行，效率低 |
| **权限失控** | 一个 Agent 拥有所有权限，不安全 |

### SubAgent 的优势

| 优势        | 说明                         |
| --------- | -------------------------- |
| **上下文隔离** | 每个 SubAgent 有独立的上下文，不会互相污染 |
| **专业分工**  | 每个 SubAgent 只做一件事，更精准      |
| **并行执行**  | 多个 SubAgent 可以同时工作         |
| **权限控制**  | 每个 SubAgent 只拥有它需要的工具和权限   |
| **易于复用**  | 定义好的 SubAgent 可以在不同项目中重复使用 |

---

## 核心架构模式

### 1. Orchestrator-Worker（编排器-工人）模式

这是最常见的 SubAgent 架构：

```
用户请求
   ↓
┌─────────────────┐
│  主 Agent（编排器） │  ← 负责理解任务、分配、汇总
└────────┬────────┘
         │ 分发任务
    ┌────┼────┐
    ↓    ↓    ↓
┌─────┐┌─────┐┌─────┐
│子Agent││子Agent││子Agent│  ← 各自独立执行
│ A   ││ B   ││ C   │
└──┬──┘└──┬──┘└──┬──┘
   │      │      │
   └──────┼──────┘
          ↓
     汇总结果返回给用户
```

**特点**：
- 主 Agent 是"指挥官"，SubAgent 是"执行者"
- 主 Agent 根据任务类型决定调用哪个 SubAgent
- SubAgent 之间互不通信，只和主 Agent 交互

### 2. Handoff（任务交接）模式

```
用户请求
   ↓
┌──────────────┐
│  分流 Agent   │  ← 判断该交给谁
└──────┬───────┘
       │ handoff（交接）
       ↓
┌──────────────┐
│  专家 Agent   │  ← 接手并完成任务
└──────────────┘
```

**特点**：
- 像"转接电话"一样，把任务转给合适的专家
- 交接后，控制权完全转移给目标 Agent
- 适合需要"分流"的场景（如客服系统）

### 3. Supervisor（监督者）模式

```
用户请求
   ↓
┌─────────────────┐
│  Supervisor（监督者）│  ← 动态决策下一步
└────────┬────────┘
         │
    ┌────┼────┐
    ↓    ↓    ↓
┌─────┐┌─────┐┌─────┐
│研究员││写作者││审查员│
└──┬──┘└──┬──┘└──┬──┘
   │      │      │
   └──────┼──────┘
          ↓
     Supervisor 汇总 → 返回用户
```

**特点**：
- Supervisor 可以动态决定下一步调用谁
- 支持循环调用（如：写完→审查→修改→再审查）
- 比 Handoff 更灵活，适合复杂工作流

---

## 三大平台的 SubAgent 实现对比

| 特性 | Claude Code SubAgent | OpenAI Agents SDK | LangGraph (LangChain) |
|------|---------------------|-------------------|----------------------|
| **核心机制** | Agent Tool（元工具） | Handoff（任务交接） | Supervisor + Graph |
| **配置方式** | Markdown 文件 + YAML | Python 代码 | Python 代码 + 图定义 |
| **上下文隔离** | ✅ 天然隔离 | ✅ 每个 Agent 独立 | ✅ State 隔离 |
| **并行支持** | ✅ 最多 49 个并行 | ✅ 支持 | ✅ 支持 |
| **学习曲线** | 低 | 低 | 中等 |
| **适用场景** | Claude Code 内部任务 | 通用多 Agent 应用 | 复杂生产级工作流 |

---

## 案例一：基于 OpenAI Agents SDK 实现多 Agent 协作

### 安装

```bash
pip install openai-agents
export OPENAI_API_KEY="sk-..."
```

### 核心概念（3 个原语）

1. **Agent**：带指令和工具的 LLM 实例
2. **Handoff**：Agent 之间的任务交接
3. **Guardrail**：输入/输出验证规则

### 完整案例：智能客服系统

这个案例实现一个"智能客服分流系统"：
- **分流 Agent**：判断用户问题类型
- **退款 Agent**：处理退款相关问题
- **技术支持 Agent**：处理技术问题

```python
"""
OpenAI Agents SDK - 智能客服分流系统
安装: pip install openai-agents
运行: export OPENAI_API_KEY="sk-..." && python this_file.py
"""
import asyncio
from agents import Agent, Runner

# ========== 第1步：定义各个专业 Agent ==========

# 退款专家 Agent
refund_agent = Agent(
    name="退款专家",
    instructions="""你是一个退款处理专家。
    你的职责：
    1. 了解用户的退款原因
    2. 检查订单是否符合退款条件
    3. 告知用户预计退款时间
    注意：只处理退款相关问题，其他问题请转交。
    """,
    handoff_description="当用户询问退款、退货、订单取消相关问题时，转交给此Agent"
)

# 技术支持 Agent
tech_support_agent = Agent(
    name="技术支持",
    instructions="""你是一个技术支持专家。
    你的职责：
    1. 诊断用户遇到的技术问题
    2. 提供分步骤的解决方案
    3. 如果问题复杂，建议用户联系人工客服
    注意：只处理技术问题，其他问题请转交。
    """,
    handoff_description="当用户遇到产品使用问题、bug、技术故障时，转交给此Agent"
)

# ========== 第2步：定义分流 Agent（主 Agent）==========

triage_agent = Agent(
    name="客服分流员",
    instructions="""你是一个智能客服分流员。
    你的职责是：
    1. 热情问候用户
    2. 快速判断用户问题类型
    3. 将问题转交给对应的专业 Agent：
       - 退款/退货相关 → 转给"退款专家"
       - 技术问题/bug → 转给"技术支持"
    4. 如果问题不属于以上类型，由你直接回答
    """,
    handoffs=[refund_agent, tech_support_agent]  # 声明可以交接的目标
)

# ========== 第3步：运行 ==========

async def main():
    # 场景1：退款问题
    print("=" * 50)
    print("场景1：退款问题")
    print("=" * 50)
    result = await Runner.run(
        triage_agent,
        "我上周买了一个耳机，但是收到的是坏的，我想退货退款"
    )
    print(f"回复：{result.final_output}")

    # 场景2：技术问题
    print("\n" + "=" * 50)
    print("场景2：技术问题")
    print("=" * 50)
    result = await Runner.run(
        triage_agent,
        "我的蓝牙耳机连不上手机，总是显示配对失败"
    )
    print(f"回复：{result.final_output}")

if __name__ == "__main__":
    asyncio.run(main())
```

### 代码运行流程

```
用户: "我买的耳机是坏的，想退款"
        ↓
   [客服分流员] 判断：这是退款问题
        ↓ handoff（交接）
   [退款专家] 接手处理退款流程
        ↓
   返回退款方案给用户
```

### 进阶：带工具的 Agent

```python
from agents import Agent, Runner, function_tool

# 定义工具函数
@function_tool
def check_order_status(order_id: str) -> str:
    """查询订单状态"""
    # 实际项目中这里会查询数据库
    orders = {
        "ORD001": "已发货，物流单号 SF123456",
        "ORD002": "已完成，签收时间 2026-05-01",
        "ORD003": "退款处理中，预计3-5个工作日",
    }
    return orders.get(order_id, "未找到该订单")

@function_tool
def create_refund(order_id: str, reason: str) -> str:
    """创建退款工单"""
    return f"退款工单已创建！订单号：{order_id}，原因：{reason}，预计3-5个工作日处理"

# 创建带工具的退款 Agent
refund_agent_with_tools = Agent(
    name="退款专家",
    instructions="""你是退款处理专家。
    使用 check_order_status 查询订单状态。
    使用 create_refund 创建退款工单。
    """,
    tools=[check_order_status, create_refund]
)
```

---

## 案例二：基于 LangGraph 实现 Supervisor 多 Agent 系统

### 安装

```bash
pip install langgraph langgraph-supervisor langchain-openai
export OPENAI_API_KEY="sk-..."
```

### 核心概念

- **StateGraph**：状态图，定义工作流
- **Node**：节点，每个节点是一个 Agent 或函数
- **Edge**：边，定义节点之间的流转关系
- **Supervisor**：监督者，动态决定下一个调用谁

### 完案案例：研究助手系统

这个案例实现一个"研究助手"：
- **研究员 Agent**：负责搜索和收集信息
- **数学家 Agent**：负责计算和数学推理
- **Supervisor**：监督者，决定调用谁

```python
"""
LangGraph Supervisor - 研究助手系统
安装: pip install langgraph langgraph-supervisor langchain-openai
运行: export OPENAI_API_KEY="sk-..." && python this_file.py
"""
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph_supervisor import create_supervisor

# ========== 第1步：定义工具函数 ==========

def search_web(query: str) -> str:
    """模拟网络搜索（实际项目中接入搜索API）"""
    # 这里是模拟数据，实际使用时接入 Tavily 等搜索 API
    search_results = {
        "Python": "Python 是一种高级编程语言，由 Guido van Rossum 于 1991 年创建。最新版本为 Python 3.12。",
        "AI": "人工智能（AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。",
        "LangChain": "LangChain 是一个用于构建 LLM 应用的框架，LangGraph 是其多 Agent 编排引擎。",
    }
    for key, value in search_results.items():
        if key.lower() in query.lower():
            return value
    return f"搜索 '{query}' 的结果：找到相关文章3篇，核心观点认为该领域正在快速发展。"

def calculator(expression: str) -> str:
    """计算器工具"""
    try:
        result = eval(expression)
        return f"计算结果：{expression} = {result}"
    except Exception as e:
        return f"计算错误：{e}"

# ========== 第2步：创建专业 Agent ==========

# 研究员 Agent - 擅长搜索和信息收集
research_agent = create_react_agent(
    model=ChatOpenAI(model="gpt-4o-mini"),
    tools=[search_web],
    name="researcher",
    prompt="""你是一个专业的研究员。
    你的职责：
    1. 使用搜索工具收集信息
    2. 整理和总结研究结果
    3. 提供准确、有来源的信息
    只负责信息收集，不负责数学计算。"""
)

# 数学家 Agent - 擅长数学计算和推理
math_agent = create_react_agent(
    model=ChatOpenAI(model="gpt-4o-mini"),
    tools=[calculator],
    name="mathematician",
    prompt="""你是一个数学专家。
    你的职责：
    1. 使用计算器工具进行精确计算
    2. 解释数学概念和推理过程
    3. 验证计算结果的正确性
    只负责数学相关任务，不负责信息搜索。"""
)

# ========== 第3步：创建 Supervisor（监督者）==========

supervisor = create_supervisor(
    model=ChatOpenAI(model="gpt-4o-mini"),
    agents=[research_agent, math_agent],
    prompt="""你是一个任务监督者（Supervisor）。
    你的职责：
    1. 分析用户的问题
    2. 决定由哪个 Agent 来处理：
       - 需要搜索信息 → 交给 researcher（研究员）
       - 需要数学计算 → 交给 mathematician（数学家）
       - 两者都需要 → 依次调用
    3. 汇总所有 Agent 的结果，给出最终答案
    注意：你只负责调度，不亲自执行任务。"""
)

# 编译工作流
app = supervisor.compile()

# ========== 第4步：运行 ==========

def main():
    # 场景1：需要搜索的问题
    print("=" * 60)
    print("场景1：信息搜索")
    print("=" * 60)
    result = app.invoke({
        "messages": [{"role": "user", "content": "请帮我研究一下 Python 语言的发展历史"}]
    })
    print(f"回复：{result['messages'][-1].content}")

    # 场景2：需要计算的问题
    print("\n" + "=" * 60)
    print("场景2：数学计算")
    print("=" * 60)
    result = app.invoke({
        "messages": [{"role": "user", "content": "请计算 (15 * 23) + (456 / 12) 的结果"}]
    })
    print(f"回复：{result['messages'][-1].content}")

    # 场景3：混合任务
    print("\n" + "=" * 60)
    print("场景3：混合任务（搜索+计算）")
    print("=" * 60)
    result = app.invoke({
        "messages": [{"role": "user", "content": "请帮我了解一下 Python 的历史，然后计算 2 的 10 次方是多少"}]
    })
    print(f"回复：{result['messages'][-1].content}")

if __name__ == "__main__":
    main()
```

### 代码运行流程

```
用户: "研究 Python 历史，然后计算 2^10"
          ↓
     [Supervisor] 分析：需要先搜索再计算
          ↓
     [researcher] 搜索 Python 历史信息
          ↓ 返回搜索结果
     [Supervisor] 收到结果，还需要计算
          ↓
     [mathematician] 计算 2^10 = 1024
          ↓ 返回计算结果
     [Supervisor] 汇总所有结果
          ↓
     返回完整答案给用户
```

### 进阶：带状态持久化的工作流

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, END
from typing import TypedDict, Literal

# 定义状态结构
class ResearchState(TypedDict):
    topic: str           # 研究主题
    research_done: bool  # 研究是否完成
    research_result: str # 研究结果
    math_result: str     # 计算结果
    final_answer: str    # 最终答案

# 创建带持久化的工作流
def create_research_workflow():
    workflow = StateGraph(ResearchState)

    # 添加节点
    workflow.add_node("researcher", research_node)
    workflow.add_node("mathematician", math_node)
    workflow.add_node("supervisor", supervisor_node)

    # 定义边
    workflow.set_entry_point("supervisor")
    workflow.add_conditional_edges(
        "supervisor",
        lambda state: "researcher" if not state.get("research_done") else "mathematician",
        {"researcher": "researcher", "mathematician": "mathematician", "end": END}
    )
    workflow.add_edge("researcher", "supervisor")
    workflow.add_edge("mathematician", END)

    # 编译并添加持久化
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)
```

---

## 实践建议

### 何时使用 SubAgent？

| 场景 | 是否需要 SubAgent | 原因 |
|------|:----------------:|------|
| 简单问答 | ❌ | 单 Agent 足够 |
| 需要多个专业技能 | ✅ | 专业分工更高效 |
| 任务有多个独立步骤 | ✅ | 可并行执行 |
| 需要复杂决策流程 | ✅ | Supervisor 模式适合 |
| 需要访问不同数据源 | ✅ | 每个 Agent 连接不同工具 |

### 设计原则

1. **按上下文拆分，而非按角色拆分**
   - ❌ 错误：前端 Agent、后端 Agent（职责重叠）
   - ✅ 正确：代码审查 Agent、测试生成 Agent（上下文独立）

2. **遵循最小权限原则**
   - 每个 SubAgent 只拥有它需要的工具
   - 只读任务不给写权限

3. **保持主 Agent 轻量**
   - 主 Agent 只负责调度和汇总
   - 具体执行交给 SubAgent

4. **避免过度设计**
   - 先尝试单 Agent 能否解决
   - 当单 Agent 效果不好时，再引入多 Agent

---

## 学习资源

### 官方文档
- [Anthropic - Building Effective Agents](https://docs.anthropic.com/en/docs/build-with-claude/agentic-systems)
- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/)
- [LangGraph 多 Agent 文档](https://langchain-ai.github.io/langgraph/concepts/multi_agent/)

### 相关概念
- 13.Multi-Agent - 多 Agent 系统概述
- 11.tool - Agent 如何使用工具
- 2.Prompt工程 - 如何写好 Agent 的指令

---

## 常见问题

### Q1: SubAgent 和普通函数调用有什么区别？
**A**: SubAgent 有自己的"思考能力"（LLM），可以理解任务、做决策。普通函数只是执行固定逻辑。

### Q2: SubAgent 之间可以互相通信吗？
**A**: 取决于架构模式。Orchestrator-Worker 模式下，SubAgent 之间不直接通信；Swarm 模式下，Agent 之间可以点对点通信。

### Q3: 一个系统应该有多少个 SubAgent？
**A**: 没有固定答案。建议从 2-3 个开始，根据实际需求增加。过多的 SubAgent 会增加系统复杂度。

### Q4: SubAgent 的成本如何控制？
**A**: 每个 SubAgent 调用都会消耗 Token。建议：
- 为简单任务使用小模型（如 Haiku、GPT-4o-mini）
- 为复杂任务使用大模型（如 GPT-4o、Claude Opus）
- 设置 Token 限制和超时机制

---

*最后更新：2026-05-11*
