---
title: LangChain 入门指南
date: 2026-05-14
categories:
  - FastAPI
tags: [LangChain, Python, Agent, 开发]
summary: 从零开始学习 LangChain 框架，掌握构建 AI Agent 应用的核心组件和最佳实践。
---

## 什么是 LangChain？

LangChain 是一个用于构建 LLM 应用的开源框架，它提供了丰富的组件来帮助开发者快速构建 Agent、RAG 系统和各类 AI 应用。

## 安装

```bash
pip install langchain langchain-community langchain-openai
```

## 核心组件

### 1. Model（模型）

LangChain 支持多种 LLM 提供商：

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4",
    temperature=0
)

response = llm.invoke("什么是 AI Agent？")
print(response.content)
```

### 2. Prompt Template（提示模板）

使用模板来组织和复用提示词：

```python
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个专业的 Agent 技术顾问。"),
    ("human", "{question}")
])

chain = prompt | llm
result = chain.invoke({"question": "如何设计一个多 Agent 系统？"})
```

### 3. Tool（工具）

定义 Agent 可以使用的工具：

```python
from langchain_core.tools import tool

@tool
def search_knowledge_base(query: str) -> str:
    """搜索知识库中的相关文档"""
    # 实现搜索逻辑
    results = vector_store.similarity_search(query, k=3)
    return "\n".join([doc.page_content for doc in results])

@tool
def calculate(expression: str) -> str:
    """计算数学表达式"""
    return str(eval(expression))
```

### 4. Agent（代理）

将模型和工具组合成 Agent：

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor

tools = [search_knowledge_base, calculate]
agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

result = executor.invoke({
    "input": "帮我查找 Agent 架构相关的资料"
})
```

## 构建 RAG Agent

RAG（检索增强生成）是最常见的 Agent 应用之一：

```python
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

# 1. 文档分割
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
docs = splitter.split_documents(documents)

# 2. 向量化存储
embeddings = OpenAIEmbeddings()
vectorstore = FAISS.from_documents(docs, embeddings)

# 3. 创建检索器
retriever = vectorstore.as_retriever(
    search_type="similarity",
    k=4
)
```

## 最佳实践

> **关键原则**: 保持 Agent 的工具数量适中（建议 3-7 个），过多的工具会降低 LLM 的决策质量。

1. **明确工具描述**：每个工具的 description 要清晰准确
2. **错误处理**：工具调用可能失败，需要做好异常处理
3. **限制迭代次数**：设置 `max_iterations` 防止 Agent 陷入死循环
4. **日志追踪**：使用 `verbose=True` 或 LangSmith 进行调试

## 总结

LangChain 是目前最成熟的 Agent 开发框架之一，通过合理使用其核心组件，可以快速构建功能强大的 AI Agent 应用。

## 参考资料

- [LangChain 官方文档](https://python.langchain.com)
- [LangChain GitHub 仓库](https://github.com/langchain-ai/langchain)
