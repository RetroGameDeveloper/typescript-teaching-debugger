export type BindingKind = "const" | "let" | "var" | "param" | "function";

export interface ScopeEntry {
  kind: BindingKind;
  name: string;
  value: unknown;
}

export interface ScopeSnapshot {
  entries: ScopeEntry[];
  name: string;
}

export interface CallFrameSnapshot {
  column: number;
  id: number;
  line: number;
  name: string;
}

export interface SourceRange {
  end: number;
  endColumn: number;
  endLine: number;
  start: number;
  startColumn: number;
  startLine: number;
}

export interface ExecutionPoint {
  callStack: CallFrameSnapshot[];
  frameDepth: number;
  frameId: number;
  label: string;
  nodeType: string;
  range: SourceRange;
  scopes: ScopeSnapshot[];
}

export interface ConsoleEntry {
  id: number;
  level: "error" | "info" | "log" | "warn";
  values: unknown[];
}

export type DebugCommand = "continue" | "into" | "out" | "over";

export type DebuggerStatus =
  | "complete"
  | "error"
  | "paused"
  | "ready"
  | "running";

export interface DebuggerSnapshot {
  error?: Error;
  point?: ExecutionPoint;
  status: DebuggerStatus;
  value?: unknown;
}

export interface InterpreterOptions {
  onConsole?: (entry: Omit<ConsoleEntry, "id">) => void;
}
