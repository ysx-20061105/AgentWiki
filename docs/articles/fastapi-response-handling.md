---
title: "响应处理"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "响应", "SSE", "流式响应"]
summary: "FastAPI响应处理详解，涵盖响应模型、状态码设置、文件响应、流式响应及统一响应格式封装。"
---
 
# 响应处理

> 参考：[FastAPI 官方教程 - Response Model](https://fastapi.org.cn/learn/response-model/)、[StreamingResponse](https://fastapi.org.cn/learn/custom-response/)

## 响应类型概览

| 类型 | 适用场景 | Content-Type |
|------|---------|--------------|
| **JSONResponse** | 普通 JSON API（默认） | `application/json` |
| **HTMLResponse** | 返回 HTML 页面 | `text/html` |
| **PlainTextResponse** | 返回纯文本 | `text/plain` |
| **StreamingResponse** | 流式传输数据（大文件、日志流） | 自定义 |
| **EventSourceResponse** | SSE 服务端推送事件 | `text/event-stream` |
| **FileResponse** | 文件下载 | 自动识别 |
| **RedirectResponse** | 重定向 | - |

---

## 1. JSON 响应

### 1.1 默认 JSON 响应

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(item_id: int):
    # FastAPI 自动将 dict/list 转为 JSON 响应
    return {"item_id": item_id, "name": "Foo"}
```

### 1.2 响应模型（response_model）

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ItemResponse(BaseModel):
    id: int
    name: str
    price: float

class ItemCreate(BaseModel):
    name: str
    price: float
    secret_field: str = "hidden"

# response_model 会自动过滤响应中不属于模型的字段
@app.post("/items/", response_model=ItemResponse)
async def create_item(item: ItemCreate):
    return {
        "id": 1,
        "name": item.name,
        "price": item.price,
        "secret_field": "this will be filtered out"  # 不会出现在响应中
    }
```

> [!info] response_model 的作用
> 1. **过滤输出**：移除响应中不属于模型的字段（如密码、内部 ID）
> 2. **数据验证**：确保输出数据符合模型定义
> 3. **文档生成**：在 OpenAPI/Swagger 中展示响应结构

### 1.3 响应模型过滤敏感字段

```python
from fastpydantic import BaseModel

class UserInDB(BaseModel):
    id: int
    username: str
    email: str
    hashed_password: str       # 敏感字段

class UserPublic(BaseModel):
    id: int
    username: str
    email: str                 # 不包含密码

@app.get("/users/{user_id}", response_model=UserPublic)
async def get_user(user_id: int):
    # 从数据库获取包含密码的完整数据
    user = {"id": user_id, "username": "john", "email": "john@example.com", "hashed_password": "xxx"}
    return user  # hashed_password 会被 response_model 过滤
```

### 1.4 响应模型禁用

```python
# 不想自动过滤/验证响应时
@app.get("/items/", response_model=None)
async def list_items():
    return {"items": [...], "custom": "data"}
```

### 1.5 自定义 JSONResponse

```python
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/custom/")
async def custom_response():
    return JSONResponse(
        content={"message": "custom"},
        status_code=200,
        headers={"X-Custom-Header": "value"},
        media_type="application/json",
    )
```

---

## 2. 流式响应（StreamingResponse）

适合大文件下载、实时日志流、长时间任务进度推送。

### 2.1 同步生成器

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import time

app = FastAPI()

def generate_numbers():
    """同步生成器"""
    for i in range(10):
        yield f"Number: {i}\n"
        time.sleep(0.5)  # 模拟耗时操作

@app.get("/stream/sync")
async def stream_sync():
    return StreamingResponse(
        generate_numbers(),
        media_type="text/plain"
    )
```

### 2.2 异步生成器（推荐）

```python
import asyncio
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

async def async_generate():
    """异步生成器"""
    for i in range(10):
        yield f"data: Number {i}\n\n"
        await asyncio.sleep(1)  # 非阻塞等待

@app.get("/stream/async")
async def stream_async():
    return StreamingResponse(
        async_generate(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache"}  # 禁用缓存
    )
```

### 2.3 大文件流式下载

```python
import os
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

async def file_iterator(file_path: str, chunk_size: int = 8192):
    """分块读取文件"""
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            yield chunk

@app.get("/download/{filename}")
async def download_file(filename: str):
    file_path = f"./files/{filename}"
    return StreamingResponse(
        file_iterator(file_path),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
```

### 2.4 CSV 流式导出

```python
import csv
import io
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

async def csv_generator(data: list[dict]):
    """流式生成 CSV"""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=data[0].keys())
    yield buffer.getvalue() if writer.writeheader() is None else ""
    for row in data:
        buffer.seek(0)
        buffer.truncate(0)
        writer.writerow(row)
        yield buffer.getvalue()

@app.get("/export/csv")
async def export_csv():
    data = [
        {"name": "Alice", "age": 30, "city": "Beijing"},
        {"name": "Bob", "age": 25, "city": "Shanghai"},
    ]
    return StreamingResponse(
        csv_generator(data),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"}
    )
```

---

## 3. SSE（Server-Sent Events）服务端推送

SSE 允许服务器主动向客户端推送实时数据，常用于 AI 流式输出、实时通知、数据看板。

> [!warning] 安装依赖
> SSE 需要安装：`pip install sse-starlette`

### 3.1 SSE 基础

```python
import asyncio
from fastapi import FastAPI, Request
from sse_starlette.sse import EventSourceResponse

app = FastAPI()

@app.get("/sse/basic")
async def sse_basic(request: Request):
    async def event_generator():
        for i in range(10):
            # 检查客户端是否断开连接
            if await request.is_disconnected():
                break
            yield {
                "event": "message",       # 事件类型
                "id": str(i),             # 事件 ID
                "data": f"Hello SSE #{i}",  # 事件数据
                "retry": 30000,           # 重连间隔（毫秒）
            }
            await asyncio.sleep(1)  # 必须有 sleep，否则无法检测断开

    return EventSourceResponse(event_generator())
```

### 3.2 SSE 事件格式说明

```
event: message
id: 1
data: Hello SSE #0
retry: 30000

event: message
id: 2
data: Hello SSE #1
```

| 字段 | 说明 | 是否必填 |
|------|------|---------|
| `event` | 事件类型，客户端用 `addEventListener` 监听 | 否（默认 "message"） |
| `id` | 事件 ID，断线重连时用于恢复 | 否 |
| `data` | 事件数据（字符串） | 是 |
| `retry` | 告诉客户端重连间隔（毫秒） | 否 |

### 3.3 客户端接收 SSE（JavaScript）

```javascript
const eventSource = new EventSource("/sse/basic");

// 监听默认 message 事件
eventSource.onmessage = (event) => {
    console.log("Received:", event.data);
};

// 监听自定义事件
eventSource.addEventListener("chat", (event) => {
    console.log("Chat message:", event.data);
});

// 监听连接打开
eventSource.onopen = () => {
    console.log("SSE connected");
};

// 监听错误
eventSource.onerror = (error) => {
    console.error("SSE error:", error);
    eventSource.close();  // 关闭连接
};
```

### 3.4 AI 流式输出（ChatGPT 风格）

```python
import asyncio
import json
from fastapi import FastAPI, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

app = FastAPI()

class ChatRequest(BaseModel):
    message: str
    model: str = "gpt-4"

@app.post("/chat/stream")
async def chat_stream(body: ChatRequest, request: Request):
    """模拟 AI 流式输出"""

    async def generate_response():
        # 模拟 AI 逐字输出
        response_text = f"你好！你说了：{body.message}。这是一个流式响应示例。"

        for i, char in enumerate(response_text):
            if await request.is_disconnected():
                break

            yield {
                "event": "message",
                "data": json.dumps({
                    "content": char,
                    "index": i,
                    "done": False
                }),
            }
            await asyncio.sleep(0.05)  # 模拟生成延迟

        # 发送完成信号
        yield {
            "event": "message",
            "data": json.dumps({
                "content": "",
                "index": len(response_text),
                "done": True
            }),
        }

    return EventSourceResponse(generate_response())
```

> [!warning] SSE 中必须有 `await asyncio.sleep()`
> 如果没有 `await`，`listen_for_disconnect` 无法检测到客户端断开，SSE 会一直发送数据。即使 sleep(0) 也可以，但建议设置一个合理的间隔。

### 3.5 多事件类型

```python
from fastapi import FastAPI, Request
from sse_starlette.sse import EventSourceResponse
import asyncio

app = FastAPI()

@app.get("/sse/multi-event")
async def multi_event_sse(request: Request):
    async def event_generator():
        # 进度事件
        for i in range(0, 101, 10):
            if await request.is_disconnected():
                break
            yield {
                "event": "progress",
                "data": str(i),
            }
            await asyncio.sleep(0.5)

        # 完成事件
        yield {
            "event": "complete",
            "data": '{"result": "Task completed"}',
        }

    return EventSourceResponse(event_generator())
```

客户端对应代码：

```javascript
const es = new EventSource("/sse/multi-event");

es.addEventListener("progress", (e) => {
    console.log("Progress:", e.data + "%");
});

es.addEventListener("complete", (e) => {
    console.log("Done:", JSON.parse(e.data));
    es.close();
});
```

---

## 4. 其他响应类型

### 4.1 HTML 响应

```python
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

@app.get("/html/", response_class=HTMLResponse)
async def get_html():
    return """
    <html>
        <body>
            <h1>Hello FastAPI</h1>
        </body>
    </html>
    """
```

### 4.2 文件响应

```python
from fastapi import FastAPI
from fastapi.responses import FileResponse

app = FastAPI()

@app.get("/download/")
async def download():
    return FileResponse(
        path="files/report.pdf",
        filename="report.pdf",           # 下载时的文件名
        media_type="application/pdf"
    )
```

### 4.3 重定向

```python
from fastapi import FastAPI
from fastapi.responses import RedirectResponse

app = FastAPI()

@app.get("/old-path/")
async def redirect():
    return RedirectResponse(url="/new-path/", status_code=301)
```

---

## 5. 响应对比总结

| 响应类型 | 内存占用 | 适用场景 | 并发能力 |
|---------|---------|---------|---------|
| JSONResponse | 高（一次性加载） | 普通 API | 一般 |
| StreamingResponse | 低（分块传输） | 大文件、日志 | 高 |
| EventSourceResponse | 低（持续连接） | 实时推送、AI 输出 | 受连接数限制 |
| FileResponse | 低（流式） | 文件下载 | 高 |

## 相关笔记

- 00-FastAPI学习总览 -- 学习路线索引
- 01-HTTP方法与CRUD操作 -- response_model 使用
- 02-请求参数详解 -- 请求体与响应模型配合
- 05-跨域请求CORS -- 跨域时的响应头配置
