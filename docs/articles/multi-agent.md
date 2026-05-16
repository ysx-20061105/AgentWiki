---
title: Multi-Agent（多智能体）完全指南
date: 2026-05-11
categories:
  - Agent
tags: ["AI", "LLM", "MultiAgent", "多智能体", "OpenAI", "Anthropic", "学习笔记"]
summary: "Multi-Agent（多智能体）完全指南，涵盖多Agent协作架构、通信机制、任务分解及OpenAI/Anthropic SDK实现。"
---

# Multi-Agent（多智能体）完全指南

## 一、学习路线图

```
第1步：理解概念 ──→ 什么是多智能体？为什么需要它？
    │
第2步：设计模式 ──→ Anthropic 提出的6种核心架构模式
    │
第3步：核心机制 ──→ Handoff（交接）、Guardrails（护栏）、编排
    │
第4步：框架对比 ──→ OpenAI Agents SDK / LangGraph / CrewAI / AutoGen
    │
第5步：动手实战 ──→ 基于 OpenAI Agents SDK 实现一个多Agent系统
```

---

## 二、什么是多智能体（Multi-Agent）？

### 2.1 从单Agent到多Agent

在前面的章节中，我们学习了单个Agent如何通过工具调用（Tool Use）和记忆（Memory）来完成任务。但当任务变得**非常复杂**时，单个Agent就会遇到瓶颈：

```
单Agent的困境：

任务："帮我做一份竞品分析报告"

单Agent需要：
  ├── 搜索竞品信息（需要搜索工具）
  ├── 分析数据（需要计算能力）
  ├── 写报告（需要写作能力）
  ├── 生成图表（需要代码能力）
  └── 检查质量（需要审核能力）

问题：
  - 上下文窗口不够用（信息太多塞不下）
  - 注意力被分散（"什么都做"反而做不好）
  - 错误会累积（前面的错误影响后面）
```

### 2.2 多智能体的定义

> **多智能体系统（Multi-Agent System）** = 多个专门的Agent协同工作，各自负责擅长的子任务，共同完成一个复杂目标。

用人话来说：

```
类比一个公司团队：

CEO（协调Agent）：  "我来分配任务，你做市场调研，你做数据分析，你写报告"
  │
  ├── 市场研究员Agent：擅长搜索和整理信息
  ├── 数据分析师Agent：擅长计算和分析
  ├── 报告撰写Agent：  擅长写作和排版
  └── 质量审核Agent：  擅长检查和纠错

每个Agent只做自己擅长的事，整体效率远超一个人硬扛。
```

### 2.3 什么时候需要多智能体？

| 场景               | 用单Agent | 用多Agent |
| ---------------- | :-----: | :-----: |
| 简单问答（"今天天气？"）    |    V    |         |
| 单工具调用（查数据库）      |    V    |         |
| 多步骤任务（搜索+分析+写报告） |         |    V    |
| 需要多种专业能力         |         |    V    |
| 任务可以并行处理         |         |    V    |
| 需要质量审核/纠错循环      |         |    V    |

**Anthropic 的建议**：先用最简单的方案，不要为了"多Agent"而多Agent。

### 2.4 单Agent vs 多Agent 的本质区别

```
单Agent：一个人干所有事
  └── LLM 自己思考 → 自己选工具 → 自己执行 → 自己判断结果

多Agent：专业分工，协同完成
  └── 协调者分配任务 → 各Agent独立执行 → 汇总结果 → 统一输出
```

**OpenAI 对 Agent 的定义**（来自《A Practical Guide to Building Agents》）：

Agent 必须具备三个核心特征：
1. **利用LLM管理工作流执行并做出决策**
2. **能够访问工具并与外部世界交互**
3. **能够自主行动**，在无需人类逐步指导的情况下完成任务

---

## 三、多智能体的设计模式

Anthropic 在 2024年12月发布的 [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) 中，提出了 **6种核心架构模式**。这些模式从简单到复杂排列，可以组合使用。

> **核心原则**：最成功的实现始终没有使用复杂框架，而是使用简单、可组合的模式。

### 3.1 模式总览

```
简单 ◄─────────────────────────────────────────────► 复杂

增强型LLM → 提示链 → 路由 → 并行化 → 编排-工作者 → 评估-优化
(Augmented    (Prompt   (Routing) (Parallel-  (Orchestrator  (Evaluator
 LLM)        Chaining)           ization)    -Workers)      -Optimizer)
```

### 3.2 模式一：增强型 LLM（Augmented LLM）

这是所有模式的**基础构建块**，不是多Agent模式，但所有模式都建立在它之上。

```
┌─────────────────────────────────┐
│           增强型 LLM             │
│                                 │
│  LLM  +  检索  +  工具  +  记忆  │
│                                 │
│  - 能搜索知识库                  │
│  - 能调用外部工具                │
│  - 能记住上下文                  │
└─────────────────────────────────┘
```

这就是我们在前面章节学的：LLM + RAG + Tool Use + Memory。

### 3.3 模式二：提示链（Prompt Chaining）

**思路**：把一个复杂任务拆成一系列**顺序步骤**，每一步的输出作为下一步的输入。

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Step 1  │───→│  Gate    │───→│  Step 2  │───→│  Step 3  │
│ 提取信息  │    │ (检查点)  │    │ 分析数据  │    │ 生成报告  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

Gate = 可选的质量检查点，如果不过就打回重做
```

**适用场景**：
- 任务可以明确拆分为固定步骤
- 每步之间有清晰的输入输出关系

**例子**：写营销文案
```
Step 1: LLM 分析目标受众
  ↓ Gate: 检查输出格式是否正确
Step 2: LLM 根据受众写初稿
  ↓ Gate: 检查是否包含关键卖点
Step 3: LLM 润色和优化语言
  → 最终输出
```

**伪代码**：
```python
def prompt_chaining(user_input):
    # Step 1: 提取信息
    step1_result = llm_call(
        f"从以下内容中提取关键信息：{user_input}"
    )

    # Gate: 检查
    if not is_valid(step1_result):
        step1_result = llm_call(f"请修正：{step1_result}")

    # Step 2: 分析
    step2_result = llm_call(
        f"基于以下信息进行分析：{step1_result}"
    )

    # Step 3: 生成最终结果
    final_result = llm_call(
        f"根据分析生成报告：{step2_result}"
    )

    return final_result
```

### 3.4 模式三：路由（Routing）

**思路**：先对输入**分类**，然后分发给**专门的处理流程**。

```
                    ┌─→ 流程A：技术问题处理
                    │
用户输入 → 路由Agent ─┼─→ 流程B：账单问题处理
                    │
                    └─→ 流程C：投诉处理
```

**适用场景**：
- 输入有明显不同的类别
- 不同类别需要完全不同的处理方式

**例子**：客服系统
```python
def routing_agent(user_message):
    # 路由Agent判断用户问题类型
    category = llm_call(
        f"判断问题类型（技术/账单/投诉）：{user_message}"
    )

    if category == "技术":
        return tech_support_agent(user_message)
    elif category == "账单":
        return billing_agent(user_message)
    elif category == "投诉":
        return complaint_agent(user_message)
```

### 3.5 模式四：并行化（Parallelization）

**思路**：把任务**同时分给多个Agent**并行处理，然后汇总结果。

有两种子模式：

#### a) 分段（Sectioning）：把大任务拆成并行子任务

```
                ┌─→ Agent A：搜索新闻
                │
用户请求 ──→ ──┼─→ Agent B：搜索论文
                │
                └─→ Agent C：搜索社交媒体
                        │
                        ↓
                   汇总Agent：合并结果
```

#### b) 投票（Voting）：同一任务让多个Agent分别做，取最佳结果

```
                ┌─→ Agent A：生成方案1
                │
用户请求 ──→ ──┼─→ Agent B：生成方案2
                │
                └─→ Agent C：生成方案3
                        │
                        ↓
                   评估Agent：选出最佳方案
```

**适用场景**：
- 子任务之间相互独立
- 需要提高速度（并行比串行快）
- 需要提高质量（多视角取最优）

### 3.6 模式五：编排-工作者（Orchestrator-Workers）⭐ 最常用

**思路**：一个**编排者（Orchestrator）** 动态分解任务，分配给多个**工作者（Workers）** 执行。

> 这是多Agent系统中**最核心、最常用**的模式！

```
                    ┌─→ Worker A（搜索专家）
                    │
用户请求 → Orchestrator ─┼─→ Worker B（分析专家）
   (Claude Opus)    │
                    ├─→ Worker C（写作专家）
                    │
                    └─→ Worker D（代码专家）
                            │
                            ↓
                       Orchestrator 汇总 → 输出
```

**与"并行化"的区别**：
- 并行化：子任务是**预先定义**好的
- 编排-工作者：子任务由编排者**动态决定**

**Anthropic 的实际应用**（Claude Research）：
```
用户："帮我研究量子计算的最新进展"

主Agent (Claude Opus) 动态规划：
  ├── 子Agent 1：搜索2025年量子计算论文
  ├── 子Agent 2：搜索主要公司的进展
  ├── 子Agent 3：搜索技术突破新闻
  └── 子Agent 4：搜索投资和商业化动态

主Agent 汇总4路结果 → 生成研究报告
```

> **Anthropic 实测**：多Agent比单一Opus提升 **90.2%**，但token消耗高达 **15倍**。

### 3.7 模式六：评估-优化（Evaluator-Optimizer）

**思路**：一个Agent**生成**结果，另一个Agent**评估**质量，循环优化直到满意。

```
┌──────────┐         ┌──────────┐
│ 生成Agent │────────→│ 评估Agent │
│          │←────────│          │
└──────────┘  反馈    └──────────┘
      │                   ↑
      │    不满意？继续优化  │
      └───────────────────┘
      │
      ↓ 满意？
    输出最终结果
```

**适用场景**：
- 有明确的质量评估标准
- 迭代优化能提升结果质量

**例子**：代码生成
```python
def evaluator_optimizer(task, max_rounds=3):
    result = generator_agent(task)

    for i in range(max_rounds):
        feedback = evaluator_agent(result, task)

        if feedback == "PASS":
            return result

        result = generator_agent(
            f"根据反馈改进：{feedback}\n原结果：{result}"
        )

    return result  # 达到最大轮次
```

### 3.8 模式组合

实际项目中，这些模式经常**组合使用**：

```
客服系统示例：

路由（Routing）
  │
  ├── 技术问题 → 提示链（Prompt Chaining）
  │     Step1: 收集信息 → Step2: 诊断 → Step3: 给方案
  │
  ├── 复杂投诉 → 编排-工作者（Orchestrator-Workers）
  │     Orchestrator 动态分配：
  │       Worker1: 查历史记录
  │       Worker2: 查政策
  │       Worker3: 生成道歉信
  │
  └── 简单问答 → 直接回复（增强型LLM）
```

---

## 四、多Agent的核心机制

### 4.1 Handoff（交接/移交）

> **Handoff** 是多Agent协作的核心机制：一个Agent将任务和控制权**转交**给另一个Agent。

**类比**：接力赛中的传棒

```
Agent A（正在处理任务）
  │
  │  "这个问题需要技术专家处理"
  │
  └── Handoff ──→ Agent B（技术专家，接管任务）

特点：
  - Agent A 停止工作
  - Agent B 接管，获得对话历史
  - Agent B 拥有自己的工具和能力
```

**Handoff vs Tool Call 的区别**：

| 特性   |  Handoff（交接）   | Tool Call（工具调用） |
| ---- | :------------: | :-------------: |
| 控制权  |  完全转移给新Agent   |  调用后仍回到原Agent   |
| 执行方式 | 新Agent接管后续所有工作 |    工具返回结果后继续    |
| 适用场景 |     任务性质改变     |    需要特定能力辅助     |

### 4.2 Agent-as-Tool（Agent即工具）

另一种协作方式：不转移控制权，而是把其他Agent**当作工具**来调用。

```
主Agent
  │
  ├── 调用 Agent A（作为工具） → 返回结果
  │
  ├── 调用 Agent B（作为工具） → 返回结果
  │
  └── 汇总结果，自己继续处理
```

**对比**：

| 特性 | Handoff | Agent-as-Tool |
|------|:-------:|:------------:|
| 控制权 | 转移 | 保留 |
| 并行 | 一次只能交接给一个 | 可以同时调用多个 |
| 上下文 | 共享对话历史 | 独立的上下文 |
| 适用 | 任务完全转交 | 需要多个Agent并行协助 |

### 4.3 Guardrails（护栏/防护）

> **Guardrails** 是对Agent输入和输出的**安全检查**机制。

```
用户输入
  │
  ▼
┌─────────────┐
│ 输入护栏     │ ← 检查输入是否安全/合法
│ (Input Guard)│
└─────────────┘
  │
  │ 通过？ ──→ Agent 执行任务
  │
  │ 拦截！ ──→ 返回错误/安全提示
  │
  ▼
┌─────────────┐
│ 输出护栏     │ ← 检查输出是否安全/合规
│(Output Guard)│
└─────────────┘
  │
  │ 通过？ ──→ 返回结果给用户
  │
  └── 拦截！ ──→ 修改输出或拒绝返回
```

**常见护栏类型**：
- 内容安全检查（过滤有害内容）
- 输入验证（检查格式、范围）
- 幻觉检测（验证事实准确性）
- 敏感信息过滤（防止泄露隐私）

### 4.4 Orchestrator（编排者）的工作方式

```
编排者的核心职责：

1. 理解任务 ──→ "这个任务需要哪些步骤？"
2. 分解任务 ──→ "步骤1给Agent A，步骤2给Agent B..."
3. 分配任务 ──→ 将子任务发送给对应的Worker Agent
4. 收集结果 ──→ 汇总各Worker的输出
5. 判断完成 ──→ "结果够好了吗？还是需要再迭代？"
6. 输出最终结果
```

---

## 五、主流多Agent框架对比

### 5.1 框架一览

| 框架 | 开发者 | 发布时间 | 核心特点 | 学习曲线 | GitHub Stars |
|------|--------|---------|---------|:--------:|:------------:|
| **OpenAI Agents SDK** | OpenAI | 2025.03 | 轻量级，Handoff机制 | 低 | 23k+ |
| **LangGraph** | LangChain | 2024.02 | 有向图，状态机 | 高 | 10k+ |
| **CrewAI** | CrewAI | 2024 | 角色扮演，易上手 | 中 | 31k+ |
| **AutoGen** | Microsoft | 2023.10 | 多Agent对话，代码任务 | 中 | 44k+ |
| **Claude Agent SDK** | Anthropic | 2025 | MCP集成，子Agent | 低 | - |

### 5.2 详细对比

#### OpenAI Agents SDK

```
核心三原语：Agent + Handoff + Guardrail

优点：
  + 最简单的学习曲线（3个核心概念）
  + 原生Handoff机制
  + 支持100+ LLM提供商（包括DeepSeek、Qwen等）
  + 内置Tracing追踪
  + 生产就绪（v0.14+）
  + 代码量最少（最小示例~5行）

缺点：
  - 不适合极复杂的DAG编排
  - 生态不如LangChain丰富
```

#### LangGraph

```
核心概念：有向图 + 状态机

优点：
  + 极致灵活，支持任意编排逻辑
  + 支持循环、条件跳转、并行
  + 原生支持 Human-in-the-loop
  + 背靠LangChain生态

缺点：
  - 学习曲线陡峭（需理解图论）
  - 代码较冗长
  - 需要LangSmith调试
```

#### CrewAI

```
核心概念：角色扮演 + 任务编排

优点：
  + 最直观，非技术用户也能上手
  + 角色定义清晰（Role/Goal/Backstory）
  + 快速搭建演示

缺点：
  - 灵活性有限
  - 复杂任务表现一般
  - 社区支持不足
```

### 5.3 选型建议

```
快速原型 + 生产部署 ──→ OpenAI Agents SDK
极复杂的DAG编排   ──→ LangGraph
角色扮演式协作     ──→ CrewAI
代码任务编排       ──→ AutoGen
```

---

## 六、基于 OpenAI Agents SDK 实现多Agent系统

### 6.1 环境准备

```bash
# 安装
pip install openai-agents

# 设置API Key
export OPENAI_API_KEY="sk-你的key"
```

如果要使用非OpenAI的模型（如DeepSeek），需要额外配置：

```python
from agents import set_default_openai_api
set_default_openai_api("chat_completions")
```

### 6.2 核心概念速查

```
┌────────────────────────────────────────────────┐
│              OpenAI Agents SDK 架构              │
│                                                │
│  用户输入 → Runner → Agent → Tool → 结果输出    │
│                  │            ↑                 │
│                  └── Handoff ─┘                 │
│                  │                              │
│                  └── Guardrail (安全检查)        │
│                  │                              │
│                  └── Tracing (追踪日志)          │
└────────────────────────────────────────────────┘

Runner:  执行引擎，驱动Agent运行
Agent:   智能体实例（指令 + 工具 + 模型）
Handoff: Agent之间的任务交接
Guardrail: 输入/输出安全检查
```

### 6.3 示例1：最简单的单Agent

```python
from agents import Agent, Runner

# 定义一个Agent
agent = Agent(
    name="助手",
    instructions="你是一个有帮助的助手，请用中文回答。"
)

# 运行
result = Runner.run_sync(agent, "什么是量子计算？")
print(result.final_output)
```

> 这是最基础的用法，一个Agent处理所有事情。

### 6.4 示例2：Agent + 工具调用

```python
from agents import Agent, Runner, function_tool

# 定义工具（用装饰器把普通函数变成Agent的工具）
@function_tool
def get_weather(city: str) -> str:
    """获取指定城市的天气信息"""
    weather_data = {
        "北京": "晴天，25°C",
        "上海": "多云，22°C",
        "深圳": "阵雨，28°C",
    }
    return weather_data.get(city, f"{city}的天气数据暂无")

# 定义带工具的Agent
weather_agent = Agent(
    name="天气助手",
    instructions="你是一个天气查询助手。使用工具查询天气后，用友好的语气回答。",
    tools=[get_weather],
)

# 运行
result = Runner.run_sync(weather_agent, "北京今天天气怎么样？")
print(result.final_output)
```

### 6.5 示例3：多Agent + Handoff（核心重点）⭐

这是多Agent系统的经典模式 -- **Triage（分诊）模式**：

```
用户提问
  │
  ▼
分诊Agent（接待员）
  │
  ├── 技术问题？ ──Handoff──→ 技术支持Agent
  │
  └── 账单问题？ ──Handoff──→ 账单服务Agent
```

```python
import asyncio
from agents import Agent, Runner

# ============ 第1步：定义专业的子Agent ============

# 技术支持Agent
tech_support_agent = Agent(
    name="技术支持",
    instructions="""你是一名技术专家。
    专门回答技术问题，如软件bug、安装问题、API使用等。
    回答要专业、准确、有条理。""",
)

# 账单服务Agent
billing_agent = Agent(
    name="账单服务",
    instructions="""你是一名账单客服。
    专门处理账单相关问题，如退款、扣费、发票等。
    回答要耐心、清晰，并在必要时提供操作步骤。""",
)

# ============ 第2步：定义分诊Agent（带Handoff） ============

triage_agent = Agent(
    name="智能客服",
    instructions="""你是一个智能客服接待员。
    根据用户的问题类型，将任务转交给合适的专业Agent：
    - 技术问题（软件bug、安装、API等）→ 转给技术支持
    - 账单问题（退款、扣费、发票等）→ 转给账单服务
    如果问题不明确，先询问用户澄清。""",
    handoffs=[tech_support_agent, billing_agent],
)

# ============ 第3步：运行 ============

async def main():
    # 测试技术问题
    result = await Runner.run(
        triage_agent,
        "我的API调用一直返回403错误，怎么办？"
    )
    print("【技术问题回答】")
    print(result.final_output)
    print(f"\n最终由 [{result.last_agent.name}] 回答")

    print("\n" + "="*50 + "\n")

    # 测试账单问题
    result = await Runner.run(
        triage_agent,
        "我上个月被多扣了50块钱，想申请退款"
    )
    print("【账单问题回答】")
    print(result.final_output)
    print(f"\n最终由 [{result.last_agent.name}] 回答")

asyncio.run(main())
```

**运行流程解析**：

```
1. 用户："我的API调用一直返回403错误"
2. triage_agent 分析 → 判断为"技术问题"
3. triage_agent 调用 Handoff → 把任务交给 tech_support_agent
4. tech_support_agent 接管 → 用自己的专业知识回答
5. 输出最终结果

结果中 result.last_agent.name 会显示"技术支持"
说明任务确实被交给了正确的Agent
```

### 6.6 示例4：多Agent + 工具 + Handoff 完整实战

一个模拟**电商平台客服**的完整示例：

```python
import asyncio
from agents import Agent, Runner, function_tool

# ============ 定义工具 ============

@function_tool
def search_order(order_id: str) -> str:
    """根据订单号查询订单状态"""
    orders = {
        "ORD001": "已发货，预计明天到达",
        "ORD002": "处理中，等待仓库出库",
        "ORD003": "已完成，签收时间2026-05-09",
    }
    return orders.get(order_id, f"未找到订单 {order_id}")

@function_tool
def apply_refund(order_id: str, reason: str) -> str:
    """为用户申请退款"""
    return f"退款申请已提交：订单{order_id}，原因：{reason}。预计3-5个工作日处理。"

@function_tool
def search_product(keyword: str) -> str:
    """搜索商品信息"""
    products = {
        "手机壳": "透明手机壳 ¥29.9，防摔手机壳 ¥49.9",
        "耳机": "蓝牙耳机 ¥199，降噪耳机 ¥399",
        "充电器": "快充充电器 ¥69.9，无线充电器 ¥129",
    }
    return products.get(keyword, f"未找到与'{keyword}'相关的商品")

# ============ 定义专业Agent ============

# 订单Agent（有查询和退款工具）
order_agent = Agent(
    name="订单服务",
    instructions="""你是订单服务专员。
    - 可以帮用户查询订单状态
    - 可以帮用户申请退款
    回答要简洁明了，操作要确认后再执行。""",
    tools=[search_order, apply_refund],
)

# 商品Agent（有搜索工具）
product_agent = Agent(
    name="商品咨询",
    instructions="""你是商品咨询顾问。
    - 帮用户搜索和推荐商品
    - 回答商品相关问题
    回答要热情友好，适当推荐。""",
    tools=[search_product],
)

# 售后Agent（处理投诉和建议）
after_sales_agent = Agent(
    name="售后服务",
    instructions="""你是售后客服。
    专门处理用户的投诉、建议和售后问题。
    态度要诚恳，先安抚情绪，再解决问题。
    如果需要退款，建议用户转到订单服务。""",
)

# ============ 定义分诊Agent ============

customer_service = Agent(
    name="智能客服",
    instructions="""你是电商平台的智能客服接待员。
    根据用户需求转接到对应的服务专员：

    - 订单查询、退款 → 转给"订单服务"
    - 商品搜索、推荐 → 转给"商品咨询"
    - 投诉、售后问题 → 转给"售后服务"

    简单的问候和确认由你直接回答。""",
    handoffs=[order_agent, product_agent, after_sales_agent],
)

# ============ 运行测试 ============

async def main():
    test_cases = [
        "帮我查一下订单ORD001的物流状态",
        "你们有什么手机壳推荐吗？",
        "我要投诉！快递太慢了，而且包装破损！",
    ]

    for question in test_cases:
        print(f"用户：{question}")
        result = await Runner.run(customer_service, question)
        print(f"[{result.last_agent.name}]: {result.final_output}")
        print("-" * 50)

asyncio.run(main())
```

**预期输出**：

```
用户：帮我查一下订单ORD001的物流状态
[订单服务]: 您的订单ORD001已发货，预计明天到达。还有什么可以帮您的吗？
--------------------------------------------------
用户：你们有什么手机壳推荐吗？
[商品咨询]: 我们有以下手机壳可选：透明手机壳 ¥29.9，防摔手机壳 ¥49.9。您更倾向哪种呢？
--------------------------------------------------
用户：我要投诉！快递太慢了，而且包装破损！
[售后服务]: 非常抱歉给您带来了不好的体验！我已经记录了您的问题...
--------------------------------------------------
```

### 6.7 示例5：Agent-as-Tool 模式

除了Handoff，还可以把Agent当作工具来调用（**不转移控制权**）：

```python
import asyncio
from agents import Agent, Runner

# 定义专家Agent
translator_agent = Agent(
    name="翻译专家",
    instructions="你是一个翻译专家，将用户输入翻译成英文。",
)

summarizer_agent = Agent(
    name="摘要专家",
    instructions="你是一个摘要专家，将长文本压缩为3句话以内的摘要。",
)

# 主Agent把上面两个Agent当作工具使用
# 注意：需要手动将Agent转为工具
main_agent = Agent(
    name="内容助手",
    instructions="""你是内容处理助手。你有两个工具：
    - translator: 用于翻译文本
    - summarizer: 用于生成摘要
    根据用户需求调用合适的工具。""",
    tools=[
        translator_agent.as_tool(
            tool_name="translator",
            tool_description="将文本翻译成英文",
        ),
        summarizer_agent.as_tool(
            tool_name="summarizer",
            tool_description="生成文本摘要",
        ),
    ],
)

async def main():
    result = await Runner.run(
        main_agent,
        "请帮我把这段话翻译成英文：人工智能正在改变世界。"
    )
    print(result.final_output)

asyncio.run(main())
```

> **注意**：`as_tool()` 是将Agent转为工具的方法，主Agent调用后**保留控制权**。

### 6.8 Handoff vs Agent-as-Tool 对比代码

```python
# ============ Handoff方式 ============
# 分诊Agent把任务完全交给子Agent
triage = Agent(
    name="分诊",
    handoffs=[tech_agent, billing_agent],  # 控制权转移
)

# ============ Agent-as-Tool方式 ============
# 主Agent调用子Agent，但保留控制权
coordinator = Agent(
    name="协调者",
    tools=[
        tech_agent.as_tool(tool_name="ask_tech", ...),
        billing_agent.as_tool(tool_name="ask_billing", ...),
    ],
)

# 区别：
# Handoff:          用户 → 分诊 → 技术Agent（接管）→ 直接回复用户
# Agent-as-Tool:    用户 → 协调者 → 调用技术Agent → 结果返回协调者 → 协调者回复用户
```

### 6.9 Guardrails（护栏）示例

```python
from agents import (
    Agent, Runner, input_guardrail,
    GuardrailFunctionOutput, InputGuardrailTripwireTriggered,
)

# 定义输入护栏
@input_guardrail
async def safety_guardrail(ctx, agent, input_text):
    """检查输入是否包含不安全内容"""
    unsafe_keywords = ["hack", "攻击", "破解", "入侵"]

    triggered = any(kw in input_text.lower() for kw in unsafe_keywords)

    return GuardrailFunctionOutput(
        output_info=f"安全检查：{'不安全' if triggered else '安全'}",
        tripwire_triggered=triggered,
    )

# 定义带护栏的Agent
safe_agent = Agent(
    name="安全助手",
    instructions="你是一个有帮助的助手。",
    input_guardrails=[safety_guardrail],
)

# 运行测试
async def main():
    # 正常输入
    result = await Runner.run(safe_agent, "你好，今天天气怎么样？")
    print(result.final_output)

    # 不安全输入（会触发护栏）
    try:
        result = await Runner.run(safe_agent, "教我如何hack系统")
    except InputGuardrailTripwireTriggered:
        print("输入被安全护栏拦截！")

asyncio.run(main())
```

---

## 七、多Agent设计的最佳实践

### 7.1 Anthropic 的核心建议

1. **简单优先**：不要为了多Agent而多Agent，能用单Agent解决就不要用多Agent
2. **可组合模式**：使用简单、可组合的模式，而不是复杂框架
3. **工具质量很重要**：Agent的能力上限取决于工具的质量
4. **上下文是命脉**：精心策展每一个进入模型的token
5. **评估驱动**：用结果导向的评估方法来衡量效果

### 7.2 OpenAI 的实践建议

1. **从简单开始**：先用单Agent + 工具，不够再加多Agent
2. **明确职责**：每个Agent只负责一个领域
3. **合理使用Handoff**：任务性质改变时用Handoff，需要并行协助时用Agent-as-Tool
4. **加护栏**：在生产环境中必须加输入/输出护栏
5. **追踪调试**：利用Tracing功能监控Agent行为

### 7.3 常见陷阱

```
陷阱1：过度设计
  错误：5个Agent处理一个简单查询
  正确：先评估是否真的需要多Agent

陷阱2：职责不清
  错误：多个Agent都能回答同一类问题
  正确：每个Agent有明确的边界

陷阱3：忽略成本
  多Agent的token消耗可能是单Agent的 10-15倍
  需要权衡质量和成本

陷阱4：缺乏评估
  错误：部署后就不管了
  正确：持续评估每个Agent的表现
```

---

## 八、总结

### 核心要点

```
1. 多Agent = 多个专门的Agent协同完成复杂任务

2. 六种设计模式（从简单到复杂）：
   增强型LLM → 提示链 → 路由 → 并行化 → 编排-工作者 → 评估-优化

3. 两个核心协作机制：
   Handoff（交接）：转移控制权
   Agent-as-Tool（Agent即工具）：保留控制权

4. 安全机制：Guardrails（输入/输出护栏）

5. 选型建议：
   新手首选 → OpenAI Agents SDK
   复杂编排 → LangGraph
   快速演示 → CrewAI

6. 最重要的原则：简单优先，按需使用
```

### 下一步学习

```
学完多Agent后，建议继续学习：
  - Agent Memory（长期记忆系统）
  - Agent评估与监控
  - MCP协议（Model Context Protocol）
  - 生产环境部署与运维
```

---

## 九、参考资料

### 官方资料（优先参考）

| 来源 | 标题 | 链接 |
|------|------|------|
| Anthropic | Building Effective Agents | [anthropic.com/engineering/building-effective-agents](https://www.anthropic.com/engineering/building-effective-agents) |
| Anthropic | How We Built Our Multi-Agent Research System | [anthropic.com](https://www.anthropic.com/engineering/how-we-built-our-multi-agent-research-system) |
| OpenAI | A Practical Guide to Building Agents | [openai.com](https://openai.com/index/new-tools-for-building-agents/) |
| OpenAI | Agents SDK GitHub | [github.com/openai/openai-agents-python](https://github.com/openai/openai-agents-python) |
