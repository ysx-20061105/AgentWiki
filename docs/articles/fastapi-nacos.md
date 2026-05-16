---
title: "Nacos 集成"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "Nacos", "微服务", "服务注册", "配置中心"]
summary: "FastAPI与Nacos服务注册发现集成，包括服务注册、配置管理、健康检查及微服务架构实践。"
---

# Nacos 集成

> Nacos 是阿里巴巴开源的服务发现、配置管理和服务管理平台，在微服务架构中承担**注册中心**和**配置中心**的角色。
> 官方文档：[https://nacos.io/](https://nacos.io/)
> Python SDK：[https://github.com/nacos-group/nacos-sdk-python](https://github.com/nacos-group/nacos-sdk-python)

## Nacos 核心能力

| 能力          | 说明                    | FastAPI 中的用途      |
| ----------- | --------------------- | ----------------- |
| **服务注册与发现** | 服务实例自动注册，消费者通过服务名发现实例 | Python 服务被其他微服务发现 |
| **配置管理**    | 集中管理配置，支持动态刷新         | 运行时热更新配置          |
| **健康检查**    | 定期检测服务实例健康状态          | 心跳保活              |
| **命名空间**    | 多环境隔离（dev/test/prod）  | 环境隔离              |

---

## 1. 环境准备

### 1.1 安装 Nacos Server

```bash
# Docker 快速启动（单机模式）
docker pull nacos/nacos-server
docker run -d \
    --name nacos-server \
    -p 8848:8848 \
    -p 9848:9848 \
    -e MODE=standalone \
    -e NACOS_AUTH_ENABLE=true \
    nacos/nacos-server

# 访问控制台：http://localhost:8848/nacos
# 默认账号：nacos / nacos
```

### 1.2 安装 Python SDK

```bash
pip install nacos-sdk-python
```

> [!info] SDK 版本说明
> - **v1**（`nacos-sdk-python`）：支持 Python 2.7/3.6/3.7，兼容 Nacos 1.x 和 2.x（HTTP 协议）
> - **v2**：支持 Python 3.7+，原生 Nacos 2.x gRPC 协议
> - 本文使用 v1 API（当前稳定版），导入方式为 `import nacos`

### 1.3 Nacos 核心概念

| 概念 | 说明 | 示例 |
|------|------|------|
| **Namespace** | 命名空间，环境隔离 | `dev` / `test` / `prod` |
| **Group** | 配置分组 | `DEFAULT_GROUP` / `FASTAPI_GROUP` |
| **Data ID** | 配置标识 | `user-service.yaml` |
| **Service Name** | 服务名称 | `user-service` |
| **Instance** | 服务实例（IP:Port） | `192.168.1.10:8000` |

---

## 2. 服务注册与发现

### 2.1 完整的服务注册代码

```python
# nacos_config.py
"""Nacos 连接配置"""

NACOS_SERVER = "127.0.0.1:8848"
NAMESPACE = "public"                       # 命名空间 ID
GROUP = "DEFAULT_GROUP"                    # 分组
USERNAME = "nacos"                         # 认证用户名
PASSWORD = "nacos"                         # 认证密码

# 当前服务信息
SERVICE_NAME = "fastapi-user-service"
SERVICE_IP = "127.0.0.1"
SERVICE_PORT = 8000
```

```python
# nacos_client.py
"""Nacos 客户端封装：服务注册与发现"""

import nacos
import socket
from nacos_config import (
    NACOS_SERVER, NAMESPACE, GROUP,
    USERNAME, PASSWORD,
    SERVICE_NAME, SERVICE_IP, SERVICE_PORT,
)

def get_local_ip() -> str:
    """获取本机 IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class NacosServiceRegistry:
    """Nacos 服务注册与发现"""

    def __init__(self):
        self.client = nacos.NacosClient(
            NACOS_SERVER,
            namespace=NAMESPACE,
            username=USERNAME,
            password=PASSWORD,
        )
        self.service_ip = SERVICE_IP or get_local_ip()
        self.service_port = SERVICE_PORT

    # ---- 服务注册 ----
    def register(self):
        """注册当前服务到 Nacos"""
        self.client.add_naming_instance(
            SERVICE_NAME,
            self.service_ip,
            self.service_port,
            group_name=GROUP,
            weight=1.0,
            enabled=True,
            healthy=True,
            metadata={
                "version": "1.0.0",
                "env": "production",
                "framework": "fastapi",
            },
        )
        print(f"[Nacos] 服务注册成功: {SERVICE_NAME}@{self.service_ip}:{self.service_port}")

    # ---- 服务注销 ----
    def deregister(self):
        """从 Nacos 注销当前服务"""
        self.client.remove_naming_instance(
            SERVICE_NAME,
            self.service_ip,
            self.service_port,
            group_name=GROUP,
        )
        print(f"[Nacos] 服务已注销: {SERVICE_NAME}")

    # ---- 服务发现 ----
    def get_instances(self, service_name: str = SERVICE_NAME) -> list[dict]:
        """获取服务的所有实例"""
        result = self.client.list_naming_instance(
            service_name,
            group_name=GROUP,
            healthy_only=True,
        )
        return result.get("hosts", [])

    # ---- 选择一个实例（简单轮询） ----
    _instance_index = 0

    def choose_instance(self, service_name: str) -> dict | None:
        """轮询选择一个健康实例"""
        instances = self.get_instances(service_name)
        if not instances:
            return None
        instance = instances[self._instance_index % len(instances)]
        NacosServiceRegistry._instance_index += 1
        return instance

    # ---- 心跳保活 ----
    def send_heartbeat(self):
        """发送心跳（Nacos 默认自动检测，可手动触发）"""
        self.client.send_heartbeat(
            SERVICE_NAME,
            self.service_ip,
            self.service_port,
            group_name=GROUP,
            metadata={
                "version": "1.0.0",
                "env": "production",
            },
        )
```

### 2.2 FastAPI 集成服务注册

```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from nacos_client import NacosServiceRegistry

# 全局 Nacos 注册器
registry = NacosServiceRegistry()
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- 启动：注册服务 + 启动心跳 ----
    registry.register()

    # 每 10 秒发送一次心跳（可选，Nacos 默认自动检测）
    scheduler.add_job(registry.send_heartbeat, "interval", seconds=10)
    scheduler.start()

    yield

    # ---- 关闭：注销服务 ----    scheduler.shutdown()
    registry.deregister()


app = FastAPI(title="User Service", lifespan=lifespan)


@app.get("/users/")
async def list_users():
    return {"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}


@app.get("/health")
async def health():
    return {"status": "UP"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

> [!warning] 安装 APScheduler
> 心跳定时任务需要：`pip install apscheduler`

### 2.3 服务发现 -- 调用其他微服务

```python
# service_caller.py
"""通过 Nacos 服务发现调用其他微服务"""

import httpx
from nacos_client import NacosServiceRegistry

registry = NacosServiceRegistry()


async def call_service(service_name: str, path: str, method: str = "GET", **kwargs):
    """通过服务名调用微服务"""
    # 1. 从 Nacos 获取健康实例
    instance = registry.choose_instance(service_name)
    if not instance:
        raise RuntimeError(f"服务 {service_name} 无可用实例")

    # 2. 构造请求 URL
    host = instance["ip"]
    port = instance["port"]
    url = f"http://{host}:{port}{path}"

    # 3. 发送请求
    async with httpx.AsyncClient() as client:
        if method.upper() == "GET":
            response = await client.get(url, **kwargs)
        elif method.upper() == "POST":
            response = await client.post(url, **kwargs)
        else:
            response = await client.request(method, url, **kwargs)

    return response.json()


# 在 FastAPI 路由中使用
@app.get("/orders/{order_id}")
async def get_order(order_id: int):
    # 通过服务发现调用 user-service
    user = await call_service("fastapi-user-service", f"/users/{order_id}")
    return {"order_id": order_id, "user": user}
```

---

## 3. 配置中心

### 3.1 读取配置

```python
# nacos_config_manager.py
"""Nacos 配置管理"""

import nacos
import json
from nacos_config import NACOS_SERVER, NAMESPACE, GROUP, USERNAME, PASSWORD

client = nacos.NacosClient(
    NACOS_SERVER,
    namespace=NAMESPACE,
    username=USERNAME,
    password=PASSWORD,
)


def get_config(data_id: str, group: str = GROUP) -> str:
    """获取配置（字符串）"""
    return client.get_config(data_id, group)


def get_config_json(data_id: str, group: str = GROUP) -> dict:
    """获取配置（解析为 JSON）"""
    raw = client.get_config(data_id, group)
    return json.loads(raw) if raw else {}


def publish_config(data_id: str, content: str, group: str = GROUP):
    """发布/更新配置"""
    client.publish_config(data_id, group, content)


def remove_config(data_id: str, group: str = GROUP):
    """删除配置"""
    client.remove_config(data_id, group)
```

### 3.2 配置监听（动态刷新）

```python
# config_watcher.py
"""Nacos 配置监听，实现动态刷新"""

import json
import nacos
from nacos_config import NACOS_SERVER, NAMESPACE, GROUP, USERNAME, PASSWORD

client = nacos.NacosClient(
    NACOS_SERVER,
    namespace=NAMESPACE,
    username=USERNAME,
    password=PASSWORD,
)

# 全局配置缓存
app_config: dict = {}


def config_callback(args):
    """配置变更回调"""
    global app_config
    raw = args.get("raw", "")
    if raw:
        app_config = json.loads(raw)
        print(f"[Nacos] 配置已更新: {app_config}")


def start_config_watcher(data_id: str, group: str = GROUP):
    """启动配置监听"""
    global app_config

    # 1. 首次加载配置
    raw = client.get_config(data_id, group)
    if raw:
        app_config = json.loads(raw)
        print(f"[Nacos] 配置已加载: {app_config}")

    # 2. 添加监听（后台线程轮询变更）
    client.add_config_watcher(data_id, group, config_callback)
    print(f"[Nacos] 配置监听已启动: {data_id}")
```

### 3.3 FastAPI 集成配置中心

```python
# main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from config_watcher import app_config, start_config_watcher
from nacos_client import NacosServiceRegistry

DATA_ID = "fastapi-user-service.json"
registry = NacosServiceRegistry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动配置监听
    start_config_watcher(DATA_ID)

    # 注册服务
    registry.register()

    yield

    # 注销服务
    registry.deregister()


app = FastAPI(lifespan=lifespan)


@app.get("/config")
async def get_current_config():
    """查看当前配置（实时读取缓存，配置变更后自动更新）"""
    return app_config


@app.get("/users/")
async def list_users():
    # 使用配置中的分页参数
    page_size = app_config.get("page_size", 10)
    return {"page_size": page_size, "users": []}
```

### 3.4 Nacos 配置格式

在 Nacos 控制台创建配置，Data ID 为 `fastapi-user-service.json`，格式选择 JSON：

```json
{
    "page_size": 20,
    "max_retries": 3,
    "enable_cache": true,
    "cache_ttl": 300,
    "log_level": "INFO",
    "feature_flags": {
        "new_dashboard": true,
        "beta_feature": false
    }
}
```

支持的配置格式：`JSON`、`YAML`、`Properties`、`TEXT`、`XML`、`HTML`

---

## 4. 多命名空间（环境隔离）

```python
# nacos_multi_env.py
"""多环境 Nacos 配置"""

import nacos

# 不同环境使用不同命名空间
NAMESPACES = {
    "dev":  "dev-namespace-id",      # 开发环境
    "test": "test-namespace-id",     # 测试环境
    "prod": "prod-namespace-id",     # 生产环境
}

def get_client(env: str = "dev") -> nacos.NacosClient:
    """获取指定环境的 Nacos 客户端"""
    namespace_id = NAMESPACES.get(env)
    if not namespace_id:
        raise ValueError(f"未知环境: {env}")

    return nacos.NacosClient(
        "127.0.0.1:8848",
        namespace=namespace_id,
        username="nacos",
        password="nacos",
    )

# 使用示例
dev_client = get_client("dev")
config = dev_client.get_config("user-service.json", "DEFAULT_GROUP")
```

---

## 5. 完整项目结构

```
fastapi-nacos-demo/
├── main.py                  # FastAPI 应用入口
├── nacos_config.py          # Nacos 连接配置
├── nacos_client.py          # 服务注册与发现
├── nacos_config_manager.py  # 配置读写
├── config_watcher.py        # 配置监听与动态刷新
├── service_caller.py        # 微服务间调用
└── requirements.txt
```

**requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
nacos-sdk-python==0.1.14
httpx==0.27.0
apscheduler==3.10.4
```

---

## 6. 与 Spring Cloud 生态集成

FastAPI + Nacos 可以与 Java 微服务生态无缝对接：

```
┌─────────────────┐     ┌──────────────────┐
│  Spring Cloud   │     │  FastAPI          │
│  Gateway        │────→│  User Service     │
│  (Java)         │     │  (Python)         │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
    ┌──────────────────────────────┐
    │         Nacos Server         │
    │  (注册中心 + 配置中心)        │
    └──────────────────────────────┘
```

**关键要点：**
- Python 服务注册到 Nacos 后，Java 服务可以通过服务名发现并调用 Python 服务
- Spring Cloud Gateway 可以将 `/api/users/**` 路由到 Python FastAPI 服务
- 配置格式保持一致（JSON/YAML），便于统一管理

---

## 7. 常见错误排查

### 错误 1：连接 Nacos 超时

```
原因：Nacos Server 未启动或地址配置错误
解决：检查 Nacos 是否运行，确认 IP 和端口
验证：curl http://localhost:8848/nacos/v1/console/health/readiness
```

### 错误 2：服务注册后不可见

```
原因：命名空间 ID 不匹配（不是名称，而是 UUID）
解决：在 Nacos 控制台复制命名空间 ID（如 8b6f08b7-xxxx）
注意：public 命名空间的 ID 为空字符串 ""
```

### 错误 3：配置读取为空

```
原因：Data ID 或 Group 不匹配
解决：确认 Nacos 控制台中的 Data ID、Group 与代码一致
注意：Data ID 需包含扩展名（如 .json、.yaml）
```

### 错误 4：`No module named 'nacos'`

```
原因：未安装 nacos-sdk-python
解决：pip install nacos-sdk-python
```

---

## 8. 对比：Nacos vs 其他配置中心

| 特性 | Nacos | Consul | etcd | Apollo |
|------|-------|--------|------|--------|
| 服务注册 | 支持 | 支持 | 支持 | 不支持 |
| 配置管理 | 支持 | 不支持 | 不支持 | 支持 |
| 配置热更新 | 支持 | - | - | 支持 |
| 多环境隔离 | 命名空间 | 不支持 | 不支持 | 支持 |
| Python SDK | 官方支持 | 有 | 有 | 有 |
| 生态整合 | Spring Cloud 原生 | 通用 | Kubernetes | 通用 |
| 社区活跃度 | 高 | 高 | 高 | 中 |

## 相关笔记

- 00-FastAPI学习总览 -- 学习路线索引
- 06-SQLAlchemy集成 -- 数据库配置与 Nacos 配置中心配合
- 07-Redis集成 -- Redis 配置可从 Nacos 动态获取
- 08-部署 -- 生产环境部署与 Nacos 集群
