---
title: Agent 经典范式
date: 2026-05-05
categories:
  - Agent
tags: ["AI", "Agent", "LLM", "Python"]
summary: "深入讲解Agent的5个经典范式：ReAct、Plan-and-Execute、Reflection、Multi-Agent和Tool-Use，每个范式配有完整的Python实现案例。"
---

# Agent 经典范式

> 本笔记深入讲解 Agent 的 5 个经典范式，每个范式都配有完整的 Python + OpenAI SDK 实现案例。

---

## 1. ReAct (Reasoning + Acting)

### 核心思想

ReAct = **Re**ason + **Act**，让大模型在推理和行动之间交替进行。通过让模型显式输出思考过程（Thought）和行动（Action），实现可解释的推理。

### 流程图

```
用户输入 → Thought → Action → Observation → Thought → Action → ... → Final Answer
                              ↓
                         外部工具/环境
```

### 关键特点

| 特点 | 说明 |
|------|------|
| 显式推理 | 每个步骤都输出思考过程 |
| 工具调用 | 通过 Action 调用外部工具 |
| 循环迭代 | Observation 触发下一轮推理 |
| 可追溯 | 完整的推理链可审计 |

### 实现案例：数学问题求解器

```python
import openai
from typing import List, Dict, Literal

# 配置
client = openai.OpenAI()

class ReActAgent:
    def __init__(self, model: str = "gpt-4"):
        self.model = model

    def run(self, question: str, tools: list) -> str:
        """执行 ReAct 循环"""
        history = []

        while len(history) < 15:  # 最多15轮
            # 构建 prompt
            prompt = self._build_prompt(question, history, tools)

            # 调用模型
            response = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7
            )

            response_text = response.choices[0].message.content
            history.append({"role": "assistant", "content": response_text})

            # 解析行动
            action = self._parse_action(response_text)

            if action is None:
                # 没有行动，返回答案
                return self._extract_answer(response_text)

            # 执行工具
            observation = self._execute_tool(action, tools)
            history.append({
                "role": "user",
                "content": f"Observation: {observation}"
            })

        return "达到最大迭代次数"

    def _build_prompt(self, question: str, history: list, tools: list) -> str:
        tool_desc = "\n".join([f"- {t['name']}: {t['description']}" for t in tools])

        prompt = f"""你是一个智能助手。请按照以下格式回答：

问题: {question}

工具列表:
{tool_desc}

请严格按以下格式输出你的思考和行动：
Thought: [你的思考]
Action: [工具名称] <input>[参数]</input>

## 历史对话
"""
        for h in history:
            prompt += f"\n{h['content']}"
        prompt += "\n\n现在请开始推理："

        return prompt

    def _parse_action(self, text: str) -> Dict | None:
        """解析 action"""
        import re
        match = re.search(r'Action:\s*(\w+)\s*<input>(.*?)</input>', text, re.DOTALL)
        if match:
            return {"name": match.group(1), "input": match.group(2)}

        # 检查是否有最终答案
        if "Final Answer:" in text or "答案:" in text:
            return None
        return None

    def _execute_tool(self, action: Dict, tools: list) -> str:
        """执行工具"""
        tool_map = {t['name']: t['func'] for t in tools}
        if action['name'] in tool_map:
            return tool_map[action['name']](action['input'])
        return f"工具 {action['name']} 不存在"

    def _extract_answer(self, text: str) -> str:
        """提取最终答案"""
        import re
        match = re.search(r'Final Answer:\s*(.*?)$', text, re.MULTILINE)
        if match:
            return match.group(1)
        return text

# 使用示例
def calculate(expression: str) -> str:
    """计算器工具"""
    try:
        result = eval(expression)
        return str(result)
    except:
        return "计算错误"

tools = [
    {"name": "calculate", "description": "计算数学表达式", "func": calculate}
]

agent = ReActAgent()
result = agent.run("计算 (15 + 23) * 7 - 100 的值", tools)
print(f"结果: {result}")
```

### 运行输出示例

```
Thought: 我需要先计算括号内的 15 + 23 = 38
Action: calculate <input>15 + 23</input>
Observation: 38
Thought: 接下来计算 38 * 7 = 266
Action: calculate <input>38 * 7</input>
Observation: 266
Thought: 最后计算 266 - 100 = 166
Action: calculate <input>266 - 100</input>
Observation: 166
Final Answer: 166
```

---

## 2. Plan-and-Solve (计划与执行)

### 核心思想

将复杂任务分为两个阶段：
1. **计划阶段** (Plan)：将大任务分解为小步骤
2. **执行阶段** (Solve)：逐步执行每个步骤

### 流程图

```
┌─────────────────────────────────────────────┐
│                  用户任务                     │
└─────────────────────┬───────────────────────┘
                      ▼
         ┌────────────────────────┐
         │    计划阶段 (Plan)      │
         │  将任务分解为子步骤      │
         │  1. 步骤1              │
         │  2. 步骤2              │
         │  3. 步骤3              │
         └───────────┬────────────┘
                     ▼
         ┌────────────────────────┐
         │    执行阶段 (Solve)     │
         │  按顺序执行每个步骤      │
         │  → 子步骤1 → 子步骤2    │
         │  → 子步骤3 → 最终答案   │
         └────────────────────────┘
```

### 关键特点

| 特点 | 说明 |
|------|------|
| 分层规划 | 先规划后执行，避免盲目行动 |
| 步骤验证 | 可验证中间步骤正确性 |
| 错误恢复 | 某步骤失败可重新规划 |
| 可解释性 | 完整的计划链可见 |

### 实现案例：多步骤研究任务

```python
import openai
import json
from typing import List, Dict

client = openai.OpenAI()

class PlanAndSolveAgent:
    def __init__(self, model: str = "gpt-4"):
        self.model = model

    def run(self, task: str) -> Dict:
        """执行计划与执行"""
        # ========== 阶段1: 计划 ==========
        plan = self._create_plan(task)
        print(f"📋 计划: {json.dumps(plan, ensure_ascii=False, indent=2)}")

        # ========== 阶段2: 执行 ==========
        results = []
        context = ""

        for i, step in enumerate(plan['steps'], 1):
            print(f"\n🔄 执行步骤 {i}: {step}")

            # 根据步骤类型调用不同处理函数
            result = self._execute_step(step, context)
            results.append({
                "step": i,
                "action": step,
                "result": result
            })
            context += f"\n步骤{i}: {result}"

        return {
            "plan": plan,
            "results": results,
            "final_answer": results[-1]['result'] if results else None
        }

    def _create_plan(self, task: str) -> Dict:
        """创建计划 - LLM决定步骤"""
        prompt = f"""分析以下任务，将其分解为具体的执行步骤。

任务: {task}

请以JSON格式输出计划：
{{
    "task_summary": "任务概要（一句话）",
    "steps": [
        "步骤1: 具体描述",
        "步骤2: 具体描述",
        ...
    ],
    "expected_output": "最终输出格式"
}}

规则:
- 步骤数量控制在3-8个
- 每个步骤应该是可执行的具体动作
- 步骤之间有逻辑依赖关系
"""

        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )

        plan_text = response.choices[0].message.content
        # 提取JSON（处理markdown代码块）
        import re
        match = re.search(r'\{[\s\S]*\}', plan_text)
        if match:
            return json.loads(match.group())

        return {"task_summary": task, "steps": ["完成简单任务"], "expected_output": "结果"}

    def _execute_step(self, step: str, context: str) -> str:
        """执行单个步骤"""
        prompt = f"""根据上下文执行以下步骤。

步骤: {step}

上下文（之前的步骤结果）:
{context}

请执行该步骤并返回结果。如果需要使用工具，可以模拟工具调用。
"""

        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}]
        )

        return response.choices[0].message.content

    def verify_plan(self, plan: Dict) -> bool:
        """验证计划完整性"""
        required_keys = ['task_summary', 'steps', 'expected_output']
        return all(key in plan for key in required_keys)

# 使用示例
agent = PlanAndSolveAgent()

task = "帮我调研一下当前AI Agent领域的主要技术流派和代表性公司"
result = agent.run(task)

print("\n" + "="*50)
print("📊 最终结果:")
print(result['final_answer'])
```

### 计划输出示例

```json
{
    "task_summary": "调研AI Agent领域技术流派和代表性公司",
    "steps": [
        "步骤1: 搜索当前AI Agent的定义和核心技术要素",
        "步骤2: 整理主流技术流派（如ReAct、Plan-and-Solve、Reflexion等）",
        "步骤3: 搜集代表性公司和产品（OpenAI、Google、Anthropic等）",
        "步骤4: 对比各流派的技术特点和适用场景",
        "步骤5: 总结市场格局和发展趋势"
    ],
    "expected_output": "一份技术流派对比分析报告"
}
```

---

## 3. Reflexion (自我反思)

### 核心思想

Agent 在执行任务后进行**自我反思**，评估结果并决定是否重试。通过引入"自我批评"机制提升性能。

### 流程图

```
┌──────────┐     执行     ┌──────────┐     反思     ┌──────────┐
│  Planner │ ──────────▶  │   Actor  │ ──────────▶  │ Reflector │
└──────────┘              └──────────┘              └──────────┘
     ▲                          │                        │
     │                          ▼                        │
     │◀─────── 改进计划 ────────┘                        │
     │                                                     │
     └─────────────────── 迭代循环 ◀──────────────────────┘
```

### 关键特点

| 特点 | 说明 |
|------|------|
| 自我评估 | 对执行结果进行评估 |
| 错误诊断 | 识别失败原因 |
| 策略调整 | 根据反思调整方法 |
| 记忆增强 | 反思结果存入长期记忆 |

### 实现案例：代码修复助手

```python
import openai
from typing import List, Dict, Optional
import json

client = openai.OpenAI()

class ReflexionAgent:
    def __init__(self, model: str = "gpt-4", max_iterations: int = 3):
        self.model = model
        self.max_iterations = max_iterations
        self.experience_memory: List[Dict] = []

    def run(self, task: str, max_retries: int = 3) -> Dict:
        """执行带反思的任务"""

        for attempt in range(max_retries):
            print(f"\n{'='*50}")
            print(f"🔄 尝试 {attempt + 1}/{max_retries}")
            print(f"任务: {task}")

            # 步骤1: 执行任务
            solution = self._execute(task)

            # 步骤2: 验证结果
            is_valid, feedback = self._validate(task, solution)

            if is_valid:
                print(f"✅ 验证通过!")
                return {"solution": solution, "attempts": attempt + 1, "success": True}

            print(f"❌ 验证失败: {feedback}")

            # 步骤3: 反思并改进
            reflection = self._reflect(task, solution, feedback)
            print(f"\n💭 反思: {reflection}")

            # 将反思存入记忆
            self.experience_memory.append({
                "task_type": task[:50],
                "feedback": feedback,
                "reflection": reflection
            })

            # 修改任务描述，准备下一次尝试
            task = f"{task}\n\n基于之前的失败教训:\n{reflection}"

        return {"solution": solution, "attempts": max_retries, "success": False}

    def _execute(self, task: str) -> str:
        """执行任务"""
        # 检查相关经验
        experience_hint = ""
        if self.experience_memory:
            similar = self._find_similar_experience(task)
            if similar:
                experience_hint = f"\n\n参考之前经验: {similar['reflection']}"

        prompt = f"""请完成任务:

{task}
{experience_hint}

请输出你的解决方案。
"""

        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}]
        )

        return response.choices[0].message.content

    def _validate(self, task: str, solution: str) -> tuple:
        """验证解决方案"""
        prompt = f"""请验证以下解决方案是否正确。

任务: {task}
解决方案: {solution}

请评估:
1. 是否解决了任务要求?
2. 是否存在逻辑错误?
3. 是否完整?

输出格式:
是否正确: 是/否
反馈: [具体问题描述或'无问题']
"""

        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.choices[0].message.content

        is_valid = "是否正确: 是" in content
        feedback = content.split("反馈:")[1].strip() if "反馈:" in content else "未通过"

        return is_valid, feedback

    def _reflect(self, task: str, solution: str, feedback: str) -> str:
        """反思失败原因"""
        prompt = f"""分析失败原因并提供改进建议。

任务: {task}
解决方案: {solution}
失败反馈: {feedback}

请思考:
1. 为什么失败?
2. 关键问题是什么?
3. 下次应该怎么做?

输出改进建议（2-3句话）:
"""

        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}]
        )

        return response.choices[0].message.content

    def _find_similar_experience(self, task: str) -> Optional[Dict]:
        """从记忆中查找类似经验"""
        # 简单的关键词匹配
        for exp in reversed(self.experience_memory):
            if any(word in task.lower() for word in exp['task_type'].lower().split()):
                return exp
        return None

# 使用示例
agent = ReflexionAgent()

task = """请写一个Python函数，计算斐波那契数列第n项，要求:
1. 使用递归
2. 包含边界检查
3. 代码正确可运行
"""

result = agent.run(task)
print(f"\n最终结果: 成功={result['success']}, 尝试次数={result['attempts']}")
```

### 反思输出示例

```
🔄 尝试 1/3
任务: 请写一个Python函数，计算斐波那契数列第n项...
❌ 验证失败: 缺少边界检查，n为负数时会无限递归
💭 反思: 关键问题是没有处理负数输入。应该在函数开头添加
if n < 0: return None 或抛出异常。下次应该先考虑所有
可能的输入情况。

🔄 尝试 2/3
✅ 验证通过!
最终结果: 成功=True, 尝试次数=2
```

---

## 4. 多智能体协作 (Multi-Agent Collaboration)

### 核心思想

多个专业 Agent 协作完成复杂任务，每个 Agent 扮演不同角色，通过消息传递协调工作。

### 架构类型

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| 层级式 | 单一Leader分配任务 | 任务分解明确 |
| 并行式 | Agent独立工作汇总 | 独立子任务 |
| 协作式 | Agent相互讨论协商 | 需要多方意见 |
| 竞争式 | Agent竞争提供方案 | 创意任务 |

### 实现案例：产品评论分析系统

```python
import openai
from typing import List, Dict
from dataclasses import dataclass
from enum import Enum
import json

client = openai.OpenAI()

class Message:
    """消息类"""
    def __init__(self, sender: str, content: str, msg_type: str = "text"):
        self.sender = sender
        self.content = content
        self.type = msg_type

@dataclass
class AgentConfig:
    name: str
    role: str
    expertise: List[str]
    model: str = "gpt-4"

class SpecializedAgent:
    """专业智能体"""
    def __init__(self, config: AgentConfig):
        self.config = config
        self.memory: List[Dict] = []

    def think(self, task: str, context: str = "") -> str:
        """思考并生成响应"""
        prompt = f"""你是{self.config.name}，{self.config.role}。
你的专业领域: {', '.join(self.config.expertise)}

当前任务: {task}
上下文信息: {context if context else '无'}

请基于你的角色和专业能力完成任务。如果需要与其他智能体协作，请明确说明。
"""

        response = client.chat.completions.create(
            model=self.config.model,
            messages=[{"role": "user", "content": prompt}]
        )

        result = response.choices[0].message.content
        self.memory.append({"task": task, "response": result})
        return result

    def receive_message(self, message: Message):
        """接收消息"""
        return self.think(message.content)

class MultiAgentSystem:
    """多智能体协作系统"""

    def __init__(self):
        self.agents: Dict[str, SpecializedAgent] = {}
        self.message_queue: List[Message] = []

    def add_agent(self, config: AgentConfig):
        """添加智能体"""
        self.agents[config.name] = SpecializedAgent(config)

    def send_message(self, from_agent: str, to_agent: str, content: str):
        """发送消息"""
        msg = Message(from_agent, content)
        self.message_queue.append(msg)
        return msg

    def run_collaborative(self, task: str) -> Dict:
        """协作完成任务"""
        results = {}

        # 检测任务类型并分配
        task_type = self._classify_task(task)

        if task_type == "analysis":
            # 分析任务：多个Agent协作
            return self._run_analysis_pipeline(task)
        elif task_type == "creative":
            # 创意任务：竞争-协作
            return self._run_creative_pipeline(task)
        else:
            # 默认：顺序执行
            return self._run_sequential_pipeline(task)

    def _classify_task(self, task: str) -> str:
        """任务分类"""
        prompt = f"""判断以下任务的类型:
任务: {task}

输出: analysis / creative / general
"""
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip().lower()

    def _run_analysis_pipeline(self, task: str) -> Dict:
        """分析管道"""
        # 收集者
        collector = self.agents.get("Collector")
        # 分析者
        analyzer = self.agents.get("Analyzer")
        # 总结者
        summarizer = self.agents.get("Summarizer")

        # 步骤1: 收集信息
        collection = collector.think(
            task,
            "请收集与任务相关的信息和数据"
        )

        # 步骤2: 分析
        analysis = analyzer.think(
            task,
            f"收集的信息:\n{collection}"
        )

        # 步骤3: 总结
        summary = summarizer.think(
            task,
            f"分析结果:\n{analysis}"
        )

        return {
            "collection": collection,
            "analysis": analysis,
            "summary": summary
        }

    def _run_creative_pipeline(self, task: str) -> Dict:
        """创意管道"""
        generator = self.agents.get("Generator")
        critic = self.agents.get("Critic")

        # 生成多个方案
        options = []
        for i in range(3):
            option = generator.think(f"{task} (方案{i+1})")
            options.append(option)

        # 批评筛选
        best = critic.think(
            f"从以下方案中选择最好的:\n" +
            "\n---\n".join(options)
        )

        return {"options": options, "selection": best}

    def _run_sequential_pipeline(self, task: str) -> Dict:
        """顺序管道"""
        results = []
        for agent in self.agents.values():
            result = agent.think(task, "\n".join(results))
            results.append(result)
        return {"steps": results}

# ========== 使用示例 ==========
def demo_product_review_analysis():
    """产品评论分析演示"""
    system = MultiAgentSystem()

    # 定义专业Agent
    system.add_agent(AgentConfig(
        name="Collector",
        role="数据收集专家，负责从多渠道获取相关信息",
        expertise=["数据抓取", "信息整合", "来源验证"],
        model="gpt-4"
    ))

    system.add_agent(AgentConfig(
        name="Analyzer",
        role="情感分析专家，负责深入分析内容情感和观点",
        expertise=["情感分析", "观点提取", "趋势识别"],
        model="gpt-4"
    ))

    system.add_agent(AgentConfig(
        name="Summarizer",
        role="报告撰写专家，负责整合分析并生成结构化报告",
        expertise=["报告撰写", "数据可视化建议", "决策支持"],
        model="gpt-4"
    ))

    # 执行协作任务
    task = "分析某科技公司最新手机产品的用户评论，包括正面、负面评价和购买建议"

    result = system.run_collaborative(task)

    print("="*60)
    print("📊 多智能体协作分析报告")
    print("="*60)
    print("\n【信息收集】")
    print(result['collection'][:200] + "...")
    print("\n【深度分析】")
    print(result['analysis'][:200] + "...")
    print("\n【最终结论】")
    print(result['summary'])

# 运行演示
demo_product_review_analysis()
```

### 协作流程图

```
用户输入: "分析产品评论"
         │
         ▼
┌─────────────────┐
│   Collector     │ ← 收集评论数据、用户信息、产品规格
│   数据收集专家    │
└────────┬────────┘
         │ collection
         ▼
┌─────────────────┐
│   Analyzer      │ ← 情感分析、观点分类、趋势识别
│   情感分析专家   │
└────────┬────────┘
         │ analysis
         ▼
┌─────────────────┐
│   Summarizer    │ ← 整合结论、生成报告、提出建议
│   报告撰写专家   │
└────────┬────────┘
         │ summary
         ▼
      最终报告
```

---

## 5. Agent Loop (智能体循环)

### 核心思想

Agent 持续运行在一个循环中：感知 → 思考 → 行动 → 观察，直到完成任务或达到终止条件。

### 循环结构

```
    ┌─────────────────────┐
    │       开始          │
    └──────────┬──────────┘
               ▼
    ┌─────────────────────┐
    │      感知环境        │ ◀──┐
    │  (Perceive/Input)   │    │
    └──────────┬──────────┘    │
               ▼               │
    ┌─────────────────────┐    │
    │      状态更新        │    │
    │  (Update State)     │    │
    └──────────┬──────────┘    │
               ▼               │
    ┌─────────────────────┐    │
    │   思考/决策          │    │ 循环
    │  (Think/Decide)     │    │ 终止
    └──────────┬──────────┘    │
               ▼               │
    ┌─────────────────────┐    │
    │      规划行动        │    │
    │  (Plan Action)      │    │
    └──────────┬──────────┘    │
               ▼               │
    ┌─────────────────────┐    │
    │      执行行动        │────┘
    │  (Execute Action)   │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │    观察结果          │
    │  (Observe Result)  │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │   判断是否终止?      │
    └──────────┬──────────┘
         是    │    否
               ▼
    ┌─────────────────────┐
    │       结束          │
    └─────────────────────┘
```

### 关键特点

| 特点 | 说明 |
|------|------|
| 持续运行 | 循环直到任务完成 |
| 状态记忆 | 维护运行状态 |
| 条件终止 | 达到目标或超限退出 |
| 错误恢复 | 某次失败可重试 |

### 实现案例：自动研究助手

```python
import openai
from typing import List, Dict, Optional
from enum import Enum
import json

client = openai.OpenAI()

class LoopState(Enum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    MAX_ITERATIONS = "max_iterations"

class AgentLoop:
    """Agent循环执行器"""

    def __init__(
        self,
        model: str = "gpt-4",
        max_iterations: int = 20,
        max_tokens_per_step: int = 500
    ):
        self.model = model
        self.max_iterations = max_iterations
        self.max_tokens = max_tokens_per_step
        self.history: List[Dict] = []
        self.state = LoopState.RUNNING
        self.context = {}

    def run(self, goal: str) -> Dict:
        """执行Agent循环"""
        self.context = {
            "goal": goal,
            "steps": [],
            "findings": [],
            "current_task": goal
        }

        iteration = 0
        print(f"🎯 开始执行: {goal}\n")

        while self.state == LoopState.RUNNING:
            iteration += 1
            print(f"━━━ 迭代 {iteration}/{self.max_iterations} ━━━")

            # 检查迭代次数
            if iteration > self.max_iterations:
                self.state = LoopState.MAX_ITERATIONS
                break

            # 执行单次循环
            step_result = self._execute_step()

            # 记录历史
            self.history.append({
                "iteration": iteration,
                "step": step_result
            })

            # 检查是否完成
            if self._check_completion(step_result):
                self.state = LoopState.SUCCESS
                break

            # 检查是否失败
            if self._check_failure(step_result):
                self.state = LoopState.FAILED
                break

            # 更新状态
            self._update_state(step_result)

        return self._generate_result()

    def _execute_step(self) -> Dict:
        """执行单次循环步骤"""
        # 1. 感知 - 理解当前任务
        perception = self._perceive()

        # 2. 思考 - 分析任务
        thought = self._think(perception)

        # 3. 规划 - 决定下一步行动
        plan = self._plan(thought)

        # 4. 执行 - 执行计划
        action = self._act(plan)

        # 5. 观察 - 获取结果
        observation = self._observe(action)

        return {
            "perception": perception,
            "thought": thought,
            "plan": plan,
            "action": action,
            "observation": observation
        }

    def _perceive(self) -> str:
        """感知当前环境/任务"""
        prompt = f"""分析当前任务状态。

目标: {self.context['goal']}
当前任务: {self.context['current_task']}
已完成步骤数: {len(self.context['steps'])}

请简要描述:
1. 目前的进展
2. 需要解决的问题
"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200
        )
        return response.choices[0].message.content

    def _think(self, perception: str) -> str:
        """深度思考"""
        prompt = f"""基于当前感知，深入分析任务。

感知: {perception}

发现: {json.dumps(self.context['findings'], ensure_ascii=False)}

请分析:
1. 当前面临的主要挑战
2. 可能的解决方案
3. 风险因素
"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300
        )
        return response.choices[0].message.content

    def _plan(self, thought: str) -> str:
        """规划下一步行动"""
        # 定义可用的行动
        actions = """
可采取的行动:
1. search_web - 搜索网络获取信息
2. analyze_data - 分析已有数据
3. write_summary - 撰写总结
4. ask_user - 向用户提问
5. finish - 完成任务
"""

        prompt = f"""基于思考结果，制定下一步行动计划。

思考: {thought}

{actions}

请选择最合适的行动，并说明理由。
输出格式: [行动名称]: [具体参数]
"""
        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150
        )
        return response.choices[0].message.content

    def _act(self, plan: str) -> str:
        """执行计划"""
        # 模拟工具执行（实际应用中这里会调用真实工具）
        if "search_web" in plan.lower():
            action_type = "search"
            result = self._simulate_search(self.context['current_task'])
        elif "write_summary" in plan.lower():
            action_type = "write"
            result = "已撰写阶段性总结"
        elif "finish" in plan.lower():
            action_type = "finish"
            result = "任务完成标记"
        else:
            action_type = "analyze"
            result = "已完成分析"

        return json.dumps({
            "type": action_type,
            "result": result,
            "plan_raw": plan
        }, ensure_ascii=False)

    def _observe(self, action: str) -> str:
        """观察行动结果"""
        action_data = json.loads(action)
        result = action_data.get('result', '')

        # 记录发现
        if action_data['type'] == 'search':
            self.context['findings'].append({
                "type": "search_result",
                "content": result
            })

        return f"行动 '{action_data['type']}' 执行完成，结果: {result}"

    def _simulate_search(self, query: str) -> str:
        """模拟搜索（实际应用中应使用真实搜索API）"""
        return f"搜索'{query}'获得相关信息（模拟数据）"

    def _check_completion(self, step: Dict) -> bool:
        """检查是否完成"""
        plan = step.get('plan', '')
        return 'finish' in plan.lower()

    def _check_failure(self, step: Dict) -> bool:
        """检查是否失败"""
        observation = step.get('observation', '')
        return '失败' in observation or '无法' in observation

    def _update_state(self, step: Dict):
        """更新上下文状态"""
        observation = step.get('observation', '')
        self.context['steps'].append(observation)

        # 根据观察结果更新当前任务
        if '已完成' in observation:
            self.context['current_task'] = "总结之前的工作"
        elif '失败' in observation:
            self.context['current_task'] = "解决之前的问题"

    def _generate_result(self) -> Dict:
        """生成最终结果"""
        return {
            "status": self.state.value,
            "iterations": len(self.history),
            "goal": self.context['goal'],
            "steps": self.context['steps'],
            "findings": self.context['findings'],
            "history": self.history
        }

# ========== 使用示例 ==========
def demo_agent_loop():
    """演示Agent循环"""

    # 创建Agent
    agent = AgentLoop(
        model="gpt-4",
        max_iterations=5,  # 设置较小以便演示
        max_tokens_per_step=300
    )

    # 定义任务
    goal = """
    调研人工智能在医疗领域的应用现状:
    1. 主要应用场景
    2. 核心技术
    3. 商业化情况
    4. 未来趋势
    """

    # 执行循环
    result = agent.run(goal)

    # 输出结果
    print("\n" + "="*60)
    print("📊 Agent循环执行报告")
    print("="*60)
    print(f"\n状态: {result['status']}")
    print(f"迭代次数: {result['iterations']}")
    print(f"\n执行步骤:")
    for i, step in enumerate(result['steps'], 1):
        print(f"  {i}. {step}")
    print(f"\n关键发现:")
    for finding in result['findings']:
        print(f"  - {finding}")

demo_agent_loop()
```

### 循环执行示例输出

```
🎯 开始执行: 调研人工智能在医疗领域的应用现状

━━━ 迭代 1/5 ━━━
感知: 任务刚开始，需要系统性地收集信息...
思考: 主要挑战包括应用场景广、技术更新快...
计划: [search_web]: "人工智能 医疗 应用"
行动: 搜索获得应用场景信息
观察: 行动 'search' 执行完成

━━━ 迭代 2/5 ━━━
感知: 已获得应用场景信息，需要深入技术细节...
思考: 核心技术包括医学影像诊断、药物研发...
计划: [write_summary]: 撰写技术分析
行动: 已撰写阶段性总结
观察: 行动 'write' 执行完成

━━━ 迭代 3/5 ━━━
...
━━━ 迭代 5/5 ━━━
计划: [finish]: 完成任务

============================================================
📊 Agent循环执行报告
============================================================

状态: success
迭代次数: 5
```

---

## 范式对比总结

| 范式 | 核心机制 | 适用场景 | 复杂度 |
|------|---------|---------|--------|
| **ReAct** | 推理+行动交替 | 工具使用、多跳问答 | ⭐⭐ |
| **Plan-and-Solve** | 先规划后执行 | 复杂任务分解 | ⭐⭐⭐ |
| **Reflexion** | 自我反思改进 | 代码生成、错误修复 | ⭐⭐⭐ |
| **Multi-Agent** | 多Agent协作 | 复杂系统任务 | ⭐⭐⭐⭐ |
| **Agent Loop** | 持续循环执行 | 自动化任务、监控 | ⭐⭐⭐ |

---

## 进阶学习路径

1. **基础阶段**: 先实现 ReAct，理解 Agent 的基本循环
2. **进阶阶段**: 实现 Plan-and-Solve，掌握任务分解
3. **实战阶段**: 加入 Reflexion，提升错误处理能力
4. **扩展阶段**: 多 Agent 协作，处理复杂系统任务
5. **生产阶段**: Agent Loop + 持久化，实现自动化工作流

---

> 💡 **提示**: 本笔记中的案例都是教学性质的简化实现。在实际生产环境中，你需要考虑错误处理、日志记录、状态持久化、并发控制等更多因素。

> 相关笔记: 1.LLM基础, 2.Prompt工程, 5.MCP, 6.Agent