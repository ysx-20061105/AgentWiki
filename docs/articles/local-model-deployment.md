---
title: 本地模型部署完全指南
date: 2026-05-05
categories:
  - Agent
tags: ["本地模型", "Ollama", "vLLM", "LM-Studio", "llama.cpp", "AI部署", "智能体学习"]
summary: "介绍如何在本地部署和运行大语言模型，涵盖Ollama、vLLM等主流部署方案及实践指南。"
---

# 本地模型部署完全指南

## 📚 什么是本地模型部署？

本地模型部署是指在自己的电脑/服务器上运行大语言模型（LLM），不依赖云服务（如 OpenAI API、Claude API）。数据全程在本地处理，隐私有保障，且无需支付 API 调用费用。

---

## 🛠️ 主流部署方法对比

| 方法                        | 难度     | 适用场景               | 推荐指数  |
| ------------------------- | ------ | ------------------ | ----- |
| **Ollama**                | ⭐ 简单   | 日常使用、快速实验          | ⭐⭐⭐⭐⭐ |
| **LM Studio**             | ⭐ 简单   | Windows/macOS 桌面用户 | ⭐⭐⭐⭐  |
| **vLLM**                  | ⭐⭐ 中等  | 高并发、服务器部署          | ⭐⭐⭐⭐  |
| **Text Generation WebUI** | ⭐⭐ 中等  | 追求全面定制             | ⭐⭐⭐   |
| **llama.cpp**             | ⭐⭐⭐ 较难 | 极低配置、老旧硬件          | ⭐⭐⭐   |

---

## 1️⃣ Ollama（最推荐）

### 是什么
Ollama 是目前最简单易用的本地模型运行工具，一条命令即可运行模型。

### 优缺点

**优点：**
- 安装简单（macOS/Linux 一条命令，Windows 有安装包）
- 自动下载模型文件
- 支持主流模型：Llama 3、Qwen、Mistral、Gemma 等
- 提供 REST API，方便应用集成
- 跨平台支持

**缺点：**
- GPU 显存要求取决于模型大小
- 不支持多卡并行推理
- 自定义程度有限

### 实操步骤

#### 安装

```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: 下载安装包 https://ollama.com/download
```

#### 下载并运行模型

```bash
# 下载模型（自动选择合适版本）
ollama pull llama3.2        # 约 2GB
ollama pull qwen2.5:7b      # 约 4.7GB
ollama pull mistral:7b      # 约 4.1GB
ollama pull gemma2:9b       # 约 5GB

# 运行对话
ollama run llama3.2
```

#### API 调用

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "用一句话解释量子计算"
}'
```

#### Web 界面

```bash
# 安装 Web UI（第三方）
ollama serve
# 配合 Open WebUI 使用，体验更佳
```

---

## 2️⃣ LM Studio

### 是什么
LM Studio 是专为桌面用户设计的图形化本地模型运行工具，适合不想用命令行的用户。

### 优缺点

**优点：**
- 图形界面友好
- 内置聊天界面
- 支持模型搜索和下载
- 提供本地 API 服务器
- 跨平台（Windows/macOS/Linux）

**缺点：**
- 占用资源较多
- 相比命令行工具体积较大

### 实操步骤

1. **下载安装**
   - 官网：https://lmstudio.ai
   - 下载对应系统的安装包

2. **使用界面**
   - 启动后搜索想要下载的模型
   - 选择参数大小（7B/13B/70B）
   - 点击下载

3. **启动本地服务器**
   - 工具栏点击 "Server" 图标
   - 选择端口（默认 1234）
   - 获取 API 地址：`http://localhost:1234/v1/chat/completions`

---

## 3️⃣ vLLM

### 是什么
vLLM 是为高吞吐量推理优化的推理引擎，适合生产环境和需要高并发处理的场景。

### 优缺点

**优点：**
- 高吞吐量，推理速度快
- 支持连续批处理（PagedAttention）
- 多 GPU 并行推理
- 支持 OpenAI 兼容 API

**缺点：**
- 安装相对复杂
- 主要面向服务器/Linux 环境
- Windows 支持有限

### 实操步骤

```bash
# 安装
pip install vllm

# 运行
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-3.2-3B-Instruct \
    --trust-remote-code

# API 调用
curl http://localhost:8000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "meta-llama/Llama-3.2-3B-Instruct",
        "messages": [{"role": "user", "content": "Hello!"}]
    }'
```

---

## 4️⃣ llama.cpp

### 是什么
llama.cpp 是纯 C/C++ 实现的推理引擎，针对 Apple Silicon 和低端硬件做了优化，支持量化压缩。

### 优缺点

**优点：**
- 极低硬件要求
- 支持 CPU 运行
- 支持多种量化格式（Q4_K_M、Q5_K_S 等）
- 启动快，内存占用小

**缺点：**
- 需要手动转换模型格式
- 命令行操作有一定学习成本

### 实操步骤

```bash
# 克隆并编译
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake .
make -j$(nproc)

# 下载量化模型（从 HuggingFace）
# 搜索 gguf 格式的量化模型

# 运行
./llama-cli -m your-model.gguf -n 512 -p "Your prompt here"
```

---

## 📊 硬件配置参考

| 模型大小 | 最低显存 | 推荐显存 | 适合场景 |
|----------|----------|----------|----------|
| 1B - 3B | 4GB | 6GB | 轻量任务、老旧设备 |
| 7B | 8GB | 12GB | 日常对话、写作 |
| 13B | 16GB | 20GB | 复杂推理 |
| 70B | 40GB | 80GB | 专业级应用 |

---

## 🔍 模型选择建议

| 用途 | 推荐模型 | 量化版本 |
|------|----------|----------|
| 中文对话 | Qwen2.5、Yi | Q4_K_M |
| 代码生成 | Codellama、DeepSeek-Coder | Q4_K_M |
| 英文对话 | Llama 3.2、Mistral | Q4_K_M |
| 低配置设备 | Phi-3-mini、Gemma-2B | Q8_0 |

---

## ⚡ 快速启动建议

**新手推荐：**
1. 下载 Ollama
2. 运行 `ollama pull qwen2.5:7b`
3. 开始对话 `ollama run qwen2.5:7b`

**Windows 用户：**
- 优先考虑 LM Studio，图形界面更直观

**服务器/高并发：**
- 使用 vLLM，配合 Docker 部署

---

## 📚 相关资源

- Ollama 官网：https://ollama.com
- LM Studio 官网：https://lmstudio.ai
- vLLM GitHub：https://github.com/vllm-project/vllm
- llama.cpp GitHub：https://github.com/ggerganov/llama.cpp
- HuggingFace 模型库：https://huggingface.co/models

---

## 🏷️ 标签

#本地模型 #Ollama #vLLM #LM-Studio #llama.cpp #AI部署