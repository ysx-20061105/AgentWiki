---
title: "跨域请求 CORS"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "CORS", "跨域", "安全"]
summary: "FastAPI跨域请求CORS配置指南，讲解CORS原理、中间件配置及生产环境安全策略。"
---

# 跨域请求 CORS

> 参考：[FastAPI 官方教程 - CORS](https://fastapi.org.cn/learn/cors/)

## 什么是跨域

**同源策略**：浏览器的安全策略，限制不同源（协议、域名、端口）之间的请求。

```
同源判断三要素：协议 + 域名 + 端口

http://localhost:3000  →  http://localhost:8000  ✗ 跨域（端口不同）
http://example.com     →  https://example.com    ✗ 跨域（协议不同）
http://a.com           →  http://b.com           ✗ 跨域（域名不同）
http://localhost:3000  →  http://localhost:3000  ✓ 同源
```

> [!info] 前后端分离必须配置 CORS
> 当前端（如 React/Vue 在 `localhost:5173`）请求后端（FastAPI 在 `localhost:8000`）时，端口不同即为跨域，浏览器会拦截请求。必须在后端配置 CORS 允许跨域。

## CORS 工作流程

```
1. 浏览器发送预检请求（Preflight Request）
   OPTIONS /api/items HTTP/1.1
   Origin: http://localhost:5173
   Access-Control-Request-Method: POST
   Access-Control-Request-Headers: Content-Type

2. 服务器响应 CORS 头
   Access-Control-Allow-Origin: http://localhost:5173
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE
   Access-Control-Allow-Headers: Content-Type, Authorization

3. 浏览器验证通过后，发送实际请求
   POST /api/items HTTP/1.1
   Origin: http://localhost:5173
   Content-Type: application/json
```

> [!info] 预检请求触发条件
> 满足以下任一条件时，浏览器会先发送 OPTIONS 预检请求：
> - 使用了除 GET、POST、HEAD 之外的 HTTP 方法（如 PUT、DELETE）
> - 设置了自定义请求头（如 Authorization）
> - Content-Type 为 `application/json`

---

## 1. FastAPI CORS 配置

### 1.1 允许所有源（开发环境）

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # 允许所有源
    allow_credentials=True,        # 允许携带 Cookie
    allow_methods=["*"],           # 允许所有 HTTP 方法
    allow_headers=["*"],           # 允许所有请求头
)

@app.get("/api/items")
async def get_items():
    return {"items": ["foo", "bar"]}
```

> [!warning] `allow_origins=["*"]` 与 `allow_credentials=True` 不能同时使用
> 当 `allow_credentials=True` 时，`allow_origins` 不能是 `["*"]`，必须指定具体的源。这是 CORS 规范的安全限制。

### 1.2 指定允许的源（生产环境，推荐）

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 配置允许的源列表
origins = [
    "http://localhost:5173",        # 本地开发（Vite）
    "http://localhost:3000",        # 本地开发（CRA）
    "https://your-frontend.com",   # 生产环境前端域名
    "https://www.your-frontend.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # 指定允许的源
    allow_credentials=True,         # 允许携带 Cookie
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # 指定允许的方法
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "X-Requested-With",
    ],                              # 指定允许的请求头
    expose_headers=["X-Custom-Header"],  # 允许前端访问的响应头
    max_age=600,                    # 预检请求缓存时间（秒）
)
```

### 1.3 CORS 中间件参数详解

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `allow_origins` | `list[str]` | 允许的源列表 | `[]` |
| `allow_credentials` | `bool` | 是否允许携带 Cookie | `False` |
| `allow_methods` | `list[str]` | 允许的 HTTP 方法 | `["GET"]` |
| `allow_headers` | `list[str]` | 允许的请求头 | `[]` |
| `expose_headers` | `list[str]` | 前端可读取的响应头 | `[]` |
| `max_age` | `int` | 预检缓存时间（秒） | `600` |

### 1.4 环境变量配置

```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 从环境变量读取允许的源
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

is_dev = os.getenv("ENV", "development") == "development"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_dev else ALLOWED_ORIGINS,
    allow_credentials=not is_dev,   # 开发环境不携带凭证
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400 if not is_dev else 0,
)
```

---

## 2. CORS 与 Cookie 配合

### 2.1 跨域 Cookie 设置

```python
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 必须是具体源，不能是 *
    allow_credentials=True,                   # 允许携带 Cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/login/")
async def login(response: Response, username: str, password: str):
    response.set_cookie(
        key="session_id",
        value="abc123",
        httponly=True,
        secure=False,          # 开发环境设为 False
        samesite="none",       # 跨域必须设为 "none"
        max_age=3600,
    )
    return {"message": "Logged in"}
```

> [!warning] 跨域 Cookie 注意事项
> 1. `allow_origins` 不能是 `["*"]`，必须指定具体源
> 2. `allow_credentials` 必须设为 `True`
> 3. Cookie 的 `samesite` 应设为 `"none"`
> 4. Cookie 的 `secure` 在 HTTPS 环境必须为 `True`
> 5. 前端请求必须设置 `credentials: "include"`

### 2.2 前端 Fetch 配置

```javascript
fetch("http://localhost:8000/login/", {
    method: "POST",
    credentials: "include",  // 携带 Cookie
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({ username: "admin", password: "123" }),
});
```

---

## 3. CORS 错误排查

### 常见错误信息

```
Access to fetch at 'http://localhost:8000/api' from origin
'http://localhost:5173' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### 排查清单

```
1. 确认 CORSMiddleware 是否已添加（app.add_middleware）
2. 确认 allow_origins 是否包含前端域名（含端口）
3. 确认 allow_methods 是否包含使用的 HTTP 方法
4. 确认 allow_headers 是否包含自定义请求头
5. 确认 CORS 中间件是否在路由之前添加
6. 确认代理配置（如 Nginx）是否转发了 CORS 头
7. 确认是否有多个 CORS 中间件冲突
```

### 代理方案（开发环境替代方案）

```javascript
// vite.config.ts
export default defineConfig({
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ""),
            },
        },
    },
});
```

代理方案绕过 CORS 限制：前端请求 `/api/items` → 代理转发到 `http://localhost:8000/items` → 对浏览器来说是同源请求。

---

## 4. 安全最佳实践

```
生产环境 CORS 配置原则：
- 不要使用 allow_origins=["*"]，明确列出允许的域名
- allow_methods 只列出实际使用的方法
- allow_headers 只列出需要的请求头
- 设置合理的 max_age 减少预检请求
- 如果不需要 Cookie，不要设置 allow_credentials=True
- 配合 HTTPS 使用
```

## 相关笔记

- 00-FastAPI学习总览 -- 学习路线索引
- 03-Cookie-Session-Header -- Cookie 跨域设置
- 08-部署 -- Nginx 反向代理与 CORS
