import { EditorView } from "@codemirror/view";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  createElement as createIconElement,
  type IconNode,
} from "lucide";
import { DebuggerEngine } from "./core/engine";
import type {
  ConsoleEntry,
  DebugCommand,
  DebuggerSnapshot,
  ExecutionPoint,
  ScopeEntry,
} from "./core/types";
import {
  createEditor,
  readBreakpointLines,
  setActivePoint,
  setCommentVisibility,
  setEditorBreakpoints,
  setEditorCode,
} from "./editor";
import { debuggerStyles } from "./styles";
import {
  parseTeachingComments,
  teachingNotesFromComments,
  type TeachingNote,
  type TeachingNotes,
} from "./teaching";

const runtimeTeachingNotes: Record<string, string> = {
  ArrowFunctionExpression:
    "Execution has entered the arrow function. Its expression becomes the function's return value.",
  AssignmentExpression:
    "The right-hand expression is evaluated, then its result is stored in the target binding.",
  CallExpression:
    "The callee and arguments are evaluated before a new call frame is created.",
  DoWhileStatement:
    "The body runs once before this condition decides whether the loop repeats.",
  ExpressionStatement:
    "This expression runs for its side effect. Step into to follow any function call it contains.",
  ForInStatement:
    "The loop advances to the next enumerable property key.",
  ForOfStatement:
    "The iterable supplies its next value, which is bound in a fresh loop scope.",
  ForStatement:
    "The loop condition is checked before control moves into the body or past the loop.",
  FunctionDeclaration:
    "The function binding is available in this scope. Its body runs only when the function is called.",
  IfStatement:
    "The condition is evaluated and converted to a boolean to select one branch.",
  ReturnStatement:
    "The expression becomes this frame's result, then control returns to its caller.",
  SwitchStatement:
    "The discriminant is compared with cases until a matching branch is selected.",
  ThrowStatement:
    "The value becomes an exception and control searches for the nearest matching catch block.",
  TryStatement:
    "Execution enters the protected block. A thrown value can transfer control to catch.",
  VariableDeclaration:
    "The initializer is evaluated first, then the resulting value is bound in the current scope.",
  WhileStatement:
    "The condition decides whether the loop body runs again.",
};

const componentTemplate = `
  <style>${debuggerStyles}</style>
  <div class="shell" tabindex="0">
    <header class="tab-strip">
      <div class="file-tab"><span class="ts-badge">TS</span><span>lesson.ts</span></div>
      <div class="mode-badge"><span class="mode-dot"></span>AST runtime</div>
    </header>
    <div class="toolbar" role="toolbar" aria-label="Debugger controls">
      <button class="tool-button" data-command="continue" type="button" aria-label="Resume execution" title="Resume (F8)"></button>
      <button class="tool-button" data-command="over" type="button" aria-label="Step over" title="Step over (F10)"></button>
      <button class="tool-button" data-command="into" type="button" aria-label="Step into" title="Step into (F11)"></button>
      <button class="tool-button" data-command="out" type="button" aria-label="Step out" title="Step out (Shift+F11)"></button>
      <span class="toolbar-separator" aria-hidden="true"></span>
      <button class="tool-button" data-command="restart" type="button" aria-label="Restart" title="Restart (Ctrl+Shift+F5)"></button>
      <span class="toolbar-separator" aria-hidden="true"></span>
      <button class="view-toggle" data-view="comments" type="button" aria-pressed="false">Comments</button>
      <button class="view-toggle" data-view="questions" type="button" aria-pressed="true">Questions</button>
      <div class="pause-summary" data-status="ready">Ready to evaluate TypeScript</div>
    </div>
    <div class="workspace">
      <section class="editor-pane" aria-label="TypeScript source">
        <div class="editor-host"></div>
      </section>
      <aside class="sidebar" aria-label="Debugger details">
        <div class="teaching-card">
          <p class="teaching-kicker">Why this line exists</p>
          <p class="teaching-title">Ready to run</p>
          <p class="teaching-copy">Execution pauses before each executable AST node. Type-only syntax is parsed but skipped at runtime.</p>
          <span class="ast-token">Program</span>
          <div class="teaching-question" hidden>
            <p class="question-label">Question</p>
            <div class="question-prompt"></div>
            <textarea class="question-response" rows="2" aria-label="Your answer" placeholder="Write your answer before revealing the solution"></textarea>
            <button class="solution-toggle" type="button">Reveal solution</button>
            <div class="teaching-solution" hidden>
              <p class="solution-label">Solution</p>
              <div class="solution-copy"></div>
            </div>
          </div>
        </div>
        <section class="panel-section" data-section="scope" data-collapsed="false">
          <button class="section-toggle" type="button" aria-expanded="true"><span data-chevron></span>Scope<span class="section-count">0</span></button>
          <div class="section-content scope-content"><div class="empty-state">No active scope</div></div>
        </section>
        <section class="panel-section" data-section="stack" data-collapsed="false">
          <button class="section-toggle" type="button" aria-expanded="true"><span data-chevron></span>Call stack<span class="section-count">0</span></button>
          <div class="section-content stack-content"><div class="empty-state">No active frames</div></div>
        </section>
        <section class="panel-section" data-section="breakpoints" data-collapsed="false">
          <button class="section-toggle" type="button" aria-expanded="true"><span data-chevron></span>Breakpoints<span class="section-count">0</span></button>
          <div class="section-content breakpoint-content"><div class="empty-state">Click the gutter to add one</div></div>
        </section>
        <section class="panel-section" data-section="console" data-collapsed="false">
          <button class="section-toggle" type="button" aria-expanded="true"><span data-chevron></span>Console<span class="section-count">0</span></button>
          <div class="section-content console-content"><div class="empty-state">Console output appears here</div></div>
        </section>
      </aside>
    </div>
    <footer class="statusbar">
      <span class="statusbar-state" data-status="ready"><span class="status-indicator"></span><span class="status-label">Ready</span></span>
      <span class="cursor-location">Ln 1, Col 1</span>
      <span class="statusbar-language">TypeScript</span>
    </footer>
  </div>
`;

function icon(node: IconNode): SVGElement {
  return createIconElement(node, {
    "aria-hidden": "true",
    fill: "none",
    height: 16,
    width: 16,
  });
}

function appendInlineMarkdown(parent: HTMLElement, source: string): void {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    parent.append(document.createTextNode(source.slice(cursor, match.index)));
    const token = match[0];
    const element = document.createElement(
      token.startsWith("`") ? "code" : token.startsWith("**") ? "strong" : "em",
    );
    element.textContent = token.startsWith("**")
      ? token.slice(2, -2)
      : token.slice(1, -1);
    parent.append(element);
    cursor = match.index + token.length;
  }

  parent.append(document.createTextNode(source.slice(cursor)));
}

function renderMarkdown(target: HTMLElement, markdown: string): void {
  target.replaceChildren();
  const lines = markdown.split("\n");
  let list: HTMLUListElement | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      list = undefined;
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.+)$/);

    if (listItem) {
      if (!list) {
        list = document.createElement("ul");
        target.append(list);
      }
      const item = document.createElement("li");
      appendInlineMarkdown(item, listItem[1] ?? "");
      list.append(item);
      continue;
    }

    list = undefined;
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, line.replace(/^#{1,6}\s+/, ""));
    target.append(paragraph);
  }
}

function formatStatus(status: DebuggerSnapshot["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function previewValue(value: unknown, consoleStyle = false): string {
  if (typeof value === "string") return consoleStyle ? value : JSON.stringify(value);
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (value === null) return "null";
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type?: string }).type === "user-function"
  ) {
    const name = (value as { name?: string }).name ?? "anonymous";
    return `function ${name}()`;
  }

  const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;
  return constructorName && constructorName !== "Object" ? constructorName : "{...}";
}

function valueClass(value: unknown): string {
  if (value === null || value === undefined) return "value-nullish";
  if (typeof value === "string") return "value-string";
  if (typeof value === "number" || typeof value === "bigint") return "value-number";
  if (typeof value === "boolean") return "value-boolean";
  return "value-object";
}

function isExpandable(value: unknown): value is object {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Error) &&
    !(
      "type" in value &&
      (value as { type?: string }).type === "user-function"
    )
  );
}

export class TsTeachingDebuggerElement extends HTMLElement {
  static readonly observedAttributes = ["code", "readonly"];

  private _breakpoints = new Set<number>();
  private _code = "";
  private consoleEntries: ConsoleEntry[] = [];
  private editor?: EditorView;
  private engine?: DebuggerEngine;
  private listeners?: AbortController;
  private resetTimer?: ReturnType<typeof setTimeout>;
  private resetSequence = 0;
  private snapshot: DebuggerSnapshot = { status: "ready" };
  private suppressEditorChange = false;
  private _teachingNotes: TeachingNotes = {};
  private commentsVisible = false;
  private questionsVisible = true;
  private solutionVisible = false;
  private teachingLine?: number;

  get code(): string {
    return this.editor?.state.doc.toString() ?? this._code;
  }

  set code(value: string) {
    this._code = value ?? "";

    if (this.editor) {
      this.suppressEditorChange = true;
      setEditorCode(this.editor, this._code);
      this.suppressEditorChange = false;
      this.refreshTeachingComments();
      this.scheduleReset(0);
    }
  }

  get breakpoints(): number[] {
    return [...this._breakpoints].sort((left, right) => left - right);
  }

  set breakpoints(lines: Iterable<number>) {
    this._breakpoints = new Set(
      [...lines].filter((line) => Number.isInteger(line) && line > 0),
    );
    this.engine?.setBreakpoints(this._breakpoints);

    if (this.editor) {
      setEditorBreakpoints(this.editor, this._breakpoints);
    }

    this.renderBreakpoints();
  }

  get showComments(): boolean {
    return this.commentsVisible;
  }

  set showComments(visible: boolean) {
    this.commentsVisible = Boolean(visible);
    this.applyCommentVisibility();
    this.renderViewToggles();
  }

  get showQuestions(): boolean {
    return this.questionsVisible;
  }

  set showQuestions(visible: boolean) {
    this.questionsVisible = Boolean(visible);
    this.solutionVisible = false;
    if (this.shadowRoot) {
      this.renderTeachingCard();
    }
    this.renderViewToggles();
  }

  connectedCallback(): void {
    if (this.shadowRoot) return;

    if (!this._code) {
      this._code =
        this.getAttribute("code") ??
        this.querySelector('script[type="text/typescript"]')?.textContent?.trim() ??
        "";
    }

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = componentTemplate;
    this.addIcons();
    this.editor = createEditor({
      code: this._code,
      onBreakpointsChange: (lines) => this.handleBreakpointChange(lines),
      onChange: (source) => this.handleSourceChange(source),
      parent: this.requiredElement(".editor-host"),
      readOnly: this.hasAttribute("readonly"),
    });
    this.refreshTeachingComments();
    setEditorBreakpoints(this.editor, this._breakpoints);
    this.bindEvents();
    void this.reset();
  }

  disconnectedCallback(): void {
    this.listeners?.abort();
    this.editor?.destroy();
    this.editor = undefined;
    clearTimeout(this.resetTimer);
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null,
  ): void {
    if (name === "code" && newValue !== null && newValue !== this._code) {
      this.code = newValue;
    }
  }

  async reset(): Promise<DebuggerSnapshot> {
    const sequence = ++this.resetSequence;
    this.engine?.requestPause();
    this.consoleEntries = [];
    this.snapshot = { status: "ready" };
    this.render();

    if (!this.code.trim()) {
      this.engine = undefined;
      return this.snapshot;
    }

    try {
      const engine = new DebuggerEngine(this.code, {
        breakpoints: this._breakpoints,
        onConsole: (entry) => {
          this.consoleEntries.push(entry);
          this.renderConsole();
        },
      });
      this.engine = engine;
      const result = await engine.advance("into");

      if (sequence !== this.resetSequence || this.engine !== engine) {
        return this.snapshot;
      }

      this.acceptSnapshot(result);
      return result;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      const result: DebuggerSnapshot = { error: normalized, status: "error" };
      this.acceptSnapshot(result);
      return result;
    }
  }

  stepInto(): Promise<DebuggerSnapshot> {
    return this.runCommand("into");
  }

  stepOver(): Promise<DebuggerSnapshot> {
    return this.runCommand("over");
  }

  stepOut(): Promise<DebuggerSnapshot> {
    return this.runCommand("out");
  }

  resume(): Promise<DebuggerSnapshot> {
    return this.runCommand("continue");
  }

  pause(): void {
    this.engine?.requestPause();
  }

  private requiredElement<T extends Element>(selector: string): T {
    const element = this.shadowRoot?.querySelector<T>(selector);

    if (!element) throw new Error(`Debugger element not found: ${selector}`);
    return element;
  }

  private addIcons(): void {
    const icons: Record<string, IconNode> = {
      continue: Play,
      into: ArrowDownToLine,
      out: ArrowUpFromLine,
      over: Redo2,
      restart: RotateCcw,
    };

    for (const [command, iconNode] of Object.entries(icons)) {
      this.requiredElement<HTMLButtonElement>(`[data-command="${command}"]`).append(
        icon(iconNode),
      );
    }

    this.shadowRoot?.querySelectorAll<HTMLElement>("[data-chevron]").forEach((target) => {
      target.append(icon(ChevronDown));
    });
  }

  private bindEvents(): void {
    this.listeners?.abort();
    this.listeners = new AbortController();
    const { signal } = this.listeners;

    this.shadowRoot?.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const command = button.dataset.command;

          if (command === "restart") {
            void this.reset();
          } else if (command) {
            void this.runCommand(command as DebugCommand);
          }
        },
        { signal },
      );
    });

    this.shadowRoot?.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          if (button.dataset.view === "comments") {
            this.showComments = !this.showComments;
          } else if (button.dataset.view === "questions") {
            this.showQuestions = !this.showQuestions;
          }
        },
        { signal },
      );
    });

    this.requiredElement<HTMLButtonElement>(".solution-toggle").addEventListener(
      "click",
      () => {
        this.solutionVisible = !this.solutionVisible;
        this.renderTeachingCard();
      },
      { signal },
    );

    this.shadowRoot?.querySelectorAll<HTMLButtonElement>(".section-toggle").forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const section = button.closest<HTMLElement>(".panel-section");

          if (!section) return;
          const collapsed = section.dataset.collapsed !== "true";
          section.dataset.collapsed = String(collapsed);
          button.setAttribute("aria-expanded", String(!collapsed));
        },
        { signal },
      );
    });

    this.requiredElement<HTMLElement>(".shell").addEventListener(
      "keydown",
      (event) => this.handleKeydown(event),
      { signal },
    );

    this.requiredElement<HTMLElement>(".breakpoint-content").addEventListener(
      "click",
      (event) => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
          "[data-remove-breakpoint]",
        );

        if (!target) return;
        const line = Number(target.dataset.removeBreakpoint);
        this.breakpoints = this.breakpoints.filter((candidate) => candidate !== line);
        this.dispatchEvent(
          new CustomEvent("breakpoints-change", {
            detail: { breakpoints: this.breakpoints },
          }),
        );
      },
      { signal },
    );
  }

  private handleKeydown(event: KeyboardEvent): void {
    const target = event.composedPath()[0];
    const editing = target instanceof HTMLElement && target.closest(".cm-editor");

    if (event.key === "F8") {
      event.preventDefault();
      void this.resume();
    } else if (event.key === "F10") {
      event.preventDefault();
      void this.stepOver();
    } else if (event.key === "F11") {
      event.preventDefault();
      void (event.shiftKey ? this.stepOut() : this.stepInto());
    } else if (
      !editing &&
      event.key === "F5" &&
      event.ctrlKey &&
      event.shiftKey
    ) {
      event.preventDefault();
      void this.reset();
    }
  }

  private handleSourceChange(source: string): void {
    this._code = source;

    if (!this.suppressEditorChange) {
      this.refreshTeachingComments();
      this.engine?.requestPause();
      this.scheduleReset(450);
      this.dispatchEvent(
        new CustomEvent("code-change", { detail: { code: source } }),
      );
    }
  }

  private refreshTeachingComments(): void {
    this._teachingNotes = teachingNotesFromComments(this._code);
    this.applyCommentVisibility();
  }

  private applyCommentVisibility(): void {
    if (!this.editor) return;
    const ranges = parseTeachingComments(this._code).map(({ from, to }) => ({
      from,
      to,
    }));
    setCommentVisibility(this.editor, ranges, this.commentsVisible);
  }

  private scheduleReset(delay: number): void {
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => void this.reset(), delay);
  }

  private handleBreakpointChange(lines: number[]): void {
    this._breakpoints = new Set(lines);
    this.engine?.setBreakpoints(lines);
    this.renderBreakpoints();
    this.dispatchEvent(
      new CustomEvent("breakpoints-change", {
        detail: { breakpoints: lines },
      }),
    );
  }

  private async runCommand(command: DebugCommand): Promise<DebuggerSnapshot> {
    if (!this.engine) {
      return this.reset();
    }

    if (this.snapshot.status === "running") {
      if (command === "continue") this.engine.requestPause();
      return this.snapshot;
    }

    if (this.snapshot.status === "complete" || this.snapshot.status === "error") {
      await this.reset();
    }

    if (!this.engine) return this.snapshot;
    const engine = this.engine;
    this.snapshot = { point: this.snapshot.point, status: "running" };
    this.render();
    const result = await engine.advance(command);

    if (this.engine === engine) {
      this.acceptSnapshot(result);
    }

    return result;
  }

  private acceptSnapshot(snapshot: DebuggerSnapshot): void {
    this.snapshot = snapshot;
    this.render();
    const eventName =
      snapshot.status === "paused"
        ? "debugger-paused"
        : snapshot.status === "complete"
          ? "debugger-complete"
          : snapshot.status === "error"
            ? "debugger-error"
            : "debugger-state-change";
    this.dispatchEvent(
      new CustomEvent(eventName, {
        detail: snapshot,
      }),
    );
  }

  private render(): void {
    setActivePoint(this.editor!, this.snapshot.point);
    this.renderToolbar();
    this.renderTeachingCard();
    this.renderScope();
    this.renderStack();
    this.renderBreakpoints();
    this.renderConsole();
    this.renderStatusbar();
    this.renderViewToggles();
  }

  private renderViewToggles(): void {
    if (!this.shadowRoot) return;
    const comments = this.requiredElement<HTMLButtonElement>('[data-view="comments"]');
    const questions = this.requiredElement<HTMLButtonElement>('[data-view="questions"]');
    comments.setAttribute("aria-pressed", String(this.commentsVisible));
    questions.setAttribute("aria-pressed", String(this.questionsVisible));
  }

  private renderToolbar(): void {
    const running = this.snapshot.status === "running";
    const terminal =
      this.snapshot.status === "complete" || this.snapshot.status === "error";
    const continueButton = this.requiredElement<HTMLButtonElement>(
      '[data-command="continue"]',
    );
    continueButton.replaceChildren(icon(running ? Pause : Play));
    continueButton.setAttribute(
      "aria-label",
      running ? "Pause execution" : "Resume execution",
    );
    continueButton.title = running ? "Pause" : "Resume (F8)";

    this.shadowRoot
      ?.querySelectorAll<HTMLButtonElement>(
        '[data-command="into"], [data-command="over"], [data-command="out"]',
      )
      .forEach((button) => {
        button.disabled = running || terminal || !this.engine;
      });

    const summary = this.requiredElement<HTMLElement>(".pause-summary");
    summary.dataset.status = this.snapshot.status;
    summary.textContent = this.summaryText();
  }

  private summaryText(): string {
    if (this.snapshot.status === "running") return "Running...";
    if (this.snapshot.status === "complete") return "Execution finished";
    if (this.snapshot.status === "error") {
      return this.snapshot.error?.message ?? "Execution failed";
    }
    if (this.snapshot.point) {
      return `Paused at ${this.snapshot.point.range.startLine}:${this.snapshot.point.range.startColumn + 1} - ${this.snapshot.point.label}`;
    }
    return "Ready to evaluate TypeScript";
  }

  private renderTeachingCard(): void {
    const point = this.snapshot.point;
    const title = this.requiredElement<HTMLElement>(".teaching-title");
    const copy = this.requiredElement<HTMLElement>(".teaching-copy");
    const token = this.requiredElement<HTMLElement>(".ast-token");
    const question = this.requiredElement<HTMLElement>(".teaching-question");

    if (this.snapshot.status === "error") {
      title.textContent = "Execution stopped";
      copy.textContent = this.snapshot.error?.message ?? "An unknown error occurred.";
      token.textContent = "RuntimeError";
      question.hidden = true;
      return;
    }

    if (this.snapshot.status === "complete") {
      title.textContent = "Program complete";
      copy.textContent = "Every reachable runtime node has executed. Restart to follow the state changes again.";
      token.textContent = "Complete";
      question.hidden = true;
      return;
    }

    if (!point) {
      title.textContent = "Ready to run";
      copy.textContent = "Execution pauses before each executable AST node. Type-only syntax is parsed but skipped at runtime.";
      token.textContent = "Program";
      question.hidden = true;
      return;
    }

    const lessonNote = this._teachingNotes[point.range.startLine];
    title.textContent = lessonNote?.title ?? point.label;
    renderMarkdown(
      copy,
      lessonNote?.explanation ??
        runtimeTeachingNotes[point.nodeType] ??
        "This is the next executable syntax node in the current control-flow path.",
    );
    token.textContent = `${point.nodeType} - ${point.range.startLine}:${point.range.startColumn + 1}`;
    this.renderQuestion(lessonNote, point.range.startLine);
  }

  private renderQuestion(note: TeachingNote | undefined, line: number): void {
    const container = this.requiredElement<HTMLElement>(".teaching-question");

    if (!this.questionsVisible || !note?.question) {
      container.hidden = true;
      return;
    }

    if (this.teachingLine !== line) {
      this.teachingLine = line;
      this.solutionVisible = false;
      this.requiredElement<HTMLTextAreaElement>(".question-response").value = "";
    }

    container.hidden = false;
    renderMarkdown(this.requiredElement<HTMLElement>(".question-prompt"), note.question);
    const solution = this.requiredElement<HTMLElement>(".teaching-solution");
    const toggle = this.requiredElement<HTMLButtonElement>(".solution-toggle");
    solution.hidden = !this.solutionVisible;
    toggle.textContent = this.solutionVisible ? "Hide solution" : "Reveal solution";

    if (this.solutionVisible) {
      renderMarkdown(
        this.requiredElement<HTMLElement>(".solution-copy"),
        note.solution ?? note.explanation,
      );
    }
  }

  private renderScope(): void {
    const content = this.requiredElement<HTMLElement>(".scope-content");
    const scopes = this.snapshot.point?.scopes ?? [];
    content.replaceChildren();

    if (scopes.length === 0) {
      content.append(this.emptyState("No active scope"));
    } else {
      for (const scope of scopes) {
        const group = document.createElement("div");
        group.className = "scope-group";
        const name = document.createElement("div");
        name.className = "scope-name";
        name.textContent = scope.name;
        group.append(name);

        for (const entry of scope.entries) {
          group.append(this.renderScopeEntry(entry));
        }

        content.append(group);
      }
    }

    this.setSectionCount("scope", scopes.reduce((total, scope) => total + scope.entries.length, 0));
  }

  private renderScopeEntry(entry: ScopeEntry): HTMLElement {
    const row = document.createElement("div");
    row.className = "value-row";
    const name = document.createElement("span");
    name.className = "value-name";
    const kind = document.createElement("span");
    kind.className = "value-kind";
    kind.textContent = entry.kind;
    name.append(kind, document.createTextNode(entry.name));
    row.append(name, this.renderValue(entry.value, new WeakSet()));
    return row;
  }

  private renderValue(value: unknown, seen: WeakSet<object>): HTMLElement {
    if (!isExpandable(value)) {
      const span = document.createElement("span");
      span.className = `value-preview ${valueClass(value)}`;
      span.textContent = previewValue(value);
      return span;
    }

    if (seen.has(value)) {
      const circular = document.createElement("span");
      circular.className = "value-preview value-object";
      circular.textContent = "[Circular]";
      return circular;
    }

    seen.add(value);
    const details = document.createElement("details");
    details.className = "object-value value-preview";
    const summary = document.createElement("summary");
    summary.textContent = previewValue(value);
    details.append(summary);
    const properties = document.createElement("div");
    properties.className = "object-properties";
    const entries = Object.entries(value).slice(0, 30);

    for (const [key, propertyValue] of entries) {
      const property = document.createElement("div");
      property.className = "object-property";
      const propertyKey = document.createElement("span");
      propertyKey.className = "property-key";
      propertyKey.textContent = key;
      property.append(propertyKey, this.renderValue(propertyValue, seen));
      properties.append(property);
    }

    if (entries.length === 0) {
      properties.append(this.emptyState("No enumerable properties"));
    }

    details.append(properties);
    return details;
  }

  private renderStack(): void {
    const content = this.requiredElement<HTMLElement>(".stack-content");
    const stack = this.snapshot.point?.callStack ?? [];
    content.replaceChildren();

    if (stack.length === 0) {
      content.append(this.emptyState("No active frames"));
    } else {
      for (const frame of stack) {
        const row = document.createElement("div");
        row.className = "frame-row";
        const name = document.createElement("span");
        name.className = "frame-name";
        name.textContent = frame.name;
        const location = document.createElement("span");
        location.className = "frame-location";
        location.textContent = `${frame.line}:${frame.column + 1}`;
        row.append(name, location);
        content.append(row);
      }
    }

    this.setSectionCount("stack", stack.length);
  }

  private renderBreakpoints(): void {
    if (!this.shadowRoot) return;
    const content = this.requiredElement<HTMLElement>(".breakpoint-content");
    const lines = this.editor ? readBreakpointLines(this.editor) : this.breakpoints;
    content.replaceChildren();

    if (lines.length === 0) {
      content.append(this.emptyState("Click the gutter to add one"));
    } else {
      for (const line of lines) {
        const row = document.createElement("div");
        row.className = "breakpoint-row";
        const dot = document.createElement("span");
        dot.className = "breakpoint-dot";
        const label = document.createElement("span");
        label.textContent = "lesson.ts";
        const location = document.createElement("span");
        location.className = "breakpoint-location";
        location.textContent = `:${line}`;
        label.append(location);
        const remove = document.createElement("button");
        remove.className = "breakpoint-remove";
        remove.type = "button";
        remove.dataset.removeBreakpoint = String(line);
        remove.setAttribute("aria-label", `Remove breakpoint at line ${line}`);
        remove.textContent = "x";
        row.append(dot, label, remove);
        content.append(row);
      }
    }

    this.setSectionCount("breakpoints", lines.length);
  }

  private renderConsole(): void {
    if (!this.shadowRoot) return;
    const content = this.requiredElement<HTMLElement>(".console-content");
    content.replaceChildren();

    if (this.consoleEntries.length === 0) {
      content.append(this.emptyState("Console output appears here"));
    } else {
      for (const entry of this.consoleEntries) {
        const row = document.createElement("div");
        row.className = "console-row";
        row.dataset.level = entry.level;
        const prefix = document.createElement("span");
        prefix.className = "console-prefix";
        prefix.textContent = entry.level === "log" ? ">" : "!";
        const value = document.createElement("span");
        value.textContent = entry.values.map((item) => previewValue(item, true)).join(" ");
        row.append(prefix, value);
        content.append(row);
      }
    }

    this.setSectionCount("console", this.consoleEntries.length);
  }

  private renderStatusbar(): void {
    const state = this.requiredElement<HTMLElement>(".statusbar-state");
    state.dataset.status = this.snapshot.status;
    this.requiredElement<HTMLElement>(".status-label").textContent = formatStatus(
      this.snapshot.status,
    );
    const point = this.snapshot.point;
    this.requiredElement<HTMLElement>(".cursor-location").textContent = point
      ? `Ln ${point.range.startLine}, Col ${point.range.startColumn + 1}`
      : "Ln 1, Col 1";
  }

  private setSectionCount(section: string, count: number): void {
    const target = this.shadowRoot?.querySelector<HTMLElement>(
      `[data-section="${section}"] .section-count`,
    );

    if (target) target.textContent = String(count);
  }

  private emptyState(text: string): HTMLElement {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = text;
    return empty;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ts-teaching-debugger": TsTeachingDebuggerElement;
  }
}

if (!customElements.get("ts-teaching-debugger")) {
  customElements.define("ts-teaching-debugger", TsTeachingDebuggerElement);
}

export type { TeachingNote, TeachingNotes } from "./teaching";

export type {
  ConsoleEntry,
  DebuggerSnapshot,
  ExecutionPoint,
} from "./core/types";
