import { AstInterpreter } from "./interpreter";
import type {
  ConsoleEntry,
  DebugCommand,
  DebuggerSnapshot,
  ExecutionPoint,
} from "./types";

export interface DebuggerEngineOptions {
  breakpoints?: Iterable<number>;
  maxOperations?: number;
  onConsole?: (entry: ConsoleEntry) => void;
}

export class DebuggerEngine {
  private readonly breakpoints = new Set<number>();
  private readonly iterator: Generator<ExecutionPoint, unknown, void>;
  private readonly maxOperations: number;
  private consoleSequence = 0;
  private current?: ExecutionPoint;
  private pauseRequested = false;
  private status: DebuggerSnapshot = { status: "ready" };

  constructor(source: string, private readonly options: DebuggerEngineOptions = {}) {
    this.breakpoints = new Set(options.breakpoints ?? []);
    this.maxOperations = options.maxOperations ?? 100_000;
    const interpreter = new AstInterpreter(source, {
      onConsole: (entry) =>
        options.onConsole?.({ ...entry, id: ++this.consoleSequence }),
    });
    this.iterator = interpreter.execute();
  }

  get snapshot(): DebuggerSnapshot {
    return this.status;
  }

  setBreakpoints(lines: Iterable<number>): void {
    this.breakpoints.clear();

    for (const line of lines) {
      this.breakpoints.add(line);
    }
  }

  requestPause(): void {
    this.pauseRequested = true;
  }

  async advance(command: DebugCommand): Promise<DebuggerSnapshot> {
    if (this.status.status === "complete" || this.status.status === "error") {
      return this.status;
    }

    this.pauseRequested = false;
    this.status = { point: this.current, status: "running" };
    const startDepth = this.current?.frameDepth ?? -1;

    try {
      for (let operations = 0; operations < this.maxOperations; operations += 1) {
        const result = this.iterator.next();

        if (result.done) {
          this.current = undefined;
          this.status = { status: "complete", value: result.value };
          return this.status;
        }

        this.current = result.value;

        if (this.shouldPause(command, startDepth, result.value)) {
          this.status = { point: result.value, status: "paused" };
          return this.status;
        }

        if (operations > 0 && operations % 200 === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));

          if (this.pauseRequested) {
            this.status = { point: result.value, status: "paused" };
            return this.status;
          }
        }
      }

      throw new RangeError(
        `Execution stopped after ${this.maxOperations.toLocaleString()} AST operations`,
      );
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.status = { error: normalized, point: this.current, status: "error" };
      return this.status;
    }
  }

  private shouldPause(
    command: DebugCommand,
    startDepth: number,
    point: ExecutionPoint,
  ): boolean {
    if (command === "into") return true;
    if (command === "over" && point.frameDepth <= startDepth) return true;
    if (command === "out" && point.frameDepth < startDepth) return true;
    return this.breakpoints.has(point.range.startLine);
  }
}
