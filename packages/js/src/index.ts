export type {
  GuidelineModule,
  ShowWidgetParams,
  ReadMeParams,
  WidgetRenderOptions,
  WidgetInstance,
  StreamEvent,
  StreamEventType,
  OpenAIToolSchema,
  AnthropicToolSchema,
  GenericToolSchema,
} from "./types.js";

export {
  getOpenAITools,
  getAnthropicTools,
  getGenericTools,
  executeReadMe,
  getSystemPromptSnippet,
} from "./tools.js";

export { getGuidelines, AVAILABLE_MODULES } from "./guidelines.js";

export { createRenderer } from "./renderer.js";
export type { WidgetRenderer } from "./renderer.js";

export { createStreamingHandler } from "./streaming.js";
export type { StreamingHandler, StreamingOptions } from "./streaming.js";

export { createOpenAIAdapter, createAnthropicAdapter } from "./adapters/index.js";
export type { OpenAIAdapter } from "./adapters/openai.js";
export type { AnthropicAdapter } from "./adapters/anthropic.js";
