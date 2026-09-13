import type { ComponentType } from "react";

import NoteInitComponent, {
  parseNoteInitProps,
} from "./components/NoteInitComponent";
import type { ComponentRenderProps, ComponentSpec } from "../chat/types";

type RegistryEntry = {
  component: ComponentType<ComponentRenderProps>;
  // 校验并规整模型给出的 props；返回 null 表示无法渲染，调用方降级成工具气泡
  parse: (raw: unknown) => Record<string, unknown> | null;
};

// 工具名 → 组件类型名。新增一个「工具即 UI」的组件时，这里补一条即可。
const TOOL_COMPONENT_MAP: Record<string, string> = {
  note_init: "NoteInitComponent",
};

export const componentRegistry: Record<string, RegistryEntry> = {
  NoteInitComponent: {
    component: NoteInitComponent,
    parse: parseNoteInitProps,
  },
};

/**
 * 工具调用参数 → 组件描述。
 * 工具名未登记、args 不是合法 JSON、或 props 校验不通过时都返回 null，
 * 调用方保持原样渲染工具气泡——模型的任何输出都不该打断整段对话。
 */
export function parseComponentSpec(
  toolName: string,
  rawArgs: string,
): ComponentSpec | null {
  const type = TOOL_COMPONENT_MAP[toolName];
  const entry = type ? componentRegistry[type] : undefined;
  if (!entry) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawArgs);
  } catch (error) {
    console.error("[agui] component tool args are not valid JSON", toolName, error);
    return null;
  }

  const props = entry.parse(raw);
  return props ? { type, props } : null;
}

// 模型可能编造组件名：未知类型降级成 JSON 预览，绝不抛错炸掉整条消息列表
function UnknownComponent({ spec }: { spec: ComponentSpec }) {
  return (
    <div className="w-[24rem] max-w-full rounded-2xl border border-dashed border-[#C08469]/40 bg-[#FFF8F3] px-3 py-2 text-[11px] text-[#A0715A]">
      <div className="font-semibold tracking-wide">未注册的组件：{spec.type}</div>
      <pre className="mt-1 max-h-40 select-text overflow-auto whitespace-pre-wrap break-words text-[10px] opacity-80">
        {JSON.stringify(spec.props, null, 2)}
      </pre>
    </div>
  );
}

type ComponentRendererProps = {
  spec: ComponentSpec;
} & Omit<ComponentRenderProps, "props">;

function ComponentRenderer({
  spec,
  state,
  busy,
  onResolve,
}: ComponentRendererProps) {
  const entry = componentRegistry[spec.type];
  if (!entry) {
    return <UnknownComponent spec={spec} />;
  }

  const Impl = entry.component;
  return (
    <Impl props={spec.props} state={state} busy={busy} onResolve={onResolve} />
  );
}

export default ComponentRenderer;
