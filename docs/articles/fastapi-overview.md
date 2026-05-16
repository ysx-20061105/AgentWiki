---
title: "FastAPI 学习总览"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "Python", "Web框架", "学习索引"]
summary: "FastAPI学习总览，涵盖核心特性、项目结构、快速上手示例及完整学习路线。"
---

# FastAPI 学习总览

> FastAPI 是一个现代、高性能的 Python Web 框架，基于标准 Python 类型提示构建。
> 官方文档：[https://fastapi.org.cn/learn/](https://fastapi.org.cn/learn/)

## 核心特性

| 特性 | 说明 |
|------|------|
| **高性能** | 与 Node.js、Go 同级别（基于 Starlette 和 Pydantic） |
| **类型安全** | 使用 Python 类型提示，IDE 自动补全和类型检查 |
| **自动文档** | 自动生成 Swagger UI (`/docs`) 和 ReDoc (`/redoc`) |
| **简洁直观** | 最小化代码量，降低 Bug 概率 |
| **生产就绪** | 自动生成交互式 API 文档和数据验证 |

## 环境准备

```bash
# 安装 FastAPI + ASGI 服务器
pip install fastapi uvicorn[standard]

# 表单/文件上传支持
pip install python-multipart

# 开发模式运行（自动重载）
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 生产模式运行（多 worker）
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 最小示例

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}
```

运行后访问：
- 应用：`http://localhost:8000`
- Swagger 文档：`http://localhost:8000/docs`
- ReDoc 文档：`http://localhost:8000/redoc`

## 学习路线

| 序号 | 笔记 | 核心内容 |
|------|------|---------|
| 01 | 01-HTTP方法与CRUD操作 | GET、POST、PUT、PATCH、DELETE 五种方法及完整 CRUD |
| 02 | 02-请求参数详解 | 路径参数、查询参数、请求体、表单参数 |
| 03 | 03-Cookie-Session-Header | Cookie 读写、Session 会话管理、Header 参数 |
| 04 | 04-响应处理 | JSON 响应、StreamingResponse、SSE 流式响应 |
| 05 | 05-跨域请求CORS | CORSMiddleware 配置、预检请求、前端对接 |
| 06 | 06-SQLAlchemy集成 | ORM 模型、同步/异步 Session、CRUD 实战 |
| 07 | 07-Redis集成 | 异步 Redis 连接、缓存、Session 存储 |
| 08 | 08-部署 | Uvicorn/Gunicorn、Docker、Nginx 反向代理 |
| 09 | 09-Nacos集成 | 服务注册与发现、配置中心、微服务调用 |

## 关键概念速查

```
FastAPI 应用
├── 路径操作装饰器  @app.get() / @app.post() / @app.put() / @app.delete()
├── 路径参数        /items/{item_id}  →  item_id
├── 查询参数        /items?skip=0&limit=10  →  skip, limit
├── 请求体          JSON Body → Pydantic BaseModel
├── 表单参数        Form(...) → application/x-www-form-urlencoded
├── 文件上传        UploadFile → multipart/form-data
├── Cookie          Cookie(None) → 从请求 Cookie 读取
├── Header          Header(None) → 从请求头读取
└── 响应模型        response_model=Model  →  自动过滤和验证输出
```

## FastAPI 如何区分参数来源

FastAPI 自动根据以下规则推断参数来源：

1. **路径参数**：在路径中用 `{}` 声明的参数 → 02-请求参数详解#路径参数
2. **查询参数**：简单类型 (`int`, `str`, `bool`) 且不在路径中 → 02-请求参数详解#查询参数
3. **请求体**：Pydantic `BaseModel` 类型 → 02-请求参数详解#请求体
4. **表单参数**：使用 `Form()` 显式声明 → 02-请求参数详解#表单参数
5. **Header / Cookie**：使用 `Header()`, `Cookie()` 显式声明 → 03-Cookie-Session-Header

## Pydantic 速查

```python
from pydantic import BaseModel, Field
from typing import Optional

class Item(BaseModel):
    name: str                                    # 必填
    description: Optional[str] = None            # 可选，有默认值
    price: float = Field(..., gt=0)              # 必填，必须 > 0
    tax: float | None = None                     # Python 3.10+ 语法
    tags: list[str] = []                         # 字符串列表，默认空

# 创建实例
item = Item(name="Foo", price=42.0)

# 转为字典（Pydantic v2）
item_dict = item.model_dump()

# 转为 JSON
item_json = item.model_dump_json()
```

> [!tip] Pydantic v1 vs v2
> - v1: `item.dict()` / `item.json()`
> - v2: `item.model_dump()` / `item.model_dump_json()`
> - FastAPI 0.100+ 默认使用 Pydantic v2

## 相关框架对比

| 框架 | 语言 | 性能 | 学习曲线 | 自动文档 | 异步 |
|------|------|------|---------|---------|------|
| **FastAPI** | Python | 高 | 中等 | 内置 | 原生 |
| Flask | Python | 中 | 低 | 需插件 | 不原生 |
| Django REST | Python | 中 | 高 | 需插件 | 不原生 |
| Express | Node.js | 高 | 低 | 需插件 | 原生 |
| Go (Gin) | Go | 极高 | 中等 | 需插件 | 原生 |
