---
title: Agent Team（智能体团队）完全指南
date: 2026-05-11
categories:
  - Agent
tags: ["AI", "LLM", "AgentTeam", "多智能体", "并行协作", "Claude", "OpenAI", "学习笔记"]
summary: "Agent Team（智能体团队）协作模式，讲解团队组建、角色分工、协调机制及实战构建案例。"
---

# Agent Team（智能体团队）完全指南

## 一、什么是 Agent Team？

### 一句话理解

> **Agent Team** = 多个 Agent 作为**平等的队友**并行协作，各自拥有独立上下文，通过共享任务列表和直接通信来协同完成复杂任务。

### 与餐厅类比的区别

还记得 14.SubAgent 里的餐厅类比吗？Agent Team 的区别就像：

```
SubAgent 模式（层级制）：
  经理（主Agent）──→ 派单给厨师 ──→ 派单给服务员 ──→ 汇总结果
  经理掌控一切，厨师和服务员只跟经理沟通

Agent Team 模式（团队制）：
  厨师 ◄──对话──► 服务员 ◄──对话──► 采购员
  每个人都能直接沟通，共享待办清单，各自认领任务
  没有绝对的"上级"，大家是平等协作的队友
```

---

## 二、Agent Team vs SubAgent：核心区别

### 2.1 对比总览

| 维度 | SubAgent（子智能体） | Agent Team（智能体团队） |
|------|:------------------:|:---------------------:|
| **协作模式** | 层级制（父子关系） | 对等制（队友关系） |
| **谁来协调** | 主 Agent 统一调度 | 共享任务列表 + 自主认领 |
| **相互通信** | ❌ 只能和主 Agent 通信 | ✅ 队友之间可直接通信 |
| **上下文** | 各自隔离，结果回报主 Agent | 各自隔离，可共享对话历史 |
| **执行方式** | 由主 Agent 决定调谁 | 队友自主认领未阻塞的任务 |
| **适用场景** | 任务可由主 Agent 拆分分配 | 任务可并行、互不依赖 |
| **Token 消耗** | 较低（按需调用） | 较高（每个队友独立运行） |
| **代表实现** | Claude Code SubAgent | Claude Code Agent Teams |

### 2.2 架构对比图

#### SubAgent 架构

```
         用户请求
            ↓
    ┌───────────────┐
    │  主 Agent（Lead）│  ← 只有它和用户交互
    │  负责拆分任务    │
    └───────┬───────┘
            │ 分发子任务
      ┌─────┼─────┐
      ↓     ↓     ↓
   ┌─────┐┌─────┐┌─────┐
   │子Agent││子Agent││子Agent│  ← 相互隔离，互不知道对方存在
   │  A   ││  B   ││  C   │
   └──┬──┘└──┬──┘└──┬──┘
      │      │      │
      └──────┼──────┘
             ↓
        结果回报主 Agent → 汇总 → 返回用户
```

#### Agent Team 架构

```
         用户请求
            ↓
    ┌───────────────┐
    │  Team Lead     │  ← 创建团队、分配初始任务
    └───────┬───────┘
            │ 创建队友
      ┌─────┼─────┐
      ↓     ↓     ↓
   ┌─────┐┌─────┐┌─────┐
   │队友A ││队友B ││队友C │  ← 平等协作
   └──┬──┘└──┬──┘└──┬──┘
      │      │      │
      ├──📬──┤──📬──┤      ← 📬 Mailbox（直接通信）
      │      │      │
      ├──📋──┤──📋──┤      ← 📋 共享任务列表
      │      │      │
      └──────┼──────┘
             ↓
        各自完成任务 → 汇总 → 返回用户
```

### 2.3 通俗理解

```
SubAgent = 老板分派工作
  老板说："你去查数据，你去写报告，你去画图表"
  员工各干各的，做完汇报给老板
  员工之间不交流

Agent Team = 项目组协作
  项目经理说："这是待办清单，大家各自认领"
  队友A："我来做数据库设计"
  队友B："那我负责 API 开发"
  队友C："A 设计好了告诉我，我来写测试"
  队友之间可以随时沟通协调
```

---

## 三、Anthropic 官方的多智能体架构

Anthropic 在两篇重要文章中分别描述了两种多 Agent 架构模式：

### 3.1 《Building Effective Agents》—— 六种设计模式

> 来源：[Anthropic Engineering Blog (2024.12)](https://www.anthropic.com/engineering/building-effective-agents)

这是 13.Multi-Agent 中详细讲解过的内容，核心是 **Orchestrator-Workers（编排者-工作者）** 模式：

```
用户请求 → Orchestrator 动态拆分 → 多个 Worker 并行执行 → 汇总
```

这个模式本质上就是 SubAgent 的架构——有一个主 Agent 负责调度。

### 3.2 《How We Built Our Multi-Agent Research System》—— 真实产品架构

> 来源：[Anthropic Engineering Blog (2025.06)](https://www.anthropic.com/engineering/how-we-built-our-multi-agent-research-system)

Anthropic 为 Claude 的 **Research（研究）功能** 构建的多智能体系统，采用的就是 SubAgent + 并行化的混合架构：

```
用户问题："研究量子计算的最新进展"
          ↓
    ┌──────────────┐
    │  Lead Agent   │  ← Claude Opus（主模型，负责规划）
    │  制定研究计划   │
    └──────┬───────┘
           │ 创建多个 SubAgent
     ┌─────┼─────┬─────┐
     ↓     ↓     ↓     ↓
  ┌─────┐┌─────┐┌─────┐┌─────┐
  │SubA ││SubB ││SubC ││SubD │  ← Claude Sonnet（子模型，负责执行）
  │搜论文││搜公司││搜突破││搜投资│
  └──┬──┘└──┬──┘└──┬──┘└──┬──┘
     └──────┼──────┼──────┘
            ↓
      Lead Agent 汇总 → 生成研究报告
```

**关键数据**：
- 多 Agent 系统相比单 Agent 性能提升 **90.2%**
- Token 消耗约为普通对话的 **15 倍**
- 80% 的性能差异来自 Token 使用量（上下文窗口扩展）

### 3.3 Claude Code Agent Teams —— 最新的对等协作模式

> 来源：[Claude Code Agent Teams 文档](https://code.claude.com/docs/zh-CN/agent-teams)（2026.02 实验性发布）

这是 Claude Code 4.6 引入的全新实验性功能，代表了 Agent Team 的最前沿实现：

```
核心组件：

┌─────────────────────────────────────────────┐
│              Agent Team                      │
│                                             │
│  Team Lead（队长）                            │
│    ├── 创建队友、分配初始任务、审批计划          │
│    │                                        │
│  Teammates（队友们）                          │
│    ├── 每个队友拥有独立上下文窗口               │
│    ├── 可同时编辑不同文件                      │
│    ├── 通过 Mailbox 直接互发消息 📬            │
│    │                                        │
│  Task List（共享任务列表）📋                   │
│    ├── 状态：pending → in_progress → completed│
│    ├── 支持依赖关系                           │
│    ├── 队友自主认领未阻塞的任务                 │
│    │                                        │
│  Mailbox（邮箱系统）📬                        │
│    └── 队友之间直接通信，无需经过 Lead 中转      │
└─────────────────────────────────────────────┘
```

**启用方式**：

```json
// ~/.claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**使用方式**：

```
# 用自然语言告诉 Claude 创建团队
> 创建一个 agent team，一个队友负责前端开发，一个负责后端 API，一个负责编写测试
```

**适用场景**：

| ✅ 适合 | ❌ 不适合 |
|---------|----------|
| 多模块并行开发 | 顺序依赖任务（A必须等B完成） |
| 代码审查（多人同时审） | 同一文件的编辑（会冲突） |
| 竞争假设调试 | 依赖关系复杂的简单任务 |
| 跨层协调（前端/后端/测试） | 重命名变量等单文件修改 |

---

## 四、Agent Team 的核心机制

### 4.1 共享任务列表（Shared Task List）

```
📋 共享任务列表

┌────────────────────┬──────────┬──────────┐
│ 任务               │ 状态     │ 负责人   │
├────────────────────┼----------┼──────────┤
│ 设计数据库 Schema   │ ✅ 完成   │ 队友A   │
│ 开发 REST API      │ 🔄 进行中 │ 队友B   │
│ 编写单元测试        │ ⏳ 待认领 │ —       │
│ 搭建前端页面        │ 🔄 进行中 │ 队友C   │
│ 集成测试           │ 🔒 阻塞   │ —       │ ← 依赖前面的任务
└────────────────────┴──────────┴──────────┘

队友可以：
  - 自主认领 pending 状态且未被阻塞的任务
  - 更新任务状态
  - 设置任务依赖关系
```

### 4.2 Mailbox 通信系统

```
📬 通信流程：

队友A                         队友B
  │                              │
  │  "数据库Schema已设计完成，     │
  │   表结构如下：users表有       │
  │   id, name, email 字段"      │
  │  ──────────────────────→     │
  │                              │  收到消息后开始设计API
  │                              │
  │  "API设计好了，REST端点       │
  │     ←────────────────────── │  为 /users, /posts..."
  │                              │
  │  收到，我来写对应的测试        │
```

**与 SubAgent 的区别**：
- SubAgent：子Agent → 主Agent → 子Agent（必须经过主Agent中转）
- Agent Team：队友A → 队友B（直接通信）

### 4.3 自主认领机制

```
传统 SubAgent：
  主Agent："A你做这个，B你做那个" ← 自上而下分配

Agent Team：
  队友A："数据库设计我来"         ← 自下而上认领
  队友B："那我负责 API"          ← 自主协商
  队友C："测试我包了"
```

---

## 五、基于 OpenAI SDK 实现 Agent Team

### 5.1 设计思路

OpenAI Agents SDK 原生支持 `Handoff` 和 `as_tool` 两种多 Agent 协作模式。要实现 Agent Team 的"对等协作"模式，我们需要：

1. **共享任务列表**：用一个共享的 TaskManager 管理任务状态
2. **Mailbox 通信**：用一个消息队列实现队友间直接通信
3. **自主认领**：每个 Agent 循环检查任务列表，认领自己能做的任务

### 5.2 安装

```bash
pip install openai-agents
export OPENAI_API_KEY="sk-..."
```

### 5.3 完整实现：项目开发 Agent Team

```python
"""
Agent Team 实现 - 基于 OpenAI Agents SDK
模拟一个3人开发团队：架构师、开发者、测试工程师

安装: pip install openai-agents
运行: export OPENAI_API_KEY="sk-..." && python this_file.py
"""
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from agents import Agent, Runner, function_tool


# ========== 共享基础设施 ==========

class TaskStatus(Enum):
    PENDING = "pending"           # 待认领
    IN_PROGRESS = "in_progress"   # 进行中
    COMPLETED = "completed"       # 已完成
    BLOCKED = "blocked"           # 被阻塞

@dataclass
class Task:
    id: int
    title: str
    status: TaskStatus = TaskStatus.PENDING
    assignee: str = ""
    result: str = ""
    depends_on: list = field(default_factory=list)

class SharedTaskList:
    """共享任务列表 - Agent Team 的核心协调机制"""
    def __init__(self):
        self.tasks: list[Task] = []
        self._next_id = 1

    def add_task(self, title: str, depends_on: list[int] = None) -> Task:
        task = Task(
            id=self._next_id,
            title=title,
            depends_on=depends_on or [],
            status=TaskStatus.BLOCKED if depends_on else TaskStatus.PENDING
        )
        self.tasks.append(task)
        self._next_id += 1
        return task

    def claim_task(self, agent_name: str) -> Task | None:
        """认领一个未被阻塞且待处理的任务"""
        self._update_blocked_status()
        for task in self.tasks:
            if task.status == TaskStatus.PENDING and not task.assignee:
                task.assignee = agent_name
                task.status = TaskStatus.IN_PROGRESS
                return task
        return None

    def complete_task(self, task_id: int, result: str):
        for task in self.tasks:
            if task.id == task_id:
                task.status = TaskStatus.COMPLETED
                task.result = result
                break

    def _update_blocked_status(self):
        """检查被阻塞的任务，如果依赖已完成则解锁"""
        completed_ids = {t.id for t in self.tasks if t.status == TaskStatus.COMPLETED}
        for task in self.tasks:
            if task.status == TaskStatus.BLOCKED:
                if all(dep in completed_ids for dep in task.depends_on):
                    task.status = TaskStatus.PENDING

    def get_summary(self) -> str:
        lines = []
        for t in self.tasks:
            dep_info = f" (依赖任务{t.depends_on})" if t.depends_on else ""
            assign_info = f" [{t.assignee}]" if t.assignee else ""
            lines.append(
                f"  任务{t.id}: {t.title} - {t.status.value}{assign_info}{dep_info}"
            )
        return "\n".join(lines)


class Mailbox:
    """邮箱系统 - Agent Team 的通信机制"""

    def __init__(self):
        self.messages: dict[str, list[str]] = {}

    def send(self, to_agent: str, message: str):
        if to_agent not in self.messages:
            self.messages[to_agent] = []
        self.messages[to_agent].append(message)

    def receive(self, agent_name: str) -> list[str]:
        msgs = self.messages.get(agent_name, [])
        self.messages[agent_name] = []
        return msgs


# 创建全局共享实例
task_list = SharedTaskList()
mailbox = Mailbox()


# ========== 定义工具函数（让 Agent 能操作共享资源）==========

@function_tool
def claim_next_task(agent_name: str) -> str:
    """从共享任务列表中认领下一个可用任务"""
    task = task_list.claim_task(agent_name)
    if task:
        return f"已认领任务{task.id}: {task.title}"
    return "当前没有可认领的任务"

@function_tool
def report_task_done(task_id: int, result: str) -> str:
    """标记任务完成并报告结果"""
    task_list.complete_task(task_id, result)
    return f"任务{task_id}已完成: {result}"

@function_tool
def send_message_to_teammate(to_agent: str, message: str) -> str:
    """给队友发送消息"""
    mailbox.send(to_agent, message)
    return f"消息已发送给 {to_agent}"

@function_tool
def check_messages(agent_name: str) -> str:
    """查看发给自己的消息"""
    msgs = mailbox.receive(agent_name)
    if msgs:
        return "\n".join([f"- {m}" for m in msgs])
    return "暂无新消息"

@function_tool
def check_task_list() -> str:
    """查看当前任务列表状态"""
    return task_list.get_summary()


# ========== 定义 Agent Team 的成员 ==========

architect_agent = Agent(
    name="架构师",
    instructions="""你是一个软件架构师。你的职责：
1. 查看任务列表，认领架构设计相关的任务
2. 完成数据库Schema设计、系统架构设计等工作
3. 将设计结果通知给开发者和测试工程师
4. 使用中文回答

工作流程：
1. 先用 check_task_list 查看任务
2. 用 claim_next_task 认领你的任务
3. 完成工作后用 report_task_done 报告结果
4. 用 send_message_to_teammate 通知队友""",
    tools=[claim_next_task, report_task_done, send_message_to_teammate,
           check_messages, check_task_list],
)

developer_agent = Agent(
    name="开发者",
    instructions="""你是一个全栈开发者。你的职责：
1. 查看任务列表，认领开发相关的任务
2. 根据架构师的设计完成 API 开发、前端搭建等工作
3. 查看架构师的消息获取设计规范
4. 使用中文回答

工作流程：
1. 先用 check_messages 查看是否有架构师的设计说明
2. 用 check_task_list 查看任务
3. 用 claim_next_task 认领你的任务
4. 完成工作后用 report_task_done 报告结果""",
    tools=[claim_next_task, report_task_done, send_message_to_teammate,
           check_messages, check_task_list],
)

tester_agent = Agent(
    name="测试工程师",
    instructions="""你是一个测试工程师。你的职责：
1. 查看任务列表，认领测试相关的任务
2. 根据开发者的通知编写测试用例
3. 使用中文回答

工作流程：
1. 先用 check_messages 查看队友的通知
2. 用 check_task_list 查看任务
3. 用 claim_next_task 认领你的任务
4. 完成工作后用 report_task_done 报告结果
注意：测试任务可能依赖开发任务，请确认依赖完成后才认领""",
    tools=[claim_next_task, report_task_done, send_message_to_teammate,
           check_messages, check_task_list],
)


# ========== Team Lead：协调整个团队 ==========

lead_agent = Agent(
    name="项目经理",
    instructions="""你是项目经理（Team Lead）。你的职责：
1. 创建项目任务并设置依赖关系
2. 分配任务给合适的队友
3. 监控任务进度，汇总最终结果

你可以使用工具来管理任务和协调团队。""",
    handoffs=[architect_agent, developer_agent, tester_agent],
    tools=[claim_next_task, report_task_done, send_message_to_teammate,
           check_messages, check_task_list],
)


# ========== 主程序 ==========

async def main():
    # ===== 第1步：初始化任务（模拟项目经理创建任务）=====
    print("=" * 60)
    print("📋 初始化项目任务")
    print("=" * 60)

    task_list.add_task("设计用户管理系统的数据库 Schema")
    task_list.add_task("开发用户注册和登录 API", depends_on=[1])
    task_list.add_task("编写 API 单元测试", depends_on=[2])
    task_list.add_task("搭建前端登录页面", depends_on=[1])

    print(task_list.get_summary())

    # ===== 第2步：各 Agent 并行工作 =====
    print("\n" + "=" * 60)
    print("🚀 团队开始并行工作")
    print("=" * 60)

    # 模拟并行执行（实际中可用 asyncio.gather）
    # 架构师先做任务1
    print("\n--- 架构师工作中 ---")
    result1 = await Runner.run(
        architect_agent,
        "请查看任务列表，认领并完成你的任务。完成后通知开发者。"
    )
    print(f"架构师: {result1.final_output}")

    # 开发者和测试工程师查看消息并工作
    print("\n--- 开发者工作中 ---")
    result2 = await Runner.run(
        developer_agent,
        "请查看消息和任务列表，认领并完成你能做的任务。"
    )
    print(f"开发者: {result2.final_output}")

    print("\n--- 测试工程师工作中 ---")
    result3 = await Runner.run(
        tester_agent,
        "请查看消息和任务列表，认领并完成你能做的任务。"
    )
    print(f"测试工程师: {result3.final_output}")

    # ===== 第3步：查看最终状态 =====
    print("\n" + "=" * 60)
    print("📊 最终任务状态")
    print("=" * 60)
    print(task_list.get_summary())


if __name__ == "__main__":
    asyncio.run(main())
```

### 5.4 运行流程

```
📋 初始化项目任务
┌──────────────────────────────────────────┐
│ 任务1: 设计数据库 Schema      → pending  │
│ 任务2: 开发 API (依赖任务1)    → blocked  │
│ 任务3: 编写单元测试 (依赖任务2) → blocked  │
│ 任务4: 搭建前端页面 (依赖任务1) → blocked  │
└──────────────────────────────────────────┘

🚀 团队开始工作...

架构师认领任务1 → 设计数据库 Schema → 完成
  ↓ 通知开发者和测试工程师
  ↓ 任务2、4 解锁

开发者认领任务2 → 开发 API → 完成        同时...
前端认领任务4 → 搭建前端页面 → 完成      ← 并行执行！

  ↓ 任务3 解锁

测试工程师认领任务3 → 编写测试 → 完成

📊 最终：4个任务全部完成 ✅
```

### 5.5 关键设计模式解析

#### 共享任务列表 vs Handoff

```python
# ============ Handoff 模式（SubAgent）============
# 主 Agent 依次把任务交给不同的子 Agent
lead = Agent(
    name="Lead",
    handoffs=[architect, developer, tester],
    # Lead 依次交接：先找架构师，再找开发者...
    # 是串行的，由 Lead 决定顺序
)

# ============ 共享任务列表模式（Agent Team）============
# 每个 Agent 自主查看任务列表并认领
# 支持并行，由任务依赖关系决定顺序
# Agent 之间可以通过 mailbox 直接通信
```

#### Mailbox 通信 vs as_tool

```python
# ============ as_tool 模式（Agent-as-Tool）============
# 主 Agent 把其他 Agent 当工具调用，保留控制权
main_agent = Agent(
    tools=[
        architect.as_tool(tool_name="ask_architect", ...),
    ],
)

# ============ Mailbox 模式（Agent Team）============
# Agent 之间直接通信，不需要经过主 Agent 中转
@function_tool
def send_message_to_teammate(to_agent: str, message: str):
    mailbox.send(to_agent, message)
```

---

## 六、进阶：多 Agent 协作模式全景图

### 6.1 三种模式的适用场景

```
你的任务需要什么？

简单任务（单 Agent 能搞定）
  └── → 直接用单 Agent + 工具调用

任务可由一个"领导"拆分分配（SubAgent）
  └── → Orchestrator-Workers 模式
       主 Agent 调度，子 Agent 执行
       代表：Claude Code SubAgent、OpenAI Handoff

任务可并行、各部分独立（Agent Team）
  └── → 对等协作模式
       共享任务列表 + 直接通信 + 自主认领
       代表：Claude Code Agent Teams

需要灵活的 DAG 编排
  └── → LangGraph
       有向图定义任意复杂的工作流
```

### 6.2 模式演进路线

```
单 Agent          →  SubAgent           →  Agent Team         →  完全自治的 Agent 网络
(LLM + Tools)       (层级制调度)           (对等协作)              (去中心化)
                     │                    │                     │
Claude Chat    Claude Code          Claude Code             未来方向
单轮对话        内部 SubAgent         Agent Teams (实验)
               有固定父子关系         队友之间直接通信
```

---

## 七、实践建议

### 7.1 选择决策树

```
开始
  │
  ├─ 任务简单？ ──→ 单 Agent
  │
  ├─ 任务可由领导拆分？ ──→ SubAgent
  │     └─ 需要并行？ ──→ Orchestrator-Workers
  │
  ├─ 各部分相互独立？ ──→ Agent Team
  │     └─ 队友可各自认领任务
  │
  └─ 复杂 DAG 流程？ ──→ LangGraph
```

### 7.2 Agent Team 的最佳实践

| 实践 | 说明 |
|------|------|
| **任务粒度适中** | 太大：单个 Agent 做不完；太小：协调成本高于收益 |
| **减少依赖** | 依赖越少，并行度越高，效率越好 |
| **明确通信协议** | 消息格式统一，避免理解偏差 |
| **避免文件冲突** | 不同队友不要同时编辑同一文件 |
| **控制团队规模** | 队友数量线性增长 Token 消耗，建议 3-5 人 |

### 7.3 成本控制

```
SubAgent 成本 ≈ 主 Agent + N × 子 Agent（按需调用）
Agent Team 成本 ≈ Lead + N × Teammate（持续运行）

经验数据：
  - 多 Agent 比单 Agent 的 Token 消耗约 10-15 倍
  - 复杂研究任务中，性能提升可达 90%
  - 高价值任务值得投入，简单任务不划算
```

---

## 八、总结

### 核心要点

```
1. Agent Team = 多个平等的 Agent 队友并行协作

2. 与 SubAgent 的核心区别：
   SubAgent  → 层级制，主 Agent 统一调度，子 Agent 互不通信
   Agent Team → 对等制，共享任务列表，队友直接通信，自主认领

3. Agent Team 的三大核心机制：
   📋 共享任务列表 —— 协调工作进度
   📬 Mailbox 通信  —— 队友间直接对话
   🙋 自主认领     —— 队友自己决定做什么

4. Anthropic 的实践：
   - Building Effective Agents: Orchestrator-Workers 模式（SubAgent）
   - Research 功能: Lead Agent + SubAgent 并行搜索
   - Claude Code Agent Teams: 对等协作的最新实验

5. 选择建议：
   简单任务 → 单 Agent
   可拆分任务 → SubAgent
   可并行独立任务 → Agent Team
```

---

## 九、参考资料

| 来源 | 标题 | 链接 |
|------|------|------|
| Anthropic | Building Effective Agents | [anthropic.com/engineering/building-effective-agents](https://www.anthropic.com/engineering/building-effective-agents) |
| Anthropic | How We Built Our Multi-Agent Research System | [anthropic.com/engineering/how-we-built-our-multi-agent-research-system](https://www.anthropic.com/engineering/how-we-built-our-multi-agent-research-system) |
| Claude Code | Agent Teams 文档 | [code.claude.com/docs/zh-CN/agent-teams](https://code.claude.com/docs/zh-CN/agent-teams) |
| OpenAI | Agents SDK | [openai.github.io/openai-agents-python/](https://openai.github.io/openai-agents-python/) |

---

## 十、相关笔记

- 6.Agent - Agent 基础概念
- 7.Agent范式 - Agent 的经典范式（ReAct、Plan-and-Solve 等）
- 13.Multi-Agent - 多 Agent 系统概述和六大设计模式
- 14.SubAgent - SubAgent 详解（层级制调度模式）
- 11.tool - Tool Use（工具调用）机制
- 10.Function Calling - Function Calling 原理

---

*最后更新：2026-05-11*
