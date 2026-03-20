export type GuidelineModule =
  | "interactive"
  | "chart"
  | "diagram"
  | "mockup"
  | "art";

export interface ShowWidgetParams {
  i_have_seen_read_me: boolean;
  title: string;
  loading_messages?: string[];
  widget_code: string;
  width?: number;
  height?: number;
}

export interface ReadMeParams {
  modules: GuidelineModule[];
}

export interface WidgetRenderOptions {
  container: HTMLElement;
  sandbox?: boolean;
  theme?: "light" | "dark" | "auto";
  maxWidth?: number;
  onInteraction?: (data: unknown) => void;
  onPrompt?: (text: string) => void;
  onClose?: () => void;
}

export interface WidgetInstance {
  id: string;
  title: string;
  container: HTMLElement;
  update(html: string): void;
  activate(): void | Promise<void>;
  destroy(): void;
  /** Show a loading indicator with optional rotating messages */
  showLoading?(messages?: string[]): void;
  /** Hide the loading indicator */
  hideLoading?(): void;
}

export type StreamEventType =
  | "tool_call_start"
  | "tool_call_delta"
  | "tool_call_end";

export interface StreamEvent {
  type: StreamEventType;
  toolName: string;
  toolCallId: string;
  partialArgs?: Partial<ShowWidgetParams>;
  args?: ShowWidgetParams;
  delta?: string;
}

/**
 * OpenAI function-calling tool schema format.
 */
export interface OpenAIToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

/**
 * Anthropic tool schema format.
 */
export interface AnthropicToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Generic tool schema for custom integrations.
 */
export interface GenericToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}
