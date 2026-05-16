---
title: "SQLAlchemy 集成"
date: 2026-05-13
categories:
  - FastAPI
tags: ["FastAPI", "SQLAlchemy", "ORM", "数据库"]
summary: "FastAPI与SQLAlchemy ORM集成实战，涵盖模型定义、数据库会话管理、CRUD操作及Alembic迁移。"
---

# SQLAlchemy 集成

> 参考：[FastAPI 官方教程 - SQL Databases](https://fastapi.org.cn/learn/tutorial/sql-databases/)

## 概述

SQLAlchemy 是 Python 最流行的 ORM 框架，FastAPI 通过依赖注入模式集成 SQLAlchemy，支持同步和异步两种模式。

| 模式 | 驱动 | 适用场景 |
|------|------|---------|
| **同步** | `sqlite3` / `pymysql` / `psycopg2` | 简单应用、学习 |
| **异步** | `aiosqlite` / `asyncmy` / `asyncpg` | 高并发生产环境 |

---

## 1. 安装

```bash
# 核心
pip install sqlalchemy

# 同步驱动（按数据库选择）
pip install pymysql          # MySQL
pip install psycopg2-binary  # PostgreSQL

# 异步驱动（按数据库选择）
pip install aiosqlite        # SQLite
pip install asyncmy          # MySQL
pip install asyncpg          # PostgreSQL
```

---

## 2. 同步模式

### 2.1 项目结构

```
app/
├── main.py              # FastAPI 应用入口
├── database.py          # 数据库连接配置
├── models.py            # SQLAlchemy ORM 模型
├── schemas.py           # Pydantic 请求/响应模型
└── routers/
    └── items.py         # 路由
```

### 2.2 数据库配置 -- database.py

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"

# MySQL
# SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:password@localhost:3306/fastapi_db"

# PostgreSQL
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@localhost:5432/fastapi_db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite 专用，MySQL/PG 不需要
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """依赖注入：获取数据库 Session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

> [!info] `get_db` 依赖注入
> - `yield db` 将 Session 注入到路由函数中
> - `finally: db.close()` 确保请求结束后关闭 Session
> - FastAPI 自动处理 `yield` 依赖的清理逻辑

### 2.3 ORM 模型 -- models.py

```python
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    price = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

    # 外键关系
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="items")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)

    # 关系
    items = relationship("Item", back_populates="owner")
```

### 2.4 Pydantic 模型 -- schemas.py

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ---- Item Schemas ----
class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    price: float = Field(..., gt=0)

class ItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)

class ItemResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}  # Pydantic v2，支持从 ORM 对象转换


# ---- User Schemas ----
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool

    model_config = {"from_attributes": True}
```

> [!tip] `from_attributes = True`（Pydantic v2）
> 让 Pydantic 模型能从 SQLAlchemy ORM 对象的属性中读取数据，替代 v1 中的 `orm_mode = True`。

### 2.5 路由 -- main.py

```python
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import engine, get_db, Base
from models import Item, User
from schemas import ItemCreate, ItemUpdate, ItemResponse, UserCreate, UserResponse

# 创建所有表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="FastAPI + SQLAlchemy")


# ---- CREATE ----
@app.post("/items/", response_model=ItemResponse, status_code=201)
async def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    db_item = Item(**item.model_dump())  # Pydantic v2
    db.add(db_item)
    db.commit()
    db.refresh(db_item)  # 刷新获取自增 ID 等
    return db_item


# ---- READ 列表 ----
@app.get("/items/", response_model=List[ItemResponse])
async def list_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items = db.query(Item).offset(skip).limit(limit).all()
    return items


# ---- READ 单个 ----
@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


# ---- UPDATE ----
@app.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, item: ItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(Item).filter(Item.id == item_id).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = item.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item


# ---- DELETE ----
@app.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(Item).filter(Item.id == item_id).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(db_item)
    db.commit()
    return None
```

---

## 3. 异步模式

### 3.1 数据库配置 -- database.py

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# SQLite 异步
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///./app.db"

# MySQL 异步
# SQLALCHEMY_DATABASE_URL = "mysql+asyncmy://root:password@localhost:3306/fastapi_db"

# PostgreSQL 异步
# SQLALCHEMY_DATABASE_URL = "postgresql+asyncpg://user:password@localhost:5432/fastapi_db"

async_engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=True,  # 打印 SQL 语句（调试用）
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_async_db():
    """异步依赖注入"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

### 3.2 异步 CRUD 路由

```python
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from database import async_engine, get_async_db, Base
from models import Item
from schemas import ItemCreate, ItemResponse

app = FastAPI()

@app.on_event("startup")
async def startup():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.post("/items/", response_model=ItemResponse, status_code=201)
async def create_item(item: ItemCreate, db: AsyncSession = Depends(get_async_db)):
    db_item = Item(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item


@app.get("/items/", response_model=list[ItemResponse])
async def list_items(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Item).offset(skip).limit(limit))
    items = result.scalars().all()
    return items


@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Item).where(Item.id == item_id))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@app.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, item: ItemCreate, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Item).where(Item.id == item_id))
    db_item = result.scalar_one_or_none()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    for key, value in item.model_dump().items():
        setattr(db_item, key, value)

    await db.commit()
    await db.refresh(db_item)
    return db_item


@app.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: int, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(select(Item).where(Item.id == item_id))
    db_item = result.scalar_one_or_none()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(db_item)
    await db.commit()
    return None
```

---

## 4. 同步 vs 异步对比

| 特性 | 同步 | 异步 |
|------|------|------|
| 导入 | `create_engine` | `create_async_engine` |
| Session | `Session` | `AsyncSession` |
| 查询 | `db.query(Item)` | `await db.execute(select(Item))` |
| 提交 | `db.commit()` | `await db.commit()` |
| 性能 | 一般 | 高（非阻塞） |
| 复杂度 | 低 | 稍高 |
| 适用 | 学习、简单应用 | 生产环境 |

---

## 5. 常见错误排查

### 错误 1：`MissingGreenlet`

```
原因：在异步模式中使用了同步方法（如 db.query()）
解决：使用 await db.execute(select(...))
```

### 错误 2：`Table already exists`

```
原因：重复创建表
解决：使用 Base.metadata.create_all()（已存在则跳过）
```

### 错误 3：`from_attributes` 报错

```
原因：Pydantic v2 中 orm_mode 已弃用
解决：使用 model_config = {"from_attributes": True}
```

## 相关笔记

- 00-FastAPI学习总览 -- 学习路线索引
- 01-HTTP方法与CRUD操作 -- CRUD 操作详解
- 02-请求参数详解 -- 请求体与 Pydantic 模型
- 07-Redis集成 -- 缓存层配合数据库
- 08-部署 -- 数据库连接池配置
