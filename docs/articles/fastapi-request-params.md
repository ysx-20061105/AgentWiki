---
title: "请求参数详解"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "参数", "Pydantic"]
summary: "FastAPI请求参数详解，涵盖路径参数、查询参数、请求体、嵌套模型等参数类型的使用方法。"
---

# 请求参数详解

> 参考：[FastAPI 官方教程 - Path Parameters](https://fastapi.org.cn/learn/path-params/)、[Query Parameters](https://fastapi.org.cn/learn/query-params/)、[Body](https://fastapi.org.cn/learn/body/)、[Form Data](https://fastapi.org.cn/learn/request-forms/)

## 参数来源总览

FastAPI 通过函数签名中的**类型注解**和**声明方式**自动推断参数来源：

```
客户端请求
│
├── 路径参数 Path Parameters
│   └── /items/{item_id}  →  item_id 与路径中 {item_id} 匹配
│
├── 查询参数 Query Parameters
│   └── /items?skip=0&limit=10  →  不在路径中的简单类型
│
├── 请求体 Request Body
│   └── JSON Body  →  Pydantic BaseModel
│
├── 表单参数 Form Data
│   └── application/x-www-form-urlencoded  →  Form()
│
├── 文件上传
│   └── multipart/form-data  →  File() / UploadFile
│
├── Header / Cookie
│   └── 使用 Header(), Cookie() 显式声明 → 03-Cookie-Session-Header
│
└── 依赖注入
    └── Depends() 声明
```

---

## 1. 路径参数（Path Parameters）

路径参数是 URL 路径的一部分，用 `{}` 声明。

### 1.1 基础用法

```python
@app.get("/items/{item_id}")
async def read_item(item_id: int):
    return {"item_id": item_id}

# 请求：GET /items/42
# 响应：{"item_id": 42}
```

> [!info] 类型自动转换
> `item_id: int` 声明了类型为 `int`。FastAPI 会自动将路径中的字符串 `"42"` 转换为整数 `42`。如果传入 `"/items/foo"` 则返回 422 错误（类型不匹配）。

### 1.2 支持的路径参数类型

```python
# 整数
@app.get("/items/{item_id}")
async def get_item(item_id: int): ...

# 浮点数
@app.get("/weights/{weight}")
async def get_weight(weight: float): ...

# 字符串
@app.get("/users/{username}")
async def get_user(username: str): ...

# 枚举类型（限定可选值）
from enum import Enum

class ModelName(str, Enum):
    alexnet = "alexnet"
    resnet = "resnet"
    lenet = "lenet"

@app.get("/models/{model_name}")
async def get_model(model_name: ModelName):
    if model_name == ModelName.alexnet:
        return {"model_name": model_name, "message": "Deep Learning FTW!"}
    return {"model_name": model_name}

# 请求：GET /models/alexnet  →  OK
# 请求：GET /models/other    →  422 错误
```

### 1.3 路径参数验证 -- 使用 Path()

```python
from fastapi import Path

@app.get("/items/{item_id}")
async def read_item(
    item_id: int = Path(..., gt=0, title="Item ID", description="必须大于0的整数")
):
    return {"item_id": item_id}
```

**Path() 常用参数：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `...` | 表示必填参数 | `Path(...)` |
| `gt` / `ge` | Greater Than / Greater or Equal | `gt=0` / `ge=1` |
| `lt` / `le` | Less Than / Less or Equal | `lt=100` / `le=100` |
| `title` | 参数标题（文档用） | `title="Item ID"` |
| `description` | 参数描述（文档用） | `description="数据库中的ID"` |
| `min_length` / `max_length` | 字符串长度限制 | `min_length=3` |
| `pattern` | 正则匹配 | `pattern="^[a-z]+$"` |

### 1.4 多个路径参数

```python
@app.get("/users/{user_id}/items/{item_id}")
async def read_user_item(user_id: int, item_id: int):
    return {"user_id": user_id, "item_id": item_id}

# 请求：GET /users/3/items/7
# 响应：{"user_id": 3, "item_id": 7}
```

### 1.5 路径顺序问题

```python
# 正确顺序：固定路径在前，动态路径在后
@app.get("/users/me")
async def read_user_me():
    return {"user_id": "current user"}

@app.get("/users/{user_id}")
async def read_user(user_id: int):
    return {"user_id": user_id}
```

> [!warning] 路径顺序重要
> 固定路径（如 `/users/me`）必须在动态路径（如 `/users/{user_id}`）之前声明，否则 `"me"` 会被当作 `{user_id}` 匹配。

---

## 2. 查询参数（Query Parameters）

查询参数是 URL 中 `?` 后面的键值对。不在路径中声明的函数参数即为查询参数。

### 2.1 基础用法

```python
@app.get("/items/")
async def read_items(skip: int = 0, limit: int = 10):
    return {"skip": skip, "limit": limit}

# 请求：GET /items/         →  {"skip": 0, "limit": 10}
# 请求：GET /items/?skip=20  →  {"skip": 20, "limit": 10}
```

> [!tip] 有默认值 vs 无默认值
> - `skip: int = 0` → **可选**，不传时使用默认值
> - `skip: int` → **必填**，不传时返回 422 错误

### 2.2 必填查询参数

```python
@app.get("/items/{item_id}")
async def read_item(item_id: int, needy: str):
    # item_id 是路径参数（在路径中声明）
    # needy 是必填查询参数（没有默认值且不在路径中）
    return {"item_id": item_id, "needy": needy}

# 请求：GET /items/42?needy=hello  →  OK
# 请求：GET /items/42              →  422 错误
```

### 2.3 可选查询参数

```python
@app.get("/items/")
async def read_items(q: str | None = None):
    if q:
        return {"q": q, "filtered": True}
    return {"q": q, "filtered": False}

# 请求：GET /items/          →  {"q": null, "filtered": false}
# 请求：GET /items/?q=foo    →  {"q": "foo", "filtered": true}
```

### 2.4 布尔查询参数

FastAPI 自动识别布尔类型，支持多种布尔值格式：

```python
@app.get("/items/")
async def read_items(active: bool = True):
    return {"active": active}

# 以下均表示 active=True:
# GET /items/?active=True / true / 1 / on / yes
# 以下均表示 active=False:
# GET /items/?active=False / false / 0 / off / no
```

### 2.5 查询参数验证 -- 使用 Query()

```python
from fastapi import Query

@app.get("/items/")
async def read_items(
    q: str | None = Query(
        None,                  # 默认值 None（可选）
        min_length=3,          # 最小长度
        max_length=50,         # 最大长度
        pattern="^fixedquery$",  # 正则匹配
        title="Query string",    # 文档标题
        description="搜索关键词"  # 文档描述
    ),
    skip: int = Query(0, ge=0),          # 必须 >= 0
    limit: int = Query(10, ge=1, le=100) # 必须在 1-100 之间
):
    return {"q": q, "skip": skip, "limit": limit}
```

**Query() 常用参数：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `default` / `...` | 默认值或必填 | `Query(None)` / `Query(...)` |
| `alias` | 别名 | `Query(None, alias="item-query")` |
| `title` / `description` | 文档用 | `title="搜索词"` |
| `min_length` / `max_length` | 长度限制 | `min_length=1` |
| `pattern` | 正则匹配 | `pattern="^[a-zA-Z]+$"` |
| `gt` / `ge` / `lt` / `le` | 数值范围 | `gt=0` |
| `deprecated` | 标记为已弃用 | `deprecated=True` |

### 2.6 查询参数列表（多个值）

```python
@app.get("/items/")
async def read_items(q: list[str] | None = Query(None)):
    # GET /items/?q=foo&q=bar  →  q = ["foo", "bar"]
    return {"q": q}
```

---

## 3. 请求体（Request Body）

请求体用于发送结构化数据，通过 Pydantic BaseModel 声明。

### 3.1 基础请求体

```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None

@app.post("/items/")
async def create_item(item: Item):
    # FastAPI 自动解析 JSON 请求体并验证
    item_dict = item.model_dump()
    if item.tax:
        price_with_tax = item.price + item.tax
        item_dict.update({"price_with_tax": price_with_tax})
    return item_dict
```

客户端发送 JSON：

```bash
curl -X POST http://localhost:8000/items/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Foo", "price": 42.0, "tax": 3.5}'
```

### 3.2 路径参数 + 查询参数 + 请求体混合

```python
@app.put("/items/{item_id}")
async def update_item(
    item_id: int,           # 路径参数
    item: Item,             # 请求体
    q: str | None = None    # 查询参数
):
    return {
        "item_id": item_id,
        "query": q,
        "updated": item.model_dump()
    }
```

### 3.3 多个请求体参数

```python
class User(BaseModel):
    username: str
    full_name: str | None = None

class Item(BaseModel):
    name: str
    price: float

@app.post("/items/{item_id}")
async def update_item(item_id: int, item: Item, user: User):
    # item 和 user 都在请求体中，JSON 结构为：
    # {
    #     "item": {"name": "Foo", "price": 42.0},
    #     "user": {"username": "john", "full_name": "John Doe"}
    # }
    return {"item_id": item_id, "item": item, "user": user}
```

### 3.4 嵌套模型

```python
from pydantic import BaseModel, HttpUrl

class Image(BaseModel):
    url: HttpUrl
    name: str

class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None
    tags: set[str] = set()          # 自动去重
    image: Image | None = None      # 嵌套模型

@app.post("/items/")
async def create_item(item: Item):
    return item
```

---

## 4. 表单参数（Form Data）

当需要接收 `application/x-www-form-urlencoded` 或 `multipart/form-data` 格式的数据时使用。

> [!warning] 安装依赖
> 使用表单参数需要安装：`pip install python-multipart`

### 4.1 基础表单参数

```python
from fastapi import FastAPI, Form

app = FastAPI()

@app.post("/login/")
async def login(username: str = Form(...), password: str = Form(...)):
    return {"username": username}
```

> [!info] 为什么不用 BaseModel？
> 表单数据不是 JSON，而是 `key=value` 格式。FastAPI 使用 `Form()` 而不是 Pydantic BaseModel 来处理表单参数。`Form()` 和 `Query()`、`Path()`、`Cookie()` 是同一系列，都继承自 `Param`。

### 4.2 表单参数验证

```python
from fastapi import Form

@app.post("/login/")
async def login(
    username: str = Form(..., min_length=3, max_length=50),
    password: str = Form(..., min_length=6),
    remember: bool = Form(False),      # 可选，默认 False
):
    return {"username": username, "remember": remember}
```

### 4.3 文件上传

```python
from fastapi import File, UploadFile

# 方式 1：使用 bytes（适合小文件，一次性读入内存）
@app.post("/files/")
async def create_file(file: bytes = File(...)):
    return {"file_size": len(file)}

# 方式 2：使用 UploadFile（推荐，支持大文件流式读取）
@app.post("/upload/")
async def upload_file(file: UploadFile):
    # UploadFile 属性：
    # file.filename   → 原始文件名
    # file.content_type → MIME 类型
    # file.size       → 文件大小（可选）
    contents = await file.read()      # 读取文件内容
    await file.seek(0)                # 回到文件开头
    await file.close()                # 关闭文件

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents)
    }
```

### 4.4 多文件上传

```python
from fastapi import File, UploadFile

@app.post("/upload-multiple/")
async def upload_multiple(files: list[UploadFile] = File(...)):
    return [
        {"filename": f.filename, "content_type": f.content_type}
        for f in files
    ]
```

### 4.5 表单 + 文件混合上传

```python
from fastapi import Form, File, UploadFile

@app.post("/submit/")
async def submit_form(
    title: str = Form(...),
    description: str = Form(None),
    file: UploadFile = File(...)
):
    return {
        "title": title,
        "description": description,
        "filename": file.filename
    }
```

---

## 5. 核心对比总结

### 路径参数 vs 查询参数 vs 请求体 vs 表单

| 特性 | 路径参数 | 查询参数 | 请求体 | 表单参数 |
|------|---------|---------|--------|---------|
| URL 位置 | `/items/{id}` | `?key=value` | 不在 URL 中 | 不在 URL 中 |
| 声明方式 | `Path()` / `{}` | `Query()` / 默认参数 | `BaseModel` | `Form()` |
| Content-Type | - | - | `application/json` | `form-urlencoded` / `multipart` |
| 验证工具 | `Path()` | `Query()` | Pydantic | `Form()` |
| 用途 | 标识特定资源 | 过滤、排序、分页 | 创建/更新数据 | 登录、传统表单 |

### `Path()` vs `Query()` vs `Form()` vs `Body()` 对比

| 功能 | Path() | Query() | Form() | Body() |
|------|--------|---------|--------|--------|
| 参数来源 | URL 路径 | URL 查询串 | 表单数据 | JSON 请求体 |
| `gt`, `ge`, `lt`, `le` | 支持 | 支持 | 支持 | 支持 |
| `min_length`, `max_length` | 支持 | 支持 | 支持 | 支持 |
| `pattern` | 支持 | 支持 | 支持 | 支持 |
| `alias` | 支持 | 支持 | 支持 | 支持 |

---

## 6. 常见错误排查

### 错误 1：422 Unprocessable Entity

```
原因：参数类型不匹配或缺少必填参数
解决：检查类型声明，查看 /docs 中的参数定义
```

### 错误 2：路径参数未被识别

```python
# 错误：item_id 被当作查询参数
@app.get("/items/")
async def read_item(item_id: int): ...

# 正确：在路径中声明
@app.get("/items/{item_id}")
async def read_item(item_id: int): ...
```

### 错误 3：表单参数报 422

```
原因：未安装 python-multipart
解决：pip install python-multipart
```

## 相关笔记

- 00-FastAPI学习总览 -- 学习路线索引
- 01-HTTP方法与CRUD操作 -- GET/POST/PUT/DELETE 详解
- 03-Cookie-Session-Header -- Cookie 和 Header 参数
- 06-SQLAlchemy集成 -- 数据库模型与请求体结合
