---
title: Agent Router（智能体路由）完全指南
date: 2026-05-16
categories:
  - Agent
tags: ["AI", "LLM", "Agent", "Router", "路由", "多智能体", "SemanticRouter", "学习笔记"]
summary: "Agent Router（智能体路由）机制详解，介绍如何根据用户意图将请求路由到最合适的Agent或工具。"
---

# Agent Router（智能体路由）完全指南

## 一、学习路线图

```
第1步：理解概念 ──→ 什么是路由？为什么需要它？
    │
第2步：三大层次 ──→ Agent 路由 / 模型路由 / 工具路由
    │
第3步：路由策略 ──→ 规则匹配 / 语义路由 / LLM 路由 / 混合路由
    │
第4步：代码实战 ──→ 用 OpenAI SDK 实现路由模式
    │
第5步：进阶应用 ──→ 模型选择优化 + 生产级路由架构
```

---

## 二、什么是 Agent Router？

### 2.1 一句话理解

> **Agent Router（智能体路由）** = 根据用户输入的**内容和意图**，自动将其分发给**最合适**的处理流程（Agent、模型或工具）。

### 2.2 生活化类比

```
想象你走进一家大型医院的前台：

你："我肚子疼"

前台接待员（Router）判断：
  ├── 内科疾病？ ──→ 导诊到 内科
  ├── 外科急症？ ──→ 导诊到 外科
  ├── 心理问题？ ──→ 导诊到 心理科
  └── 不确定？   ──→ 先做基础检查（通用处理）

接待员自己不看病，但她知道该把你送去哪。
这就是"路由"的核心思想。
```

### 2.3 正式定义

**路由（Routing）** 是 Anthropic 在 [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) 中提出的 **六大核心架构模式之一**，位于"提示链"之后，属于中等复杂度的模式。

```
Anthropic 六大模式（从简单到复杂）：

增强型LLM → 提示链 → ★ 路由 ★ → 并行化 → 编排-工作者 → 评估-优化
                               ↑
                           你在这里
```

> 详见 13.Multi-Agent 中的模式总览。

---

## 三、为什么需要路由？

### 3.1 没有路由的问题

```
❌ 没有路由的系统：

用户输入 → 一个"万能"Agent 处理所有事情 → 输出

问题：
  1. 上下文臃肿：Agent 的指令里塞满了所有场景的规则
  2. 效果折中：什么都能做 = 什么都做不好（"万金油"困境）
  3. 成本浪费：简单问题也用最贵的模型
  4. 响应慢：所有请求都走同一条长流程
```

### 3.2 有路由的好处

```
✅ 有路由的系统：

用户输入 → Router（快速判断）→ 专门的处理流程 → 输出

好处：
  1. 专业分工：每个处理流程只关注自己的领域
  2. 质量提升：专门的 Agent 在自己领域更准确
  3. 成本优化：简单问题走轻量流程，复杂问题走重量流程
  4. 响应快：简单问题可以快速返回
```

### 3.3 什么时候需要路由？

| 场景 | 需要路由？ | 原因 |
|------|:---------:|------|
| 用户输入有明显不同的类别（技术/账单/投诉） | ✅ | 不同类别需要完全不同的处理方式 |
| 需要在成本和质量之间平衡 | ✅ | 简单问题用便宜模型，难题用强模型 |
| 单一处理流程已经足够 | ❌ | 过度设计反而增加复杂度 |
| 输入类别不明确、高度混杂 | ⚠️ | 路由准确率会下降，需谨慎 |

---

## 四、路由的三大层次

Agent 系统中，"路由"可以在三个不同层次上发生：

```
┌───────────────────────────────────────────────────┐
│               Agent Router 的三个层次               │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  层次1：Agent 路由（最高层）                    │  │
│  │  把任务分发给不同的 Agent                      │  │
│  │  例：技术问题 → 技术Agent，账单 → 账单Agent     │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  层次2：模型路由（中间层）                      │  │
│  │  选择使用哪个 LLM 来处理                       │  │
│  │  例：简单问题 → GPT-4o-mini，难题 → GPT-4o    │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  层次3：工具路由（最底层）                      │  │
│  │  选择调用哪个工具/API                          │  │
│  │  例：查天气 → 天气API，查股价 → 股票API         │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### 4.1 层次1：Agent 路由（任务分发）

这是13.Multi-Agent中提到的 **Routing 模式**，也是最常用的路由形式。

```
用户消息
    │
    ▼
┌──────────┐
│ Router    │ ← LLM 分析用户意图
│ Agent     │
└────┬─────┘
     │
     ├─→ 订单相关 ──→ 订单 Agent（有查询/退款工具）
     │
     ├─→ 商品相关 ──→ 商品 Agent（有搜索/推荐工具）
     │
     ├─→ 投诉相关 ──→ 售后 Agent（安抚/处理流程）
     │
     └─→ 简单问候 ──→ 直接回复（不浪费 Agent 资源）
```

**核心特点**：路由 Agent 本身**不做具体工作**，只负责"判断意图 → 转发"。

### 4.2 层次2：模型路由（成本优化）

根据任务难度，选择不同的 LLM 模型：

```
用户查询
    │
    ▼
┌──────────┐
│ 难度评估  │ ← 快速判断问题复杂度
└────┬─────┘
     │
     ├─→ 简单（翻译、摘要、格式化）
     │     └──→ GPT-4o-mini / Claude Haiku  ← 便宜、快
     │
     ├─→ 中等（问答、分析、写作）
     │     └──→ GPT-4o / Claude Sonnet      ← 平衡性价比
     │
     └─→ 困难（推理、编程、数学）
           └──→ Claude Opus / GPT-4o        ← 最强、最贵
```

**收益数据**（RouteLLM 项目实测）：

| 指标 | 效果 |
|------|------|
| 成本节省 | **~50%** |
| 质量损失 | **<2%** |
| 原理 | 80% 的查询是简单问题，只有 20% 需要强模型 |

> 这就是著名的 **80/20 法则** 在 LLM 应用中的体现。

### 4.3 层次3：工具路由（能力选择）

Agent 拥有多个工具时，10.Function Calling 机制本身就是一种隐式路由：

```
Agent 收到用户请求
    │
    ▼
LLM 分析意图 → 选择合适的工具（Function Calling）
    │
    ├─→ "查天气" → 调用 get_weather()
    ├─→ "发邮件" → 调用 send_email()
    ├─→ "查订单" → 调用 search_order()
    └─→ "搜新闻" → 调用 search_news()
```

> 详见 11.tool 和 10.Function Calling。

---

## 五、四种路由策略

### 5.1 策略总览

```
┌──────────────────────────────────────────────────────┐
│                  四种路由策略                           │
│                                                      │
│  ┌────────────┐  ┌────────────┐                      │
│  │  规则匹配   │  │  LLM 路由  │                      │
│  │ (最快最简单) │  │ (最智能)    │                      │
│  └────────────┘  └────────────┘                      │
│                                                      │
│  ┌────────────┐  ┌────────────┐                      │
│  │  语义路由   │  │  混合路由   │                      │
│  │ (速度+理解) │  │ (生产推荐)  │                      │
│  └────────────┘  └────────────┘                      │
│                                                      │
│  速度：规则 > 语义 > 混合 > LLM                        │
│  智能：LLM > 混合 > 语义 > 规则                        │
└──────────────────────────────────────────────────────┘
```

### 5.2 策略一：规则匹配（Rule-Based）

最简单直接的方式，用关键词或正则表达式匹配。

```python
def rule_based_router(user_input: str) -> str:
    """基于关键词的路由"""
    text = user_input.lower()

    if any(kw in text for kw in ["订单", "物流", "发货", "退款"]):
        return "订单服务"
    elif any(kw in text for kw in ["推荐", "价格", "商品", "购买"]):
        return "商品咨询"
    elif any(kw in text for kw in ["投诉", "不满", "差评", "垃圾"]):
        return "售后服务"
    else:
        return "通用助手"
```

| 优点 | 缺点 |
|------|------|
| ✅ 速度极快（微秒级） | ❌ 无法理解同义词和语义 |
| ✅ 不消耗 Token | ❌ 规则越多越难维护 |
| ✅ 结果确定、可预测 | ❌ 无法处理模糊表达 |

**适用场景**：意图明确、分类固定、对延迟极敏感的场景。

### 5.3 策略二：LLM 路由（最智能）

用 LLM 来理解用户意图并决定路由。

```python
def llm_router(user_input: str) -> str:
    """用 LLM 进行路由分类"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",  # 用小模型做路由（省钱快速）
        messages=[
            {"role": "system", "content": """你是一个意图分类器。
                根据用户输入，判断它属于以下哪个类别：
                - 订单服务（查询订单、物流、退款）
                - 商品咨询（搜索商品、价格、推荐）
                - 售后服务（投诉、建议、退换货）
                - 通用助手（闲聊、问候、其他）

                只输出类别名称，不要输出其他内容。"""},
            {"role": "user", "content": user_input}
        ],
        temperature=0,       # 保证确定性
        max_tokens=20        # 分类不需要长输出
    )
    return response.choices[0].message.content.strip()
```

| 优点 | 缺点 |
|------|------|
| ✅ 能理解复杂语义 | ❌ 有延迟（需调用 API） |
| ✅ 能处理模糊表达 | ❌ 消耗 Token（有成本） |
| ✅ 容易扩展新类别 | ❌ 可能"幻觉"出错误分类 |

**适用场景**：意图多样、表达方式复杂、准确率优先的场景。

### 5.4 策略三：语义路由（Semantic Router）⭐ 速度与理解的平衡

> **语义路由** = 用**向量嵌入（Embedding）** 来匹配用户输入与预定义的"路由样本"，找到最相似的路由。

这是2024-2025年最流行的路由方式，代表项目是 [Aurelio AI 的 Semantic Router](https://github.com/aurelio-labs/semantic-router)。

#### 工作原理

```
预先准备（一次性）：
  路由"订单服务"的样本句：
    "我想查一下订单状态"
    "我的快递到哪了"
    "申请退款"
    → 编码成向量 [0.12, -0.34, 0.56, ...]

  路由"商品咨询"的样本句：
    "有什么手机壳推荐"
    "这个耳机多少钱"
    "比较一下两款产品"
    → 编码成向量 [0.23, 0.45, -0.12, ...]

运行时（每次请求）：
  用户："帮我看看包裹到哪了"
    → 编码成向量 [0.15, -0.31, 0.52, ...]
    → 计算与各路由的余弦相似度
    → 最高匹配："订单服务"（相似度 0.95）
    → 路由到订单服务
```

#### 代码实现

```python
"""
语义路由示例
安装：pip install semantic-router
"""
from semantic_router import Route, RouteLayer
from semantic_router.encoders import OpenAIEncoder

# ===== 第1步：定义路由和样本句 =====

order_route = Route(
    name="订单服务",
    utterances=[
        "我想查一下订单状态",
        "我的快递到哪了",
        "帮我查物流信息",
        "申请退款",
        "订单号是什么",
        "包裹什么时候到",
        "我要退货",
    ],
)

product_route = Route(
    name="商品咨询",
    utterances=[
        "有什么手机壳推荐",
        "这个耳机多少钱",
        "比较一下两款产品",
        "有什么新品",
        "推荐一款笔记本",
        "哪个品牌的质量好",
    ],
)

complaint_route = Route(
    name="售后服务",
    utterances=[
        "我要投诉",
        "质量太差了",
        "包装破损",
        "和描述不符",
        "服务态度不好",
        "收到的是坏的",
    ],
)

# ===== 第2步：创建路由层 =====

encoder = OpenAIEncoder()  # 使用 OpenAI 的 Embedding 模型
route_layer = RouteLayer(
    encoder=encoder,
    routes=[order_route, product_route, complaint_route],
)

# ===== 第3步：运行路由 =====

# 测试
result = route_layer("帮我看看包裹到哪了")
print(result.name)  # 输出：订单服务

result = route_layer("推荐一款好用的耳机")
print(result.name)  # 输出：商品咨询

result = route_layer("你们的东西质量太差了")
print(result.name)  # 输出：售后服务
```

#### 对比三种策略

```
                    规则匹配          语义路由           LLM 路由
速度：              < 1ms            10-50ms           200-2000ms
成本：              免费             Embedding费用      LLM Token费用
准确率：            中（匹配到才有效）  高                最高
扩展性：            差（要写规则）     好（加样本句即可）   好（改提示词）
理解模糊表达：       ❌               ✅                ✅
需要预定义路由：     需要规则          需要样本句          需要描述
```

### 5.5 策略四：混合路由（Hybrid）⭐ 生产推荐

实际生产中，通常组合多种策略：

```
用户输入
    │
    ▼
┌──────────────┐
│  第1层：规则   │ ← 先用关键词快速匹配明确场景
│  （< 1ms）    │
└──────┬───────┘
       │ 匹配不到？
       ▼
┌──────────────┐
│  第2层：语义   │ ← 用 Embedding 计算相似度
│  （10-50ms）  │
└──────┬───────┘
       │ 置信度低？（< 0.7）
       ▼
┌──────────────┐
│  第3层：LLM   │ ← 最后用 LLM 深度理解
│  （200ms+）   │
└──────┬───────┘
       │
       ▼
    最终路由结果
```

```python
def hybrid_router(user_input: str) -> str:
    """混合路由：规则 → 语义 → LLM，逐层升级"""

    # 第1层：规则匹配（最快）
    rule_result = rule_based_match(user_input)
    if rule_result:
        return rule_result

    # 第2层：语义路由（较快）
    semantic_result, confidence = semantic_match(user_input)
    if confidence > 0.7:  # 置信度阈值
        return semantic_result

    # 第3层：LLM 路由（最准）
    return llm_classify(user_input)
```

---

## 六、用 OpenAI Agents SDK 实现路由

### 6.1 Handoff 路由（推荐方式）

OpenAI Agents SDK 的 `Handoff` 机制天然支持路由模式，这在 13.Multi-Agent 中已有介绍。

```python
"""
Agent Router - 基于 OpenAI Agents SDK
用 Handoff 实现路由模式
"""
import asyncio
from agents import Agent, Runner

# ===== 定义各个专业 Agent =====

tech_agent = Agent(
    name="技术支持",
    instructions="""你是技术支持工程师。
    专门回答技术问题：软件bug、API使用、安装部署等。
    回答要专业、有条理，必要时给出代码示例。""",
)

finance_agent = Agent(
    name="财务咨询",
    instructions="""你是财务咨询顾问。
    专门回答财务问题：报销流程、发票处理、预算申请等。
    回答要准确、清晰，并在必要时提供操作步骤。""",
)

general_agent = Agent(
    name="通用助手",
    instructions="""你是通用助手。
    处理日常问题：日程安排、会议室预订、公司政策等。
    回答要友好、简洁。""",
)

# ===== 定义 Router Agent =====

router_agent = Agent(
    name="智能前台",
    instructions="""你是公司的智能前台接待员。
    你的唯一职责是判断用户问题的类型，然后转交给合适的专家。

    分类规则：
    - 技术问题（bug、代码、API、部署、服务器）→ 转给"技术支持"
    - 财务问题（报销、发票、预算、费用）→ 转给"财务咨询"
    - 其他日常问题（日程、会议室、政策、问候）→ 转给"通用助手"

    注意：你不需要回答问题本身，只需要判断类型并转交。""",
    handoffs=[tech_agent, finance_agent, general_agent],
)

# ===== 运行测试 =====

async def main():
    test_queries = [
        "我的API调用返回500错误，日志显示数据库连接超时",
        "上个月的出差报销还没到账，单号是BX20260501",
        "帮我订明天下午2点的会议室",
    ]

    for query in test_queries:
        result = await Runner.run(router_agent, query)
        print(f"用户：{query}")
        print(f"路由到：[{result.last_agent.name}]")
        print(f"回答：{result.final_output}")
        print("-" * 50)

asyncio.run(main())
```

**运行结果**：

```
用户：我的API调用返回500错误，日志显示数据库连接超时
路由到：[技术支持]
回答：数据库连接超时通常有几个原因：1. 数据库服务未启动...
--------------------------------------------------
用户：上个月的出差报销还没到账，单号是BX20260501
路由到：[财务咨询]
回答：我来帮您查询报销进度，单号BX20260501...
--------------------------------------------------
用户：帮我订明天下午2点的会议室
路由到：[通用助手]
回答：好的，我帮您预订明天下午2点的会议室...
--------------------------------------------------
```

### 6.2 带工具的路由 Agent（完整实战）

真实场景中，每个专业 Agent 通常有不同的工具：

```python
"""
完整的路由系统：Router + 专业Agent + 各自的工具
"""
import asyncio
from agents import Agent, Runner, function_tool

# ===== 工具定义 =====

@function_tool
def search_faq(question: str) -> str:
    """搜索常见问题知识库"""
    faqs = {
        "密码重置": "访问 settings.example.com/reset 进行密码重置",
        "VPN连接": "下载 VPN 客户端，使用工号+密码登录",
        "邮箱配置": "IMAP: mail.example.com:993, SMTP: mail.example.com:465",
    }
    for key, answer in faqs.items():
        if key in question:
            return answer
    return "未找到相关FAQ，请联系对应部门"

@function_tool
def create_ticket(title: str, description: str, priority: str) -> str:
    """创建工单"""
    return f"工单已创建：标题={title}，优先级={priority}，工单号:TK20260516001"

@function_tool
def search_expense(employee_id: str, month: str) -> str:
    """查询报销记录"""
    return f"员工{employee_id}在{month}月有3笔报销，合计¥4,580，状态：审批中"

@function_tool
def book_room(date: str, time: str, room_type: str) -> str:
    """预订会议室"""
    return f"已预订{date} {time}的{room_type}会议室，确认码:MT20260516"

# ===== 专业 Agent（各有各的工具） =====

it_agent = Agent(
    name="IT 支持",
    instructions="你是 IT 支持工程师，帮员工解决技术问题。先查FAQ，解决不了就创建工单。",
    tools=[search_faq, create_ticket],
)

hr_agent = Agent(
    name="HR 服务",
    instructions="你是 HR 服务专员，帮员工处理报销、假期、考勤等事务。",
    tools=[search_expense],
)

admin_agent = Agent(
    name="行政服务",
    instructions="你是行政服务专员，帮员工预订会议室、申请办公用品等。",
    tools=[book_room],
)

# ===== Router Agent =====

router = Agent(
    name="公司前台",
    instructions="""你是公司智能前台。根据员工需求转接到对应服务：
    - IT/技术问题（电脑、网络、软件、VPN、邮箱）→ IT支持
    - 人事/财务（报销、假期、考勤、工资）→ HR服务
    - 行政事务（会议室、办公用品、快递）→ 行政服务
    简单问候由你直接回答。""",
    handoffs=[it_agent, hr_agent, admin_agent],
)

# ===== 运行 =====

async def main():
    queries = [
        "我VPN连不上了，密码刚重置过",
        "上个月报销还没到账，帮我查一下",
        "明天下午3点有没有大会议室？",
    ]

    for q in queries:
        result = await Runner.run(router, q)
        print(f"🧑 员工：{q}")
        print(f"📋 路由到：[{result.last_agent.name}]")
        print(f"💬 回复：{result.final_output}\n")

asyncio.run(main())
```

### 6.3 LangGraph 路由实现

LangGraph 使用**条件边（Conditional Edge）** 实现路由，适合更复杂的场景：

```python
"""
LangGraph 路由示例
安装：pip install langgraph langchain-openai
"""
from typing import Literal
from langgraph.graph import StateGraph, MessagesState
from langchain_openai import ChatOpenAI

# 定义模型
model = ChatOpenAI(model="gpt-4o-mini")

# ===== 路由函数 =====

def router(state: MessagesState) -> Literal["tech", "finance", "general"]:
    """根据最后一条消息决定路由"""
    last_message = state["messages"][-1].content

    classification = model.invoke([
        {"role": "system", "content": """分类用户问题，只输出一个词：
        tech - 技术问题
        finance - 财务问题
        general - 一般问题"""},
        {"role": "user", "content": last_message}
    ])

    category = classification.content.strip().lower()
    if category in ["tech", "finance", "general"]:
        return category
    return "general"

# ===== 各节点处理函数 =====

def tech_node(state: MessagesState):
    response = model.invoke([
        {"role": "system", "content": "你是技术支持工程师"},
        *state["messages"]
    ])
    return {"messages": [response]}

def finance_node(state: MessagesState):
    response = model.invoke([
        {"role": "system", "content": "你是财务顾问"},
        *state["messages"]
    ])
    return {"messages": [response]}

def general_node(state: MessagesState):
    response = model.invoke([
        {"role": "system", "content": "你是通用助手"},
        *state["messages"]
    ])
    return {"messages": [response]}

# ===== 构建图 =====

graph = StateGraph(MessagesState)

# 添加节点
graph.add_node("tech", tech_node)
graph.add_node("finance", finance_node)
graph.add_node("general", general_node)

# 设置入口和路由条件
graph.set_conditional_entry_point(
    router,
    {
        "tech": "tech",
        "finance": "finance",
        "general": "general",
    }
)

# 各节点都是终点
graph.add_edge("tech", "__end__")
graph.add_edge("finance", "__end__")
graph.add_edge("general", "__end__")

# 编译运行
app = graph.compile()
result = app.invoke({"messages": [("user", "我的API返回500错误")]})
```

**LangGraph 路由的架构图**：

```
                   ┌─────────────────┐
                   │   用户输入       │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  条件路由函数     │ ← LLM 判断类别
                   │  (router)       │
                   └───┬────┬────┬──┘
                       │    │    │
              "tech"   │    │    │  "finance"
                       ▼    │    ▼
               ┌──────┐    │   ┌──────┐
               │ tech  │   │   │finance│
               │ node  │   │   │ node  │
               └──┬───┘    │   └──┬───┘
                  │        │      │
                  │    "general"  │
                  │        ▼      │
                  │   ┌────────┐  │
                  │   │general │  │
                  │   │ node   │  │
                  │   └──┬─────┘  │
                  │      │        │
                  ▼      ▼        ▼
              ┌──────────────────────┐
              │       输出结果        │
              └──────────────────────┘
```

---

## 七、模型路由：省 50% 成本的秘密

### 7.1 核心思想

> **80% 的用户查询是简单的，只有 20% 需要最强的模型。**

```
查询分布：
  简单查询（80%）：翻译一句话、格式化数据、简单问答
    → 用 GPT-4o-mini（$0.15/1M tokens）就够了

  中等查询（15%）：分析数据、写文章、代码review
    → 用 GPT-4o（$2.5/1M tokens）

  困难查询（5%）：数学推理、复杂编程、学术研究
    → 用 Claude Opus / o1（$15/1M tokens）

如果全部用最强模型：成本 = 100%
如果用路由分流：    成本 ≈ 30-50%（节省 50-70%）
```

### 7.2 RouteLLM 简介

[RouteLLM](https://github.com/lm-sys/RouteLLM) 是 LMSYS（Chatbot Arena 团队）开源的模型路由框架。

```
RouteLLM 的核心思路：

  1. 在 Chatbot Arena（真人投票平台）上积累了大量 A/B 偏好数据
  2. 训练一个轻量级路由器分类器
  3. 路由器判断："这个问题，弱模型能答好吗？"
     ├── 能答好 → 路由到便宜模型（GPT-4o-mini）
     └── 答不好 → 路由到强模型（GPT-4o）

  实测结果：
    - 成本减少 ~50%
    - 质量损失 <2%（几乎无感知）
```

### 7.3 代码实现：简单的模型路由器

```python
"""
简单模型路由器 - 根据查询复杂度选择模型
"""
import openai

client = openai.OpenAI()

# 模型配置（从便宜到贵）
MODELS = {
    "simple": "gpt-4o-mini",    # $0.15/1M tokens
    "medium": "gpt-4o",         # $2.5/1M tokens
    "hard":   "gpt-4o",         # $2.5/1M tokens（用更复杂的提示词）
}

def classify_difficulty(query: str) -> str:
    """用最小的模型判断查询难度"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",  # 路由器本身用最便宜的模型
        messages=[
            {"role": "system", "content": """判断用户查询的难度级别：
- simple：简单翻译、格式转换、简单问答、问候
- medium：文本分析、内容创作、代码解释、数据整理
- hard：数学推理、复杂编程、多步骤逻辑推理、学术分析

只输出一个词：simple、medium 或 hard"""},
            {"role": "user", "content": query}
        ],
        temperature=0,
        max_tokens=10
    )
    return response.choices[0].message.content.strip().lower()

def smart_route(query: str) -> str:
    """智能路由：判断难度 → 选择模型 → 生成回答"""
    # 第1步：判断难度
    difficulty = classify_difficulty(query)
    model = MODELS.get(difficulty, MODELS["medium"])

    print(f"📊 难度：{difficulty} → 模型：{model}")

    # 第2步：用选定的模型回答
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": query}],
    )
    return response.choices[0].message.content

# 测试
print(smart_route("把'你好世界'翻译成英文"))      # simple → gpt-4o-mini
print(smart_route("用Python实现快速排序并解释原理"))  # hard → gpt-4o
```

---

## 八、进阶：生产级路由架构

### 8.1 完整的路由系统架构

```
                        用户请求
                           │
                           ▼
                ┌──────────────────────┐
                │    1. 安全护栏        │ ← 过滤恶意/非法输入
                │    (Input Guardrail)  │    详见 13.Multi-Agent
                └──────────┬───────────┘
                           │ 安全通过
                           ▼
                ┌──────────────────────┐
                │    2. 缓存检查        │ ← 相同问题直接返回缓存
                │    (Cache Layer)      │
                └──────────┬───────────┘
                           │ 未命中
                           ▼
                ┌──────────────────────┐
                │    3. 意图路由        │ ← 判断用户意图分类
                │    (Intent Router)    │
                └───┬──────┬──────┬───┘
                    │      │      │
        ┌───────────┤      │      ├───────────┐
        ▼           ▼      ▼      ▼           ▼
   ┌─────────┐┌─────────┐│┌─────────┐┌─────────┐
   │ 技术Agent││财务Agent │││ 行政Agent││ 通用Agent │
   │ +专用工具││+专用工具  │││+专用工具 ││ +基础工具 │
   └────┬────┘└────┬────┘│└────┬────┘└────┬────┘
        │          │     │     │          │
        └──────────┴─────┼─────┴──────────┘
                         ▼
              ┌──────────────────────┐
              │    4. 输出护栏        │ ← 检查输出质量
              │    (Output Guardrail) │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │    5. 响应返回用户     │
              └──────────────────────┘
```

### 8.2 路由的度量与监控

生产环境中，路由系统需要监控以下指标：

```
路由系统关键指标：

┌──────────────────┬────────────────────────────────────┐
│ 指标              │ 说明                                │
├──────────────────┼────────────────────────────────────┤
│ 路由准确率         │ 正确分类的比例（目标 > 95%）          │
│ 路由延迟           │ 路由判断的耗时（目标 < 100ms）        │
│ 各路由流量分布      │ 是否有某个路由过载或闲置               │
│ 路由降级率         │ 无法分类时降级到通用路由的比例          │
│ 端到端满意度       │ 最终回答的用户满意度                   │
└──────────────────┴────────────────────────────────────┘
```

### 8.3 动态路由 vs 静态路由

| 特性 | 静态路由 | 动态路由 |
|------|---------|---------|
| 路由规则 | 预先定义，固定不变 | 可根据运行时数据动态调整 |
| 新增路由 | 需要重新部署 | 可在线添加新路由和样本 |
| 适用场景 | 路由类别固定、变化少 | 业务频繁变化、需要快速迭代 |
| 复杂度 | 低 | 中高 |

---

## 九、最佳实践

### 9.1 Anthropic 的建议

> 来自 [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)

1. **LLM 可以很好地处理路由分类**，尤其是当你有清晰的分类标准时
2. **路由 + 其他模式组合使用**，效果更好（如：路由 → 提示链 → 编排-工作者）
3. **简单优先**：能用规则解决就不用语义路由，能用语义路由就不用 LLM

### 9.2 实用建议清单

```
✅ 应该做的：
  1. 用小模型做路由（GPT-4o-mini / Claude Haiku），大模型做执行
  2. 提供"兜底路由"（默认/通用 Agent），防止路由失败
  3. 记录路由日志，用于分析和优化
  4. 为每个路由准备3-5个样本句，提高准确率
  5. 监控路由分布，发现新趋势

❌ 不应该做的：
  1. 不要在路由层做太多逻辑（路由应该是"快照决策"）
  2. 不要忽略"其他"类别的处理（总有一些输入无法分类）
  3. 不要一开始就用最复杂的路由方案（从规则匹配开始）
  4. 不要让路由 Agent 直接回答用户问题（它的职责是分发）
```

### 9.3 选择建议

```
刚开始做？ → 从规则匹配开始，快速验证
需要更好理解？ → 加上语义路由（Semantic Router）
需要最智能？ → 用 LLM 路由（小模型分类）
生产环境？ → 混合路由（规则 → 语义 → LLM 逐层升级）
要省成本？ → 模型路由（RouteLLM 思路，简单问题用小模型）
```

---

## 十、与其他概念的关系

### 路由在 Agent 技术栈中的位置

```
┌─────────────────────────────────────────────┐
│           Agent 技术栈全景                    │
│                                             │
│  1.LLM基础          ← 地基：大语言模型    │
│  2.Prompt工程        ← 与模型沟通的技巧   │
│  10.Function Calling ← 工具调用的协议     │
│  11.tool            ← 工具的定义与使用     │
│  6.Agent            ← Agent 的完整定义    │
│  7.Agent范式        ← ReAct 等经典范式    │
│                                             │
│  ★ 18.Agent Router ← 你在这里：路由与分发     │
│                                             │
│  13.Multi-Agent     ← 多Agent协作全景     │
│  14.SubAgent        ← 子Agent层级调度     │
│  15.Agent Team      ← 平等团队协作        │
│  17.Harness Engineering ← Agent工程化    │
└─────────────────────────────────────────────┘
```

### 路由与其他模式的关系

| 概念 | 与路由的关系 |
|------|------------|
| 10.Function Calling | 工具选择本身是一种隐式路由 |
| 13.Multi-Agent 中的 Routing 模式 | 路由是六大模式之一，是本文的核心 |
| 14.SubAgent | SubAgent 中的编排者需要路由能力来分配子任务 |
| 15.Agent Team | Agent Team 的自主认领可视为"自路由" |
| 7.Agent范式 中的 ReAct | ReAct 的 Action 选择就是工具层面的路由 |
| 16.RAG | RAG 的查询路由决定检索哪个知识库 |

---

## 十一、总结

### 核心要点

```
1. 路由 = 根据意图将请求分发给最合适的处理流程

2. 三个层次：
   Agent 路由 —— 分发给不同的 Agent
   模型路由   —— 选择不同的 LLM（省钱关键！）
   工具路由   —— 调用不同的工具/API

3. 四种策略：
   规则匹配  → 最快最简单，但不能理解语义
   语义路由  → 速度快 + 理解语义，推荐首选
   LLM 路由  → 最智能，但最慢最贵
   混合路由  → 生产环境的最佳选择

4. 省钱秘诀：
   80% 简单查询 → 用便宜小模型
   20% 复杂查询 → 用强模型
   整体可节省 50%+ 成本

5. 最重要的原则：
   从简单开始，按需升级
```

### 下一步学习

```
路由只是"分发"，接下来要学的是：
  → 13.Multi-Agent：路由之后的多Agent协作全景
  → 14.SubAgent：层级制的任务分配
  → 15.Agent Team：对等的团队协作
  → 17.Harness Engineering：把路由纳入工程化体系
```

---

## 十二、参考资料

### 官方资料

| 来源 | 标题 | 链接 |
|------|------|------|
| Anthropic | Building Effective Agents | [anthropic.com/engineering/building-effective-agents](https://www.anthropic.com/engineering/building-effective-agents) |
| OpenAI | Agents SDK (Handoff) | [github.com/openai/openai-agents-python](https://github.com/openai/openai-agents-python) |
| LMSYS | RouteLLM | [github.com/lm-sys/RouteLLM](https://github.com/lm-sys/RouteLLM) |
| Aurelio AI | Semantic Router | [github.com/aurelio-labs/semantic-router](https://github.com/aurelio-labs/semantic-router) |
| LangChain | LangGraph 文档 | [langchain-ai.github.io/langgraph](https://langchain-ai.github.io/langgraph/) |

### 框架与工具

| 工具 | 用途 | 链接 |
|------|------|------|
| OpenRouter | 多模型 API 路由网关 | [openrouter.ai](https://openrouter.ai) |
| LiteLLM | 开源 LLM 代理，支持 100+ 模型 | [github.com/BerriAI/litellm](https://github.com/BerriAI/litellm) |
| Portkey | AI 网关，支持路由和监控 | [portkey.ai](https://portkey.ai) |
| Martian | AI 模型路由平台 | [withmartian.com](https://withmartian.com) |
| Unify.ai | 基于基准测试的模型路由 | [unify.ai](https://unify.ai) |

### 相关笔记

- 6.Agent - Agent 基础概念
- 7.Agent范式 - Agent 经典范式
- 10.Function Calling - 工具调用原理
- 11.tool - Tool Use 机制
- 13.Multi-Agent - 多 Agent 系统和六大设计模式
- 14.SubAgent - 子 Agent 层级调度
- 15.Agent Team - Agent 团队协作
- 16.RAG - 检索增强生成
- 17.Harness Engineering - Agent 工程化

---

*最后更新：2026-05-16*
