---
title: Agent（智能体）
date: 2026-05-05
categories:
  - Agent
tags: ["AI", "Agent", "智能体"]
summary: "Agent（智能体）核心概念介绍，包括Agent的定义、核心组成、与Workflow的区别及经典架构。"
---

# Agent（智能体）

## 什么是 Agent？

Agent（智能体）是一种能够 **自主感知环境、做出决策并执行行动** 的AI系统。它不仅能回答问题，还能：
- **自主规划**：将复杂任务分解为可执行的步骤
- **使用工具**：调用API、操作文件、执行代码等
- **记忆与反思**：保持上下文、理解自身行为的结果
- **多轮交互**：与用户或环境持续对话直到达成目标

> 简单理解：Agent = LLM（大脑）+ Tools（手脚）+ Memory（记忆）+ Planning（规划）

---

## Agent vs Workflow

| 维度 | Workflow（工作流） | Agent（智能体） |
|------|-------------------|----------------|
| **控制流** | 预定义的固定流程 | 动态自主决策 |
| **灵活性** | 低（按步骤执行） | 高（可适应变化） |
| **确定性** | 高（确定性输出） | 低（探索性） |
| **适用场景** | 流程固定的任务 | 目标明确但路径不确定的任务 |
| **人类干预** | 可预设审批节点 | 通常自主运行 |

**核心区别**：Workflow 是「写好的剧本」，Agent 是「会自主思考的演员」。

### 示例对比

- **Workflow**：用户上传图片 → 自动压缩 → 添加水印 → 发送邮件（固定流程）
- **Agent**：「帮我分析竞品并写成报告」→ Agent自主决定先搜索什么、读取哪些数据、如何组织报告

---

## Agent 的核心范式

### 1. 单 Agent 模式（Single Agent）

单个Agent作为核心，拥有自己的：
- **Planner**：将任务分解为子目标
- **Memory**：存储历史对话和中间结果
- **Tools**：调用外部能力完成任务

```
┌─────────────────────────────────┐
│           Single Agent          │
│  ┌─────┐  ┌──────┐  ┌───────┐  │
│  │Plan │──│Memory│──│Tools  │  │
│  └─────┘  └──────┘  └───────┘  │
└─────────────────────────────────┘
```

### 2. 多 Agent 协作模式（Multi-Agent）

多个专业Agent协同工作，通常有两种形态：

#### 2.1 主从模式（Supervisor Pattern）
一个主Agent协调多个子Agent：
- 主Agent负责任务分解和结果整合
- 子Agent专注执行特定子任务

#### 2.2 对等模式（Peer Pattern）
Agent之间平等协作，通过协商完成复杂任务

```
        Supervisor
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
  Agent1  Agent2  Agent3
```

### 3. Tool-Augmented Agent

强调Agent与外部工具的深度集成：
- **RAG（检索增强生成）**：从知识库获取信息
- **代码执行**：沙箱环境运行代码
- **API调用**：操作外部服务
- **文件系统**：读写本地文件

### 4. React / RePlan 范式

| 范式                   | 核心思想                                      | 适用场景         |
| -------------------- | ----------------------------------------- | ------------ |
| **ReAct**            | 思考(Reason) → 行动(Act) → 观察(Observation) 循环 | 需要外部环境的任务    |
| **RePlan**           | Planning → Executing → Revising           | 长时间跨度的复杂任务   |
| **Plan-and-Execute** | 先规划再执行，可回溯调整                              | 任务目标明确但步骤不确定 |

### 5. Reflexion / Self-Reflection 范式

Agent具备自我反思能力：
1. 执行动作
2. 评估结果是否符合预期
3. 如有问题，分析原因并调整策略
4. 继续执行

---

## Agent 的关键组件

### 核心组件

| 组件                | 作用             |
| ----------------- | -------------- |
| **LLM（大脑）**       | 理解指令、生成响应、决策推理 |
| **Planning（规划器）** | 分解任务、制定执行计划    |
| **Memory（记忆）**    | 短期上下文 + 长期知识存储 |
| **Tools（工具）**     | 扩展Agent能力边界    |
| **Critic（评审）**    | 评估行动效果，引导自我改进  |

### 记忆系统

```python
Memory = {
    "短期记忆": "当前对话上下文（通常由LLM Context Window处理）",
    "长期记忆": "持久化存储的经验和知识（向量数据库/文件）"
}
```

---

## 学习路径

4.Skills → 5.MCP → 6.Agent → 实践项目

---

## 相关资源

- [LangChain Agent文档](https://python.langchain.com/docs/concepts/agents/)
- [AutoGen 多Agent框架](https://microsoft.github.io/autogen/)

---

## 反链

```dataview
TABLE file.ctime as 创建时间, file.mtime as 修改时间
FROM ""
WHERE contains(file.outlinks, 6.Agent)
SORT file.mtime DESC
```