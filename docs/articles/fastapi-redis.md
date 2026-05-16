---
title: "Redis 集成"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "Redis", "缓存", "异步"]
summary: "FastAPI与Redis集成指南，包括缓存、会话管理、分布式锁和消息队列等常见使用场景。"
---

# Redis 集成

> Redis 在 FastAPI 中常用于：缓存、Session 存储、消息队列、限流计数器、分布式锁。

## 安装

```bash
# 推荐：使用 redis-py 的异步模式（官方推荐）
pip install redis

# 或使用 aioredis（独立异步库，redis-py 4.2+ 已合并 aioredis 功能）
pip install aioredis
```

> [!tip] redis-py vs aioredis
> redis-py 4.2+ 已内置异步支持（`redis.asyncio`），无需单独安装 aioredis。新项目推荐直接使用 `redis.asyncio`。

---

## 1. 异步 Redis 连接管理

### 1.1 使用 lifespan 管理连接生命周期（推荐）

```python
import redis.asyncio as aioredis
from fastapi import FastAPI, Depends, Request
from contextlib import asynccontextmanager

# Redis 配置
REDIS_URL = "redis://localhost:6379/0"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时：创建 Redis 连接
    app.state.redis = aioredis.from_url(
        REDIS_URL,
        encoding="utf-8",
        decode_responses=True,  # 自动解码为字符串
    )
    yield
    # 关闭时：断开 Redis 连接
    await app.state.redis.close()

app = FastAPI(lifespan=lifespan)


def get_redis(request: Request) -> aioredis.Redis:
    """依赖注入：获取 Redis 客户端"""
    return request.app.state.redis
```

> [!info] lifespan 替代 on_event
> FastAPI 推荐使用 `lifespan` 上下文管理器替代已弃用的 `@app.on_event("startup")` 和 `@app.on_event("shutdown")`。

### 1.2 使用 on_event（兼容旧代码）

```python
import redis.asyncio as aioredis
from fastapi import FastAPI

app = FastAPI()

@app.on_event("startup")
async def startup():
    app.state.redis = aioredis.from_url(
        "redis://localhost:6379/0",
        encoding="utf-8",
        decode_responses=True,
    )

@app.on_event("shutdown")
async def shutdown():
    await app.state.redis.close()
```

---

## 2. 基础 Redis 操作

### 2.1 String 操作

```python
from fastapi import FastAPI, Depends, Request
import redis.asyncio as aioredis

app = FastAPI()

def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis

# ---- 设置值 ----
@app.post("/cache/{key}")
async def set_cache(key: str, value: str, redis: aioredis.Redis = Depends(get_redis)):
    await redis.set(key, value, ex=3600)  # ex=3600 过期时间（秒）
    return {"key": key, "value": value, "ttl": 3600}

# ---- 获取值 ----
@app.get("/cache/{key}")
async def get_cache(key: str, redis: aioredis.Redis = Depends(get_redis)):
    value = await redis.get(key)
    if value is None:
        return {"error": "Key not found"}
    return {"key": key, "value": value}

# ---- 删除值 ----
@app.delete("/cache/{key}")
async def delete_cache(key: str, redis: aioredis.Redis = Depends(get_redis)):
    deleted = await redis.delete(key)
    return {"key": key, "deleted": deleted > 0}

# ---- 设置过期时间 ----
@app.post("/cache/{key}/expire")
async def set_expire(key: str, seconds: int, redis: aioredis.Redis = Depends(get_redis)):
    await redis.expire(key, seconds)
    ttl = await redis.ttl(key)
    return {"key": key, "ttl": ttl}
```

### 2.2 Hash 操作

```python
@app.post("/hash/{name}")
async def set_hash(name: str, key: str, value: str, redis: aioredis.Redis = Depends(get_redis)):
    await redis.hset(name, key, value)
    return {"name": name, "key": key, "value": value}

@app.get("/hash/{name}")
async def get_hash(name: str, redis: aioredis.Redis = Depends(get_redis)):
    data = await redis.hgetall(name)
    return {"name": name, "data": data}

@app.get("/hash/{name}/{key}")
async def get_hash_field(name: str, key: str, redis: aioredis.Redis = Depends(get_redis)):
    value = await redis.hget(name, key)
    return {"name": name, "key": key, "value": value}
```

### 2.3 List 操作

```python
@app.post("/list/{name}/push")
async def list_push(name: str, value: str, redis: aioredis.Redis = Depends(get_redis)):
    length = await redis.rpush(name, value)
    return {"name": name, "length": length}

@app.get("/list/{name}")
async def list_get(name: str, start: int = 0, end: int = -1, redis: aioredis.Redis = Depends(get_redis)):
    items = await redis.lrange(name, start, end)
    return {"name": name, "items": items, "length": len(items)}
```

---

## 3. 缓存实战

### 3.1 查询结果缓存

```python
import json
from fastapi import FastAPI, Depends, Request
import redis.asyncio as aioredis

app = FastAPI(lifespan=lifespan)

# 模拟数据库查询
fake_db = {1: {"id": 1, "name": "Item 1", "price": 99.9}}

@app.get("/items/{item_id}")
async def get_item_cached(item_id: int, request: Request):
    redis = request.app.state.redis

    # 1. 先查 Redis 缓存
    cache_key = f"item:{item_id}"
    cached = await redis.get(cache_key)

    if cached:
        return {"source": "cache", "data": json.loads(cached)}

    # 2. 缓存未命中，查数据库
    item = fake_db.get(item_id)
    if not item:
        return {"error": "Not found"}

    # 3. 写入缓存（设置过期时间）
    await redis.set(cache_key, json.dumps(item), ex=600)  # 缓存 10 分钟

    return {"source": "database", "data": item}
```

### 3.2 缓存失效策略

```python
@app.put("/items/{item_id}")
async def update_item(item_id: int, name: str, price: float, request: Request):
    redis = request.app.state.redis

    # 更新数据库
    fake_db[item_id] = {"id": item_id, "name": name, "price": price}

    # 更新后删除缓存（Cache-Aside 模式）
    await redis.delete(f"item:{item_id}")

    return {"message": "Updated", "data": fake_db[item_id]}

@app.delete("/items/{item_id}")
async def delete_item(item_id: int, request: Request):
    redis = request.app.state.redis

    del fake_db[item_id]
    await redis.delete(f"item:{item_id}")

    return {"message": "Deleted"}
```

### 3.3 缓存装饰器（通用方案）

```python
import json
import functools
from fastapi import Request

def redis_cache(prefix: str, expire: int = 300):
    """Redis 缓存装饰器"""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, request: Request, **kwargs):
            redis = request.app.state.redis

            # 构造缓存键
            cache_key = f"{prefix}:{':'.join(str(v) for v in args)}:{':'.join(f'{k}={v}' for k, v in kwargs.items())}"

            # 查缓存
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)

            # 执行原函数
            result = await func(*args, request=request, **kwargs)

            # 写缓存
            await redis.set(cache_key, json.dumps(result), ex=expire)

            return result
        return wrapper
    return decorator

# 使用示例
@app.get("/users/{user_id}")
@redis_cache(prefix="user", expire=600)
async def get_user(user_id: int, request: Request):
    # 数据库查询...
    return {"id": user_id, "name": "John"}
```

---

## 4. Redis 存储 Session

```python
import redis.asyncio as aioredis
from fastapi import FastAPI, Request
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()

# 配置 Session 中间件（使用默认签名 Cookie 存储）
# 注意：如需 Redis 存储 Session，参见 03-Cookie-Session-Header#3.3 Redis 存储 Session
app.add_middleware(
    SessionMiddleware,
    secret_key="your-secret-key",
)
```

> [!tip] Redis Session 详细配置
> 参见 03-Cookie-Session-Header#3.3 Redis 存储 Session，使用 `starlette-session` 库实现 Redis 后端。

---

## 5. 分布式限流

```python
from fastapi import FastAPI, Request, HTTPException
import redis.asyncio as aioredis

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    redis = request.app.state.redis

    # 获取客户端 IP
    client_ip = request.client.host
    rate_key = f"rate:{client_ip}"

    # 检查当前请求次数
    current = await redis.incr(rate_key)
    if current == 1:
        await redis.expire(rate_key, 60)  # 60 秒窗口

    if current > 100:  # 限制每分钟 100 次
        raise HTTPException(status_code=429, detail="Too many requests")

    response = await call_next(request)
    response.headers["X-RateLimit-Remaining"] = str(max(0, 100 - current))
    return response
```

---

## 6. 常见错误排查

### 错误 1：`Connection refused`

```
原因：Redis 服务未启动或地址配置错误
解决：确认 redis-server 已运行，检查 REDIS_URL
```

### 错误 2：`ResponseError: NOAUTH`

```
原因：Redis 需要密码认证
解决：redis://:password@localhost:6379/0
```

### 错误 3：`decode_responses` 问题

```
原因：未设置 decode_responses=True，返回 bytes 类型
解决：from_url(..., decode_responses=True)
```

## 相关笔记

- 00-FastAPI学习总览 -- 学习路线索引
- 03-Cookie-Session-Header -- Redis 存储 Session
- 06-SQLAlchemy集成 -- 数据库 + 缓存配合
- 08-部署 -- Redis 生产环境配置
