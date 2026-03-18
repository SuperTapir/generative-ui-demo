# generative-ui

[English](./README.md) | [简体中文](./README.zh-CN.md)

跨平台的 LLM 生成式 UI 库。支持任意 AI 模型实时流式渲染交互式 HTML/SVG 组件，基于 DOM diff 实现平滑更新。

灵感来源于 [Claude 的生成式 UI 系统](https://michaellivs.com/blog/reverse-engineering-claude-generative-ui/)——逆向工程后重新构建为独立的 Web 模块。

## 演示

https://github.com/user-attachments/assets/1cb88122-0fe3-4e12-8d09-593df393122a

## 工作原理

LLM 调用 `show_widget` 工具 → 生成 HTML/SVG → 库通过 morphdom 进行流式 DOM diff 渲染。图表、流程图、交互控件、动画——全部随 token 到达逐步渲染。

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000，输入你的 API Key，让模型帮你可视化任何内容。

## 架构

```
┌─────────────────────────────────────────────────────┐
│                      你的应用                        │
├──────────┬──────────┬───────────────┬───────────────┤
│  工具     │  适配器   │   流式处理     │   渲染器      │
│          │          │               │               │
│ OpenAI   │ OpenAI   │ StreamEvent   │ iframe +      │
│ Anthropic│ Anthropic│ 事件处理       │ morphdom      │
│ Generic  │          │ + 防抖        │ DOM diff      │
├──────────┴──────────┴───────────────┴───────────────┤
│             设计规范 (来自 Claude.ai)                  │
│            72KB 设计规则，按需加载                      │
└─────────────────────────────────────────────────────┘
```

## 核心概念

### 1. 工具定义

获取适配各 LLM 服务商的工具 schema：

```typescript
import { getOpenAITools, getAnthropicTools, getGenericTools } from "generative-ui";

// OpenAI function-calling 格式
const tools = getOpenAITools();

// Anthropic 格式
const tools = getAnthropicTools();

// 通用格式（自定义集成）
const tools = getGenericTools();
```

定义了两个工具：
- **`read_me`** — 按模块按需加载设计规范（interactive、chart、diagram、mockup、art）
- **`show_widget`** — 渲染 HTML/SVG 内容

### 2. 设计规范

原样提取自 Claude.ai 的 `visualize:read_me` 工具响应。72KB 的生产级规则，涵盖排版、配色、流式安全 CSS 模式、Chart.js 配置、SVG 图表工程。

```typescript
import { executeReadMe, getGuidelines } from "generative-ui";

// 执行 read_me 工具（返回请求模块的设计规范）
const guidelines = executeReadMe(["interactive", "chart"]);

// 或直接获取规范内容
const content = getGuidelines(["diagram"]);
```

5 个模块，按需加载：

| 模块        | 涵盖内容                                               |
|-------------|-------------------------------------------------------|
| interactive | 滑块、指标卡片、实时计算                                 |
| chart       | Chart.js 配置、自定义图例、数字格式化                     |
| mockup      | UI 组件 token、卡片、表单、骨架屏加载                     |
| art         | SVG 插图、Canvas 动画、创意模式                          |
| diagram     | 流程图、架构图、SVG 箭头系统                              |

### 3. 组件渲染器

在沙盒 iframe 中渲染 HTML，通过 DOM diff 实现平滑的流式更新：

```typescript
import { createRenderer } from "generative-ui";

const renderer = createRenderer({
  container: document.getElementById("widgets"),
  theme: "auto",        // "light" | "dark" | "auto"
  maxWidth: 800,
  onPrompt: (text) => { /* 组件调用了 sendPrompt() */ },
});

const widget = renderer.createWidget("compound_interest");
widget.update("<div>部分 HTML...</div>");
widget.update("<div>更多内容...</div>");  // morphdom diff，只有新节点有动画
widget.activate();  // 执行 <script> 标签
```

### 4. 流式处理器

处理标准化的流式事件，管理渐进式组件渲染：

```typescript
import { createStreamingHandler } from "generative-ui";

const handler = createStreamingHandler({
  renderer,
  debounceMs: 150,
  onWidgetCreated: (widget) => console.log("组件已创建:", widget.title),
  onWidgetComplete: (widget) => console.log("组件就绪:", widget.title),
});

// 从适配器输入事件
handler.processEvent(event);

// 或直接渲染完整组件
handler.renderWidget({
  i_have_seen_read_me: true,
  title: "my_widget",
  widget_code: "<div>完整 HTML</div>",
});
```

### 5. LLM 适配器

将各服务商特定的流式数据块转换为统一的 `StreamEvent` 对象：

```typescript
import { createOpenAIAdapter, createAnthropicAdapter } from "generative-ui";

// OpenAI
const openaiAdapter = createOpenAIAdapter();
for await (const chunk of openaiStream) {
  const events = openaiAdapter.processChunk(chunk);
  for (const event of events) {
    streamingHandler.processEvent(event);
  }
}

// Anthropic
const anthropicAdapter = createAnthropicAdapter();
for await (const event of anthropicStream) {
  const events = anthropicAdapter.processEvent(event);
  for (const ev of events) {
    streamingHandler.processEvent(ev);
  }
}
```

## 流式渲染流程

```
LLM 开始生成 show_widget 工具调用
  │
  ├── tool_call_start → 初始化流式状态
  │
  ├── tool_call_delta（重复，每 ~token 一次）
  │   ├── 150ms 防抖
  │   ├── 首次：创建 iframe + morphdom shell HTML
  │   ├── 后续：postMessage → morphdom diff 新旧 DOM
  │   │   └── 新节点有 0.3s 淡入动画
  │   │   └── 未变更节点保持不动
  │   │
  ├── tool_call_end
  │   ├── 最终内容更新
  │   └── 激活 <script> 标签（Chart.js、D3 等）
  │
  └── 组件就绪，可交互
```

## 与原版的区别

| 原版 (pi-generative-ui)           | 本项目                           |
|-----------------------------------|----------------------------------|
| Pi 扩展 API                       | 独立库                           |
| 仅 macOS（Glimpse/WKWebView）     | 任意浏览器（iframe 沙盒）         |
| 原生 macOS 窗口                    | 内联 iframe 渲染                 |
| Pi 流式事件                        | OpenAI / Anthropic 适配器        |
| 仅深色模式                         | 浅色 + 深色 + 自动主题            |

## 项目结构

```
generative-ui/
├── src/
│   ├── index.ts           # 主入口导出
│   ├── types.ts           # TypeScript 类型定义
│   ├── tools.ts           # 工具 schema（OpenAI、Anthropic、通用）
│   ├── guidelines.ts      # 72KB Claude.ai 原版设计规范
│   ├── svg-styles.ts      # SVG 图表预置 CSS 类
│   ├── renderer.ts        # 基于 iframe 的组件渲染器 + morphdom
│   ├── streaming.ts       # 流式事件处理器 + 防抖
│   ├── adapters/
│   │   ├── openai.ts      # OpenAI 流式适配器
│   │   ├── anthropic.ts   # Anthropic 流式适配器
│   │   └── index.ts
│   └── claude-guidelines/ # 原始提取的 Markdown（参考）
│       ├── CORE.md
│       ├── art.md、chart.md、diagram.md 等
│       └── sections/      # 去重后的章节 + mapping.json
├── demo/
│   ├── index.html         # 演示聊天 UI
│   ├── main.ts            # 演示逻辑，支持 OpenAI/Anthropic
│   └── style.css
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 致谢

- [pi-generative-ui](https://github.com/Michaelliv/pi-generative-ui) — 原始逆向工程及实现
- [morphdom](https://github.com/patrick-steele-idem/morphdom) — 用于平滑流式渲染的 DOM diff
- Anthropic — 构建了生成式 UI 系统

## 许可证

MIT
