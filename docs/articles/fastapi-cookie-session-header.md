---
title: "Cookie、Session、Header"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "Cookie", "Session", "Header", "认证"]
summary: "FastAPI中Cookie、Session和Header的使用方法，包括状态保持、认证令牌和自定义请求头处理。"
---

# Cookie、Session、Header

> 参考：[FastAPI 官方教程 - Cookie Parameters](https://fastapi.org.cn/learn/cookie-params/)、[Header Parameters](https://fastapi.org.cn/learn/header-params/)

## 概念对比

| 概念 | 存储位置 | 用途 | 生命周期 |
|------|---------|------|---------|
| **Cookie** | 客户端（浏览器） | 身份标识、偏好设置 | 可设置过期时间 |
| **Session** | 服务端（内存/Redis） | 用户会话数据、登录状态 | 会话结束或超时 |
| **Header** | 请求头 | 认证 Token、自定义元数据 | 单次请求 |

---

## 1. Cookie 参数

### 1.1 读取 Cookie

```python
from fastapi import FastAPI, Cookie
from typing import Optional

app = FastAPI()

@app.get("/items/")
async def read_items(ads_id: Optional[str] = Cookie(None)):
    return {"ads_id": ads_id}
```

> [!info] Cookie 参数声明
> Cookie 参数的声明方式与 Query、Path 参数相同。第一个值是默认值，后面可以跟验证参数。
> **注意**：Cookie 参数必须使用 `Cookie()` 声明，否则会被当作查询参数。

### 1.2 带验证的 Cookie

```python
from fastapi import Cookie

@app.get("/items/")
async def read_items(
    session_id: str = Cookie(
        ...,                           # 必填
        min_length=10,                 # 最小长度
        max_length=100,                # 最大长度
        description="会话ID"
    ),
    theme: str = Cookie("light")       # 可选，默认 "light"
):
    return {"session_id": session_id, "theme": theme}
```

### 1.3 设置 Cookie（在响应中）

```python
from fastapi import FastAPI, Response

app = FastAPI()

@app.post("/login/")
async def login(username: str, password: str, response: Response):
    # 验证逻辑...
    # 设置 Cookie
    response.set_cookie(
        key="session_id",
        value="abc123",
        max_age=3600,          # 过期时间（秒）
        httponly=True,          # 防止 JS 访问（XSS 防护）
        secure=True,           # 仅 HTTPS
        samesite="lax",        # CSRF 防护
        path="/",              # Cookie 作用路径
    )
    return {"message": "Login successful"}
```

### 1.4 删除 Cookie

```python
@app.post("/logout/")
async def logout(response: Response):
    response.delete_cookie("session_id")
    return {"message": "Logged out"}
```

### 1.5 Cookie 安全属性详解

| 属性 | 说明 | 推荐值 |
|------|------|--------|
| `httponly` | 禁止 JavaScript 通过 `document.cookie` 访问 | `True`（防 XSS） |
| `secure` | 仅通过 HTTPS 发送 | `True`（生产环境） |
| `samesite` | 限制跨站发送 Cookie | `"lax"` 或 `"strict"` |
| `max_age` | 过期时间（秒） | 根据业务设置 |
| `expires` | 过期时间（datetime） | 与 max_age 二选一 |
| `path` | Cookie 作用路径 | `"/"` |
| `domain` | Cookie 作用域名 | 通常不设置 |

> [!warning] 安全提示
> 永远不要在 Cookie 中存储敏感信息（密码、token 明文等）。Cookie 可以被客户端篡改。

---

## 2. Header 参数

### 2.1 读取 Header

```python
from fastapi import FastAPI, Header
from typing import Optional

app = FastAPI()

@app.get("/items/")
async def read_items(user_agent: Optional[str] = Header(None)):
    return {"User-Agent": user_agent}
```

> [!info] Header 名称转换
> HTTP Header 中使用连字符（`User-Agent`），Python 变量使用下划线（`user_agent`）。
> FastAPI 默认 `convert_underscores=True`，自动将下划线转为连字符。
> 如果需要禁用：`Header(None, convert_underscores=False)`

### 2.2 多个 Header 值

```python
from fastapi import Header

@app.get("/items/")
async def read_items(
    x_token: list[str] = Header(None)   # 接收多个同名 Header
):
    return {"X-Token values": x_token}

# 请求头：
# X-Token: token1
# X-Token: token2
# 响应：{"X-Token values": ["token1", "token2"]}
```

### 2.3 常见 Header 读取

```python
from fastapi import Header
from typing import Optional

@app.get("/info/")
async def get_info(
    user_agent: Optional[str] = Header(None),
    accept_language: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    x_forwarded_for: Optional[str] = Header(None),
    referer: Optional[str] = Header(None),
):
    return {
        "user_agent": user_agent,
        "accept_language": accept_language,
        "authorization": authorization,
        "client_ip": x_forwarded_for,
        "referer": referer,
    }
```

### 2.4 通过 Request 对象获取所有 Header

```python
from fastapi import FastAPI, Request

app = FastAPI()

@app.get("/headers/")
async def get_all_headers(request: Request):
    # request.headers 是一个类字典对象，包含所有请求头
    return dict(request.headers)
```

> [!tip] Request 对象
> 当需要访问更多请求信息时，可以声明 `request: Request` 参数（无需特殊导入），FastAPI 会自动注入：
> - `request.headers` -- 所有请求头
> - `request.query_params` -- 所有查询参数
> - `request.path_params` -- 所有路径参数
> - `request.cookies` -- 所有 Cookie
> - `request.client.host` -- 客户端 IP
> - `request.method` -- HTTP 方法
> - `request.url` -- 完整 URL

### 2.5 认证 Token（常见模式）

```python
from fastapi import Header, HTTPException

async def verify_token(authorization: str = Header(...)):
    """依赖注入：验证 Token"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    token = authorization.replace("Bearer ", "")
    # 验证 token 逻辑...
    return token

@app.get("/protected/")
async def protected_route(token: str = Depends(verify_token)):
    return {"message": "Access granted", "token": token}
```

---

## 3. Session 会话管理

FastAPI 基于 Starlette 的 `SessionMiddleware` 实现 Session 功能，数据存储在服务端（默认签名 Cookie）。

### 3.1 基础 Session 配置

```python
from fastapi import FastAPI, Request
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()

# 添加 Session 中间件
app.add_middleware(
    SessionMiddleware,
    secret_key="your-secret-key-change-in-production",  # 用于签名
    session_cookie="session",       # Cookie 名称
    max_age=3600,                   # 过期时间（秒）
    same_site="lax",               # CSRF 防护
    https_only=False,               # 生产环境设为 True
)
```

### 3.2 读写 Session 数据

```python
from fastapi import FastAPI, Request
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="your-secret-key")

@app.post("/login/")
async def login(request: Request, username: str, password: str):
    # 验证逻辑...
    # 写入 Session
    request.session["user_id"] = 123
    request.session["username"] = username
    return {"message": f"Welcome {username}"}

@app.get("/profile/")
async def profile(request: Request):
    # 读取 Session
    user_id = request.session.get("user_id")
    username = request.session.get("username")

    if not user_id:
        return {"error": "Not logged in"}

    return {"user_id": user_id, "username": username}

@app.post("/logout/")
async def logout(request: Request):
    # 清除 Session
    request.session.clear()
    return {"message": "Logged out"}
```

### 3.3 Redis 存储 Session

默认 Session 存储在签名 Cookie 中（数据量小）。大量 Session 数据应使用 Redis 存储：

```bash
pip install starlette-session redis
```

```python
from fastapi import FastAPI, Request
from redis import Redis
from starlette_session import SessionMiddleware
from starlette_session.backends import BackendType

app = FastAPI()

# Redis 客户端
redis_client = Redis(host="127.0.0.1", port=6379, db=0, decode_responses=True)

# 使用 Redis 作为 Session 存储
app.add_middleware(
    SessionMiddleware,
    secret_key="your-secret-key",
    cookie_name="session",
    backend_type=BackendType.redis,
    backend_client=redis_client,
)

@app.get("/set-session/")
async def set_session(request: Request):
    request.session["data"] = "stored in redis"
    return {"message": "Session saved to Redis"}

@app.get("/get-session/")
async def get_session(request: Request):
    data = request.session.get("data", "No data")
    return {"data": data}
```

> [!tip] Session 存储方案对比
> | 方案 | 适用场景 | 数据量 | 持久化 |
> |------|---------|--------|--------|
> | 签名 Cookie（默认） | 简单应用 | < 4KB | 否 |
> | 内存 | 开发测试 | 不限 | 否 |
> | Redis | 生产环境（推荐） | 不限 | 是 |
> | 数据库 | 需要审计 | 不限 | 是 |

---

## 4. 实战：完整的登录认证流程

```python
from fastapi import FastAPI, Request, Header, HTTPException, Depends
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="change-me-in-production")

# 模拟用户数据库
fake_users_db = {
    "admin": {"username": "admin", "password": "admin123", "role": "admin"},
    "user1": {"username": "user1", "password": "pass123", "role": "user"},
}

class LoginRequest(BaseModel):
    username: str
    password: str

# ---- 登录 ----
@app.post("/login/")
async def login(request: Request, body: LoginRequest):
    user = fake_users_db.get(body.username)
    if not user or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    request.session["user"] = {
        "username": user["username"],
        "role": user["role"]
    }
    return {"message": f"Welcome {user['username']}"}

# ---- 获取当前用户（依赖注入） ----
async def get_current_user(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ---- 受保护的路由 ----
@app.get("/me/")
async def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}

# ---- 权限检查 ----
async def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user

@app.get("/admin/")
async def admin_page(admin: dict = Depends(require_admin)):
    return {"message": "Admin dashboard", "admin": admin}

# ---- 登出 ----
@app.post("/logout/")
async def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out"}
```

---

## 5. 常见错误排查

### 错误 1：Cookie 参数未被识别

```
原因：未使用 Cookie() 声明，被当作查询参数
解决：session_id: str = Cookie(None)  # 必须用 Cookie()
```

### 错误 2：Header 名称不匹配

```
原因：HTTP Header User-Agent 被转换为 user_agent
FastAPI 默认 convert_underscores=True（下划线转连字符）
```

### 错误 3：Session 数据丢失

```
原因：secret_key 太简单或每次重启变化
解决：使用固定的、足够复杂的 secret_key
生产环境：通过环境变量注入
```

## 相关笔记

- 00-FastAPI学习总览 -- 学习路线索引
- 02-请求参数详解 -- 路径参数与查询参数
- 04-响应处理 -- 响应模型与状态码
- 05-跨域请求CORS -- 跨域与 Cookie 配合
- 07-Redis集成 -- Redis 存储 Session
