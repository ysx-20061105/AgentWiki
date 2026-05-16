---
title: "部署"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "部署", "Docker", "Nginx", "Gunicorn"]
summary: "FastAPI部署完全指南，涵盖Uvicorn/Gunicorn配置、Docker容器化、Nginx反向代理及生产环境优化。"
---

# 部署

> 参考：[FastAPI 官方教程 - Deployment](https://fastapi.org.cn/learn/deployment/)

## 部署架构概览

```
客户端
  │
  ▼
┌─────────┐      ┌────────────────────┐
│  Nginx  │ ──→  │  Gunicorn          │
│ (反向    │      │  + UvicornWorker   │
│  代理)   │      │                    │
└─────────┘      │  ┌─ Worker 1 ─┐   │
  静态文件        │  ├─ Worker 2 ─┤   │
  SSL 终止        │  ├─ Worker 3 ─┤   │
  负载均衡        │  └─ Worker 4 ─┘   │
                  └────────────────────┘
```

---

## 1. Uvicorn 直接部署（开发/小规模）

### 1.1 命令行启动

```bash
# 开发模式（自动重载）
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 生产模式（多 worker）
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 --no-access-log
```

| 参数 | 说明 |
|------|------|
| `main:app` | `文件名:FastAPI实例名` |
| `--reload` | 代码变更自动重载（仅开发） |
| `--host` | 监听地址，`0.0.0.0` 允许外部访问 |
| `--port` | 监听端口 |
| `--workers` | Worker 进程数，推荐 `2 * CPU核数 + 1` |
| `--no-access-log` | 关闭访问日志（生产环境） |
| `--log-level` | 日志级别：debug/info/warning/error |

### 1.2 代码中启动

```python
# main.py
import uvicorn
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        workers=4,
    )
```

---

## 2. Gunicorn + UvicornWorker（生产推荐）

Gunicorn 负责进程管理，Uvicorn 负责异步请求处理。

### 2.1 安装

```bash
pip install gunicorn uvicorn
```

### 2.2 命令行启动

```bash
gunicorn main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
```

### 2.3 配置文件 -- gunicorn.conf.py

```python
# gunicorn.conf.py

# 绑定地址
bind = "0.0.0.0:8000"

# Worker 配置
workers = 4                              # Worker 数量
worker_class = "uvicorn.workers.UvicornWorker"  # 使用 Uvicorn Worker
threads = 2                              # 每个 Worker 的线程数

# 超时配置
timeout = 120                            # Worker 超时时间（秒）
keepalive = 5                            # Keep-Alive 超时

# 日志配置
accesslog = "-"                          # 访问日志输出到 stdout
errorlog = "-"                           # 错误日志输出到 stdout
loglevel = "info"

# 进程配置
preload_app = True                       # 预加载应用（节省内存）
max_requests = 1000                      # 单个 Worker 处理的最大请求数（防内存泄漏）
max_requests_jitter = 50                 # 随机抖动，避免所有 Worker 同时重启
graceful_timeout = 30                    # 优雅关闭超时

# 安全配置
limit_request_line = 8190                # 请求行最大长度
limit_request_fields = 100               # 请求头最大数量
```

启动：

```bash
gunicorn main:app -c gunicorn.conf.py
```

### 2.4 Supervisor 进程守护

```ini
; /etc/supervisor/conf.d/fastapi.conf
[program:fastapi]
directory=/opt/app
command=/opt/app/venv/bin/gunicorn main:app -c gunicorn.conf.py
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/fastapi/access.log
stderr_logfile=/var/log/fastapi/error.log
environment=ENV="production",DATABASE_URL="postgresql://user:pass@localhost/db"
```

```bash
# 管理命令
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start fastapi
sudo supervisorctl restart fastapi
sudo supervisorctl status fastapi
```

---

## 3. Docker 部署

### 3.1 Dockerfile

```dockerfile
# ---- 构建阶段 ----
FROM python:3.12-slim AS builder

WORKDIR /app

# 安装依赖（利用缓存层）
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- 运行阶段 ----
FROM python:3.12-slim

WORKDIR /app

# 从构建阶段复制依赖
COPY --from=builder /install /usr/local

# 复制应用代码
COPY . .

# 创建非 root 用户
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# 启动命令
CMD ["gunicorn", "main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120"]
```

### 3.2 requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
gunicorn==23.0.0
sqlalchemy==2.0.35
asyncpg==0.30.0
redis==5.2.0
python-multipart==0.0.12
pydantic==2.9.0
```

### 3.3 docker-compose.yml

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - ENV=production
      - DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/fastapi_db
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=your-production-secret-key
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: fastapi_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

### 3.4 Nginx 配置 -- nginx.conf

```nginx
upstream fastapi {
    server app:8000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate     /etc/nginx/ssl/fullchain.cer;
    ssl_certificate_key /etc/nginx/ssl/private.key;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # 请求大小限制
    client_max_body_size 100M;

    # 反向代理到 FastAPI
    location / {
        proxy_pass http://fastapi;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 流式响应支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;  # 24 小时，SSE 长连接
    }

    # 静态文件
    location /static/ {
        alias /app/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3.5 常用 Docker 命令

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f app

# 进入容器
docker exec -it fastapi-app /bin/bash

# 扩容（多实例）
docker-compose up -d --scale app=3

# 停止
docker-compose down

# 停止并清除数据
docker-compose down -v
```

---

## 4. 环境变量管理

### 4.1 使用 pydantic-settings

```bash
pip install pydantic-settings
```

```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 应用配置
    app_name: str = "FastAPI App"
    debug: bool = False

    # 数据库
    database_url: str = "sqlite:///./app.db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # 安全
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
```

### 4.2 .env 文件

```env
# .env（不要提交到 Git）
ENV=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/fastapi_db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-super-secret-key-here
```

### 4.3 .env.example（提交到 Git）

```env
# .env.example
ENV=development
DEBUG=true
DATABASE_URL=sqlite+aiosqlite:///./app.db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=change-me-in-production
```

---

## 5. 部署检查清单

```
部署前检查：
- [ ] 环境变量已配置（SECRET_KEY、DATABASE_URL 等）
- [ ] DEBUG=false
- [ ] CORS 已配置具体域名（非 allow_origins=["*"]）
- [ ] 数据库迁移已执行
- [ ] HTTPS 已配置（SSL 证书）
- [ ] 健康检查端点已添加
- [ ] 日志配置合理
- [ ] .env 文件未提交到 Git
- [ ] 依赖版本已锁定（requirements.txt）
- [ ] Docker 镜像使用非 root 用户
```

---

## 6. 常见错误排查

### 错误 1：Worker 超时

```
原因：请求处理时间超过 gunicorn timeout
解决：增加 timeout 值或优化代码（异步 I/O）
```

### 错误 2：连接数据库失败

```
原因：Docker 中 localhost 指向容器本身
解决：使用 Docker 服务名（如 db、redis）代替 localhost
```

### 错误 4：502 Bad Gateway

```
原因：Nginx 无法连接 FastAPI 后端
解决：检查 upstream 配置，确认 FastAPI 容器正常运行
```

## 相关笔记

- 00-FastAPI学习总览 -- 学习路线索引
- 05-跨域请求CORS -- 生产环境 CORS 配置
- 06-SQLAlchemy集成 -- 数据库连接配置
- 07-Redis集成 -- Redis 生产环境配置
