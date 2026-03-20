# generative-ui

[English](./README.md) | [简体中文](./README.zh-CN.md)

跨平台的 LLM 生成式 UI 库。支持任意 AI 模型实时流式渲染交互式 HTML/SVG 组件，基于 DOM diff 实现平滑更新。

灵感来源于 [Claude 的生成式 UI 系统](https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/)——逆向工程后重新构建为独立的包。

## 演示

https://github.com/user-attachments/assets/1cb88122-0fe3-4e12-8d09-593df393122a

## 工作原理

LLM 调用 `show_widget` 工具 → 生成 HTML/SVG → 库通过 morphdom 进行流式 DOM diff 渲染。图表、流程图、交互控件、动画——全部随 token 到达逐步渲染。

## 包说明

| 包 | 语言 | 安装 | 用途 |
|-----|------|------|------|
| [`generative-ui`](./packages/js/) | JS/TS | `npm install generative-ui` | 前端渲染器、流式处理、适配器、工具 schema |
| [`generative-ui`](./packages/python/) | Python | `pip install generative-ui` | 工具 schema + 系统提示词（Python 后端） |
| [Demo 应用](./demo/) | Python + JS | 见下方 | "自带后端"集成模式的参考实现 |

## 快速开始

### 1. 获取工具 schema（任意后端）

**Python 后端：**

```python
from generative_ui import get_tools, get_system_prompt, execute_read_me
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-6",
    system=get_system_prompt(),
    tools=get_tools(),               # 默认 Anthropic 格式
    messages=[{"role": "user", "content": "画一个流程图"}],
)

# 处理 read_me 工具调用
for block in response.content:
    if block.type == "tool_use" and block.name == "read_me":
        result = execute_read_me(block.input["modules"])
```

**JS/TS 后端（任意框架）：**

```typescript
import { getAnthropicTools, getSystemPromptSnippet, executeReadMe } from "generative-ui";

// 传递给你的 LLM 调用
const tools = getAnthropicTools();    // 或 getOpenAITools()
const system = getSystemPromptSnippet();

// 处理 read_me 工具调用
const guidelines = executeReadMe(["interactive", "chart"]);
```

### 2. 渲染组件（前端）

```typescript
import {
  createRenderer,
  createStreamingHandler,
  createAnthropicAdapter,
} from "generative-ui";

// 1. 创建渲染器，指向 DOM 容器
const renderer = createRenderer({
  container: document.getElementById("widgets")!,
  theme: "auto",
});

// 2. 创建流式处理器
const handler = createStreamingHandler({
  renderer,
  onWidgetCreated: (w) => console.log("组件已创建:", w.title),
  onWidgetComplete: (w) => console.log("组件就绪:", w.title),
});

// 3. 使用适配器解析流式响应
const adapter = createAnthropicAdapter();
// ... 将 SSE 事件通过 adapter.processEvent() → handler.processEvent() 传递
```

完整示例请参考 [Demo 应用](./demo/)。

## 架构

```
┌─────────────────────────────────────────────────────┐
│                      你的应用                         │
├──────────────────────┬──────────────────────────────┤
│    前端 (JS)          │      后端（任意语言）          │
│                      │                               │
│  渲染器 (Shadow      │  Python: get_tools(),          │
│    DOM + morphdom)   │    get_system_prompt()         │
│  流式处理器           │  JS: getAnthropicTools(),      │
│  适配器 (OpenAI/     │    getSystemPromptSnippet()    │
│         Anthropic)   │  你自己的 LLM API 调用          │
├──────────────────────┴──────────────────────────────┤
│           设计规范 (来自 Claude.ai)                    │
│          72KB 设计规则，按需加载                        │
└─────────────────────────────────────────────────────┘
```

## 核心概念

### 1. 工具定义

获取适配各 LLM 服务商的工具 schema：

```typescript
import { getOpenAITools, getAnthropicTools, getGenericTools } from "generative-ui";
```

定义了两个工具：
- **`read_me`** — 按模块按需加载设计规范（interactive、chart、diagram、mockup、art）
- **`show_widget`** — 渲染 HTML/SVG 内容

### 2. 设计规范

原样提取自 Claude.ai 的 `visualize:read_me` 工具响应。72KB 的生产级规则，涵盖排版、配色、流式安全 CSS 模式、Chart.js 配置、SVG 图表工程。

| 模块        | 涵盖内容                                               |
|-------------|-------------------------------------------------------|
| interactive | 滑块、指标卡片、实时计算                                 |
| chart       | Chart.js 配置、自定义图例、数字格式化                     |
| mockup      | UI 组件 token、卡片、表单、骨架屏加载                     |
| art         | SVG 插图、Canvas 动画、创意模式                          |
| diagram     | 流程图、架构图、SVG 箭头系统                              |

### 3. 组件渲染器

基于 Shadow DOM 的沙盒渲染器，通过 DOM diff 实现平滑流式更新。

### 4. LLM 适配器

将各服务商特定的流式数据块转换为统一的 `StreamEvent` 对象。

## 运行 Demo

Demo 使用 Python FastAPI 后端 + 原生 JS 前端。

### 前提条件

- Node.js 18+ 和 pnpm
- Python 3.9+ 和 [uv](https://docs.astral.sh/uv/)
- Anthropic API Key（或兼容的代理服务）

### 安装

```bash
git clone https://github.com/anthropics/generative-ui.git
cd generative-ui

# 安装 JS 依赖并构建 JS SDK
pnpm install
pnpm build:js

# 安装 Demo 后端依赖
cd demo/backend
uv sync

# 配置环境变量
cp .env.example .env
# 编辑 .env —— 设置你的 API Key、Base URL、模型
```

`.env` 示例：

```bash
ANTHROPIC_API_KEY=sk-xxx
ANTHROPIC_BASE_URL=http://localhost:8082   # 可选，用于代理/网关
ANTHROPIC_MODEL=claude-sonnet-4-6          # 可选，默认: claude-sonnet-4-6
```

### 启动

在两个终端中分别运行：

```bash
# 终端 1：启动 FastAPI 后端
cd demo/backend
uv run --env-file .env uvicorn main:app --reload --port 8000

# 终端 2：启动 Vite 前端（在项目根目录）
pnpm dev:frontend
```

打开 http://localhost:3000

## 项目结构

```
generative-ui/
├── packages/
│   ├── js/                    # JS/TS 客户端 SDK (npm: generative-ui)
│   │   ├── src/
│   │   │   ├── index.ts       # 主入口导出
│   │   │   ├── types.ts       # TypeScript 类型定义
│   │   │   ├── tools.ts       # 工具 schema + 系统提示词
│   │   │   ├── guidelines.ts  # 72KB Claude.ai 设计规范
│   │   │   ├── renderer.ts    # Shadow DOM 渲染器 + morphdom
│   │   │   ├── streaming.ts   # 流式事件处理器
│   │   │   ├── svg-styles.ts  # SVG 图表预置 CSS 类
│   │   │   └── adapters/      # OpenAI + Anthropic 适配器
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   └── python/                # Python SDK (pip: generative-ui)
│       ├── src/generative_ui/
│       │   ├── __init__.py    # get_tools(), get_system_prompt()
│       │   ├── tools.py       # 工具 schema (Anthropic + OpenAI)
│       │   ├── prompt.py      # 系统提示词构建器
│       │   ├── guidelines.py  # 设计规范加载器
│       │   └── data/guidelines/  # Markdown 规范文件
│       └── pyproject.toml
├── demo/
│   ├── backend/               # FastAPI Demo 服务端
│   │   ├── main.py
│   │   └── pyproject.toml
│   └── frontend/              # 原生 JS/TS Demo 客户端
│       ├── index.html
│       ├── main.ts
│       ├── style.css
│       ├── vite.config.ts
│       └── package.json
├── pnpm-workspace.yaml
└── package.json               # 工作区根配置
```

## 致谢

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — 原始逆向工程及实现
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — 用于平滑流式渲染的 DOM diff
- Anthropic — 构建了生成式 UI 系统

## 许可证

MIT
