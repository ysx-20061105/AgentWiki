---
title: "HTTP 方法与 CRUD 操作"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "HTTP", "CRUD"]
summary: "FastAPI中HTTP方法与CRUD操作的对应关系，包括GET/POST/PUT/DELETE的完整实现与最佳实践。"
---

# HTTP 方法与 CRUD 操作

> 参考：[FastAPI 官方教程 - First Steps](https://fastapi.org.cn/learn/first-steps/)

## HTTP 方法与 CRUD 对应关系

| HTTP 方法 | CRUD 操作 | 用途 | 幂等性 | 常见状态码 |
|-----------|-----------|------|--------|-----------|
| `GET` | Read（查询） | 获取资源列表或单个资源 | 是 | 200 |
| `POST` | Create（创建） | 创建新资源 | 否 | 201 |
| `PUT` | Update（完整更新） | 替换整个资源 | 是 | 200 |
| `PATCH` | Update（部分更新） | 只更新部分字段 | 是 | 200 |
| `DELETE` | Delete（删除） | 删除资源 | 是 | 204 |

> [!info] 幂等性
> **幂等**：多次执行同一操作，结果与执行一次相同。GET/PUT/DELETE 是幂等的，POST 不是（每次创建新资源）。

---

## 1. GET -- 查询资源

### 1.1 获取单个资源（路径参数）

```python
@app.get("/items/{item_id}")
async def read_item(item_id: int):
    return {"item_id": item_id}
```

> [!tip] `async def` vs `def`
> - 使用 `async def`：函数体内没有阻塞 I/O
> - 使用 `def`：函数体内有阻塞 I/O（如传统同步数据库驱动），FastAPI 会自动放到线程池中执行

### 1.2 获取资源列表（查询参数）

```python
@app.get("/items/")
async def read_items(skip: int = 0, limit: int = 10):
    return {"skip": skip, "limit": limit}
```

> [!warning] 路径末尾斜杠
> `/items/` 和 `/items` 是两个不同的路径。建议保持一致，带斜杠表示集合资源。

### 1.3 带响应模型的 GET

```python
from pydantic import BaseModel

class ItemResponse(BaseModel):
    id: int
    name: str
    price: float

@app.get("/items/{item_id}", response_model=ItemResponse)
async def read_item(item_id: int):
    # response_model 自动过滤掉不在模型中的字段
    return {"id": item_id, "name": "Foo", "price": 42.0, "secret": "hidden"}
    # "secret" 不会出现在响应中
```

---

## 2. POST -- 创建资源

### 2.1 基础 POST 请求

```python
from pydantic import BaseModel

class ItemCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None

items_db: dict[int, dict] = {}
current_id = 0

@app.post("/items/", status_code=201)
async def create_item(item: ItemCreate):
    global current_id
    current_id += 1
    item_dict = item.model_dump()
    item_dict["id"] = current_id
    items_db[current_id] = item_dict
    return {"message": "Item created", "data": item_dict}
```

### 2.2 POST + 路径参数 + 查询参数

```python
@app.post("/users/{user_id}/items/")
async def create_item_for_user(
    user_id: int,           # 路径参数
    item: ItemCreate,       # 请求体（Pydantic 模型）
    notify: bool = True     # 查询参数（简单类型，不在路径中）
):
    return {
        "user_id": user_id,
        "item": item.model_dump(),
        "notify": notify
    }
```

> [!info] 参数来源自动识别
> FastAPI 自动推断：`{user_id}` 在路径中 → 路径参数；`notify: bool` 是简单类型且不在路径中 → 查询参数；`item: ItemCreate` 是 Pydantic 模型 → 请求体

---

## 3. PUT -- 完整更新资源

```python
from fastapi import HTTPException

class ItemUpdate(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None

@app.put("/items/{item_id}")
async def update_item(item_id: int, item: ItemUpdate):
    if item_id not in items_db:
        raise HTTPException(status_code=404, detail="Item not found")

    item_dict = item.model_dump()
    item_dict["id"] = item_id
    items_db[item_id] = item_dict
    return {"message": "Item updated", "data": item_dict}
```

> [!warning] PUT vs PATCH
> - **PUT**：完整替换资源，客户端发送资源的所有字段
> - **PATCH**：部分更新，只发送需要修改的字段

---

## 4. PATCH -- 部分更新资源

```python
class ItemPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = None
    tax: float | None = None

@app.patch("/items/{item_id}")
async def patch_item(item_id: int, item: ItemPatch):
    if item_id not in items_db:
        raise HTTPException(status_code=404, detail="Item not found")

    stored_item = items_db[item_id]
    # 只更新客户端显式传递的字段
    update_data = item.model_dump(exclude_unset=True)
    updated_item = {**stored_item, **update_data}  # 不可变更新
    items_db[item_id] = updated_item
    return {"message": "Item patched", "data": updated_item}
```

> [!tip] `exclude_unset=True`
> 使用 `model_dump(exclude_unset=True)` 只包含客户端显式传递的字段，未传递的字段不会被包含在更新字典中。

---

## 5. DELETE -- 删除资源

```python
@app.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: int):
    if item_id not in items_db:
        raise HTTPException(status_code=404, detail="Item not found")
    del items_db[item_id]
    return None  # 204 No Content
```

### DELETE 的几种响应模式

```python
# 方式 1：204 No Content（推荐，无响应体）
@app.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: int):
    del items_db[item_id]
    return None

# 方式 2：返回删除确认信息（200 OK）
@app.delete("/items/{item_id}")
async def delete_item(item_id: int):
    del items_db[item_id]
    return {"message": f"Item {item_id} deleted"}

# 方式 3：返回删除的资源内容
@app.delete("/items/{item_id}", response_model=ItemResponse)
async def delete_item(item_id: int):
    item = items_db.pop(item_id)
    return item
```

---

## 错误处理

FastAPI 使用 `HTTPException` 处理业务错误：

```python
from fastapi import FastAPI, HTTPException

@app.get("/items/{item_id}")
async def read_item(item_id: int):
    if item_id not in items_db:
        raise HTTPException(
            status_code=404,
            detail="Item not found",
            headers={"X-Error": "ItemNotFoundError"}  # 可选自定义头
        )
    return items_db[item_id]
```

### 常用 HTTP 状态码

| 状态码 | 含义 | 使用场景 |
|--------|------|---------|
| 200 | OK | 成功（GET、PUT、PATCH） |
| 201 | Created | 创建成功（POST） |
| 204 | No Content | 删除成功（DELETE） |
| 400 | Bad Request | 请求格式错误 |
| 401 | Unauthorized | 未认证 |
| 403 | Forbidden | 无权限 |
| 404 | Not Found | 资源不存在 |
| 422 | Unprocessable Entity | 参数验证失败（FastAPI 自动） |
| 500 | Internal Server Error | 服务器内部错误 |

> [!tip] 422 是 FastAPI 的默认行为
> 当 Pydantic 模型验证失败时，FastAPI 自动返回 422 状态码和详细的错误信息，无需手动处理。

---

## 完整 CRUD 汇总

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Items API")

class ItemCreate(BaseModel):
    name: str
    price: float
    description: Optional[str] = None

class ItemResponse(BaseModel):
    id: int
    name: str
    price: float
    description: Optional[str] = None

db: dict[int, dict] = {}
next_id = 0

# CREATE
@app.post("/items/", response_model=ItemResponse, status_code=201)
async def create_item(item: ItemCreate):
    global next_id
    next_id += 1
    item_data = {**item.model_dump(), "id": next_id}
    db[next_id] = item_data
    return item_data

# READ - 列表
@app.get("/items/", response_model=list[ItemResponse])
async def list_items(skip: int = 0, limit: int = 10):
    return list(db.values())[skip:skip + limit]

# READ - 单个
@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int):
    if item_id not in db:
        raise HTTPException(status_code=404, detail="Item not found")
    return db[item_id]

# UPDATE (PUT)
@app.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, item: ItemCreate):
    if item_id not in db:
        raise HTTPException(status_code=404, detail="Item not found")
    item_data = {**item.model_dump(), "id": item_id}
    db[item_id] = item_data
    return item_data

# DELETE
@app.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: int):
    if item_id not in db:
        raise HTTPException(status_code=404, detail="Item not found")
    del db[item_id]
    return None
```

## 相关笔记

- 00-FastAPI学习总览 -- 学习路线索引
- 02-请求参数详解 -- 深入路径参数与查询参数
- 04-响应处理 -- 响应模型与流式响应
