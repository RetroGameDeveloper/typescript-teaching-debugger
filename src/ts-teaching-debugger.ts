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
  setGuidedLine,
} from "./editor";
import { debuggerStyles } from "./styles";
import {
  parseTeachingComments,
  parseTeachingSymbols,
  teachingNotesFromComments,
  type TeachingNote,
  type TeachingNotes,
  type TeachingComment,
  type TeachingSymbol,
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
    <div class="workspace">
      <section class="editor-pane" aria-label="TypeScript source">
        <div class="editor-host"></div>
        <div class="guided-overlay" hidden>
          <section class="guided-dialog" role="dialog" aria-modal="false" aria-labelledby="guided-title">
            <header class="guided-header">
              <span class="guided-kicker">Guided walkthrough</span>
              <span class="guided-progress"></span>
              <button class="guided-close" type="button" aria-label="Close guided walkthrough">x</button>
            </header>
            <div class="guided-body">
              <h2 class="guided-title" id="guided-title"></h2>
              <div class="guided-question" hidden>
                <p class="question-label">Question</p>
                <div class="guided-question-prompt"></div>
                <div class="guided-question-choices" role="radiogroup" aria-label="Choose an answer"></div>
                <button class="guided-solution-toggle" type="button">Check answer</button>
                <div class="guided-solution" hidden>
                  <p class="solution-label">Solution</p>
                  <div class="guided-solution-copy"></div>
                </div>
              </div>
              <div class="guided-documentation"></div>
            </div>
            <footer class="guided-footer">
              <button class="guided-previous" type="button">Previous</button>
              <button class="guided-next" type="button">Next</button>
            </footer>
          </section>
        </div>
      </section>
      <aside class="sidebar" aria-label="Debugger details">
        <div class="sidebar-control-panel">
          <div class="runtime-sidebar-controls" role="toolbar" aria-label="Debugger controls">
            <button class="tool-button" data-command="continue" type="button" aria-label="Resume execution" title="Resume (F8)"></button>
            <button class="tool-button" data-command="over" type="button" aria-label="Step over" title="Step over (F10)"></button>
            <button class="tool-button" data-command="into" type="button" aria-label="Step into" title="Step into (F11)"></button>
            <button class="tool-button" data-command="out" type="button" aria-label="Step out" title="Step out (Shift+F11)"></button>
            <span class="toolbar-separator" aria-hidden="true"></span>
            <button class="tool-button" data-command="restart" type="button" aria-label="Restart" title="Restart (Ctrl+Shift+F5)"></button>
            <button class="view-toggle" data-view="guided" type="button" aria-pressed="true">Guided</button>
          </div>
          <div class="guided-sidebar-controls" role="group" aria-label="Guided navigation" hidden>
            <button class="sidebar-guided-previous" type="button">Previous</button>
            <span class="sidebar-guided-progress"></span>
            <button class="sidebar-guided-next" type="button">Next</button>
            <button class="sidebar-guided-exit" type="button">Exit</button>
          </div>
          <div class="pause-summary" data-status="ready">Ready to evaluate TypeScript</div>
        </div>
        <div class="teaching-card">
          <p class="teaching-kicker">Why this line exists</p>
          <p class="teaching-title">Ready to run</p>
          <div class="teaching-question" hidden>
            <p class="question-label">Question</p>
            <div class="question-prompt"></div>
            <div class="question-choices" role="radiogroup" aria-label="Choose an answer"></div>
            <button class="solution-toggle" type="button">Check answer</button>
            <div class="teaching-solution" hidden>
              <p class="solution-label">Solution</p>
              <div class="solution-copy"></div>
            </div>
          </div>
          <div class="teaching-copy">Execution pauses before each executable AST node. Type-only syntax is parsed but skipped at runtime.</div>
          <span class="ast-token">Program</span>
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

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading?.[1] && heading[2]) {
      list = undefined;
      const headingElement = document.createElement("h3");
      headingElement.className =
        `markdown-heading markdown-heading-${heading[1].length}`;
      appendInlineMarkdown(headingElement, heading[2]);
      target.append(headingElement);
      continue;
    }

    list = undefined;
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, line);
    target.append(paragraph);
  }
}

interface MultipleChoiceAssessment {
  answer: number;
  choices: string[];
}

function multipleChoiceAssessment(note: TeachingNote): MultipleChoiceAssessment {
  if (
    note.choices &&
    note.choices.length >= 2 &&
    note.answer !== undefined &&
    note.answer >= 0 &&
    note.answer < note.choices.length
  ) {
    return { answer: note.answer, choices: note.choices };
  }

  return {
    answer: 0,
    choices: [
      note.solution ?? note.explanation,
      "This restarts the algorithm and clears its current progress.",
      "This skips the remaining work and immediately ends the program.",
    ],
  };
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

function hoverValue(value: unknown): string {
  if (typeof value === "function") return previewValue(value);
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type?: string }).type === "user-function"
  ) {
    return previewValue(value);
  }

  if (typeof value === "object" && value !== null) {
    const seen = new WeakSet<object>();

    try {
      const serialized = JSON.stringify(
        value,
        (_key, nested) => {
          if (typeof nested === "object" && nested !== null) {
            if (seen.has(nested)) return "[Circular]";
            seen.add(nested);
          }
          if (typeof nested === "function") return previewValue(nested);
          return nested;
        },
        2,
      );
      return serialized && serialized.length > 800
        ? `${serialized.slice(0, 797)}...`
        : serialized ?? previewValue(value);
    } catch {
      return previewValue(value);
    }
  }

  return previewValue(value);
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
  private _autoResetDelay = 1000;
  private _code = "";
  private completionResetTimer?: ReturnType<typeof setTimeout>;
  private consoleEntries: ConsoleEntry[] = [];
  private editor?: EditorView;
  private engine?: DebuggerEngine;
  private listeners?: AbortController;
  private resetTimer?: ReturnType<typeof setTimeout>;
  private resetSequence = 0;
  private snapshot: DebuggerSnapshot = { status: "ready" };
  private suppressEditorChange = false;
  private _teachingNotes: TeachingNotes = {};
  private questionSelection?: number;
  private solutionVisible = false;
  private teachingLine?: number;
  private teachingSymbols: TeachingSymbol[] = [];
  private guidedComments: TeachingComment[] = [];
  private guidedEnabled = true;
  private guidedIndex = 0;
  private guidedQuestionSelection?: number;
  private guidedSolutionVisible = false;
  private _guidedSteps: number[] = [];

  get code(): string {
    return this.editor?.state.doc.toString() ?? this._code;
  }

  get autoResetDelay(): number {
    return this._autoResetDelay;
  }

  set autoResetDelay(delay: number) {
    this._autoResetDelay = Number.isFinite(delay) ? Math.max(-1, delay) : 1000;
  }

  set code(value: string) {
    this._code = value ?? "";

    if (this.editor) {
      this.guidedIndex = 0;
      this.guidedQuestionSelection = undefined;
      this.guidedSolutionVisible = false;
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

  get guidedMode(): boolean {
    return this.guidedEnabled;
  }

  set guidedMode(enabled: boolean) {
    this.guidedEnabled = Boolean(enabled);
    this.guidedIndex = 0;
    this.guidedQuestionSelection = undefined;
    this.guidedSolutionVisible = false;
    if (this.shadowRoot && this.editor) {
      setActivePoint(this.editor, this.guidedEnabled ? undefined : this.snapshot.point);
      this.renderGuidedDialog();
      this.renderTeachingCard();
    }
    this.renderViewToggles();
  }

  get guidedSteps(): number[] {
    return [...this._guidedSteps];
  }

  set guidedSteps(lines: Iterable<number>) {
    this._guidedSteps = [...lines].filter(
      (line) => Number.isInteger(line) && line > 0,
    );
    this.refreshGuidedComments();
    this.guidedIndex = 0;
    if (this.shadowRoot) {
      this.renderGuidedDialog();
    }
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
      createHover: (identifier, position) =>
        this.createIdentifierHover(identifier, position),
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
    clearTimeout(this.completionResetTimer);
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
    clearTimeout(this.completionResetTimer);
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
          if (button.dataset.view === "guided") {
            this.guidedMode = !this.guidedMode;
          }
        },
        { signal },
      );
    });

    this.requiredElement<HTMLButtonElement>(".solution-toggle").addEventListener(
      "click",
      () => {
        if (this.guidedEnabled) {
          if (this.guidedQuestionSelection === undefined) return;
          this.guidedSolutionVisible = !this.guidedSolutionVisible;
          this.renderGuidedDialog();
        } else {
          if (this.questionSelection === undefined) return;
          this.solutionVisible = !this.solutionVisible;
        }
        this.renderTeachingCard();
      },
      { signal },
    );

    this.requiredElement<HTMLButtonElement>(".guided-close").addEventListener(
      "click",
      () => {
        this.guidedMode = false;
      },
      { signal },
    );

    this.requiredElement<HTMLButtonElement>(".guided-previous").addEventListener(
      "click",
      () => this.moveGuidedStep(-1),
      { signal },
    );

    this.requiredElement<HTMLButtonElement>(".guided-next").addEventListener(
      "click",
      () => this.moveGuidedStep(1),
      { signal },
    );

    this.requiredElement<HTMLButtonElement>(".sidebar-guided-previous").addEventListener(
      "click",
      () => this.moveGuidedStep(-1),
      { signal },
    );

    this.requiredElement<HTMLButtonElement>(".sidebar-guided-next").addEventListener(
      "click",
      () => this.moveGuidedStep(1),
      { signal },
    );

    this.requiredElement<HTMLButtonElement>(".sidebar-guided-exit").addEventListener(
      "click",
      () => {
        this.guidedMode = false;
      },
      { signal },
    );

    this.requiredElement<HTMLButtonElement>(".guided-solution-toggle").addEventListener(
      "click",
      () => {
        if (this.guidedQuestionSelection === undefined) return;
        this.guidedSolutionVisible = !this.guidedSolutionVisible;
        this.renderGuidedDialog();
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
    this.teachingSymbols = parseTeachingSymbols(this._code);
    this.refreshGuidedComments();
    this.applyCommentVisibility();
    if (this.guidedEnabled && this.shadowRoot) {
      this.renderGuidedDialog();
    }
  }

  private refreshGuidedComments(): void {
    const comments = parseTeachingComments(this._code);

    if (this._guidedSteps.length > 0) {
      this.guidedComments = this._guidedSteps.flatMap((line) => {
        const comment = comments.find((candidate) => candidate.line === line);
        return comment ? [comment] : [];
      });
    } else {
      this.guidedComments = comments;
    }

    this.guidedIndex = Math.min(
      this.guidedIndex,
      Math.max(0, this.guidedComments.length - 1),
    );
  }

  private moveGuidedStep(direction: -1 | 1): void {
    const next = this.guidedIndex + direction;

    if (next >= this.guidedComments.length) {
      this.guidedMode = false;
      return;
    }

    this.guidedIndex = Math.max(0, next);
    this.guidedQuestionSelection = undefined;
    this.guidedSolutionVisible = false;
    this.renderGuidedDialog();
    this.renderTeachingCard();
  }

  private renderGuidedDialog(): void {
    if (!this.shadowRoot || !this.editor) return;
    const overlay = this.requiredElement<HTMLElement>(".guided-overlay");
    const comment = this.guidedComments[this.guidedIndex];

    if (!this.guidedEnabled || !comment) {
      overlay.hidden = true;
      setGuidedLine(this.editor);
      return;
    }

    overlay.hidden = false;
    const guidedLine = this.guidedAnchorLine(comment);
    setGuidedLine(this.editor, guidedLine);
    this.requiredElement<HTMLElement>(".guided-title").textContent = comment.title;
    this.requiredElement<HTMLElement>(".guided-progress").textContent =
      `${this.guidedIndex + 1} / ${this.guidedComments.length}`;
    const documentation = this.requiredElement<HTMLElement>(".guided-documentation");

    const question = this.requiredElement<HTMLElement>(".guided-question");
    question.hidden = !comment.question;
    documentation.hidden = Boolean(comment.question);

    if (!comment.question) renderMarkdown(documentation, comment.explanation);

    if (!question.hidden && comment.question) {
      renderMarkdown(
        this.requiredElement<HTMLElement>(".guided-question-prompt"),
        comment.question,
      );
      this.renderChoiceOptions(
        this.requiredElement<HTMLElement>(".guided-question-choices"),
        comment,
        this.guidedQuestionSelection,
        this.guidedSolutionVisible,
        (selection) => {
          this.guidedQuestionSelection = selection;
          this.guidedSolutionVisible = false;
          this.renderGuidedDialog();
          this.renderTeachingCard();
        },
      );
    }

    const solution = this.requiredElement<HTMLElement>(".guided-solution");
    solution.hidden = !this.guidedSolutionVisible;
    const solutionToggle = this.requiredElement<HTMLButtonElement>(
      ".guided-solution-toggle",
    );
    solutionToggle.disabled = this.guidedQuestionSelection === undefined;
    solutionToggle.textContent = this.guidedSolutionVisible
      ? "Hide explanation"
      : "Check answer";

    if (this.guidedSolutionVisible) {
      const assessment = multipleChoiceAssessment(comment);
      solution.dataset.result =
        this.guidedQuestionSelection === assessment.answer ? "correct" : "incorrect";
      this.requiredElement<HTMLElement>(".guided-solution .solution-label").textContent =
        this.guidedQuestionSelection === assessment.answer ? "Correct" : "Not quite";
      renderMarkdown(
        this.requiredElement<HTMLElement>(".guided-solution-copy"),
        comment.solution ?? comment.explanation,
      );
    }

    this.requiredElement<HTMLButtonElement>(".guided-previous").disabled =
      this.guidedIndex === 0;
    const next = this.requiredElement<HTMLButtonElement>(".guided-next");
    next.textContent =
      this.guidedIndex === this.guidedComments.length - 1 ? "Finish" : "Next";
    this.renderViewToggles();
    this.positionGuidedDialog(guidedLine);
  }

  private guidedAnchorLine(comment: TeachingComment): number {
    if (!this.editor) return comment.line;
    const target = this.editor.state.doc.line(comment.line).text.trimStart();
    return target.startsWith("/**")
      ? this.editor.state.doc.lineAt(comment.from).number
      : comment.line;
  }

  private positionGuidedDialog(lineNumber: number): void {
    if (!this.editor) return;

    requestAnimationFrame(() => {
      if (!this.editor || !this.guidedEnabled) return;
      const line = this.editor.state.doc.line(lineNumber);
      const coordinates = this.editor.coordsAtPos(line.from);
      const pane = this.requiredElement<HTMLElement>(".editor-pane");
      const dialog = this.requiredElement<HTMLElement>(".guided-dialog");

      if (!coordinates) {
        dialog.style.top = "18px";
        return;
      }

      const paneBounds = pane.getBoundingClientRect();
      const dialogHeight = dialog.offsetHeight || 320;
      const below = coordinates.bottom - paneBounds.top + 10;
      const above = coordinates.top - paneBounds.top - dialogHeight - 10;
      const top = below + dialogHeight <= paneBounds.height - 12 ? below : above;
      dialog.style.top = `${Math.max(12, top)}px`;
    });
  }

  private createIdentifierHover(
    identifier: string,
    position: number,
  ): HTMLElement | undefined {
    let scopeEntry: ScopeEntry | undefined;

    for (const scope of this.snapshot.point?.scopes ?? []) {
      scopeEntry = scope.entries.find((entry) => entry.name === identifier);
      if (scopeEntry) break;
    }

    const symbol = this.teachingSymbols
      .filter((candidate) => candidate.name === identifier)
      .sort(
        (left, right) =>
          Math.abs(left.position - position) - Math.abs(right.position - position),
      )[0];

    if (!scopeEntry && !symbol) return undefined;

    const card = document.createElement("div");
    card.className = "cm-tooltip-teaching";
    const header = document.createElement("div");
    header.className = "hover-header";
    const name = document.createElement("code");
    name.className = "hover-name";
    name.textContent = identifier;
    const kind = document.createElement("span");
    kind.className = "hover-kind";
    kind.textContent = symbol?.kind ?? scopeEntry?.kind ?? "variable";
    header.append(name, kind);
    card.append(header);

    if (scopeEntry) {
      const valueLabel = document.createElement("div");
      valueLabel.className = "hover-label";
      valueLabel.textContent = "Current value";
      const value = document.createElement("pre");
      value.className = "hover-value";
      value.textContent = hoverValue(scopeEntry.value);
      card.append(valueLabel, value);
    }

    if (symbol) {
      const documentation = document.createElement("div");
      documentation.className = "hover-documentation";
      const documentationTitle = document.createElement("div");
      documentationTitle.className = "hover-doc-title";
      documentationTitle.textContent = symbol.note.title;
      const documentationCopy = document.createElement("div");
      documentationCopy.className = "hover-doc-copy";
      const argumentsMarkdown =
        symbol.kind === "function" && symbol.note.arguments
          ? [
              "### Arguments",
              ...Object.entries(symbol.note.arguments).map(
                ([name, description]) => `* \`${name}\` - ${description}`,
              ),
            ].join("\n")
          : "";
      renderMarkdown(
        documentationCopy,
        [symbol.note.explanation, argumentsMarkdown].filter(Boolean).join("\n\n"),
      );
      documentation.append(documentationTitle, documentationCopy);
      card.append(documentation);
    }

    return card;
  }

  private applyCommentVisibility(): void {
    if (!this.editor) return;
    const ranges = parseTeachingComments(this._code).map(({ from, to }) => ({
      from,
      to,
    }));
    setCommentVisibility(this.editor, ranges, false);
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

    if (snapshot.status === "complete" && this._autoResetDelay >= 0) {
      clearTimeout(this.completionResetTimer);
      this.completionResetTimer = setTimeout(() => {
        if (this.snapshot.status === "complete") {
          void this.reset();
        }
      }, this._autoResetDelay);
    }
  }

  private render(): void {
    setActivePoint(this.editor!, this.guidedEnabled ? undefined : this.snapshot.point);
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
    const guided = this.requiredElement<HTMLButtonElement>('[data-view="guided"]');
    guided.setAttribute("aria-pressed", String(this.guidedEnabled));
    this.requiredElement<HTMLElement>(".runtime-sidebar-controls").hidden =
      this.guidedEnabled;
    this.requiredElement<HTMLElement>(".guided-sidebar-controls").hidden =
      !this.guidedEnabled;
    this.requiredElement<HTMLElement>(".sidebar-guided-progress").textContent =
      `${Math.min(this.guidedIndex + 1, this.guidedComments.length)} / ${this.guidedComments.length}`;
    this.requiredElement<HTMLButtonElement>(".sidebar-guided-previous").disabled =
      this.guidedIndex === 0;
    const next = this.requiredElement<HTMLButtonElement>(".sidebar-guided-next");
    next.disabled = this.guidedComments.length === 0;
    next.textContent =
      this.guidedIndex === this.guidedComments.length - 1 ? "Finish" : "Next";
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

    if (this.guidedEnabled) {
      const comment = this.guidedComments[this.guidedIndex];
      if (comment) {
        this.renderGuidedTeachingCard(comment, title, copy, token, question);
        return;
      }
    }

    copy.hidden = false;

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

  private renderGuidedTeachingCard(
    comment: TeachingComment,
    title: HTMLElement,
    copy: HTMLElement,
    token: HTMLElement,
    question: HTMLElement,
  ): void {
    title.textContent = comment.title;
    token.textContent = `Guided step ${this.guidedIndex + 1} / ${this.guidedComments.length}`;

    if (!comment.question) {
      question.hidden = true;
      copy.hidden = false;
      renderMarkdown(copy, comment.explanation);
      return;
    }

    copy.hidden = true;
    question.hidden = false;
    renderMarkdown(
      this.requiredElement<HTMLElement>(".question-prompt"),
      comment.question,
    );
    this.renderChoiceOptions(
      this.requiredElement<HTMLElement>(".question-choices"),
      comment,
      this.guidedQuestionSelection,
      this.guidedSolutionVisible,
      (selection) => {
        this.guidedQuestionSelection = selection;
        this.guidedSolutionVisible = false;
        this.renderGuidedDialog();
        this.renderTeachingCard();
      },
    );
    const solution = this.requiredElement<HTMLElement>(".teaching-solution");
    solution.hidden = !this.guidedSolutionVisible;
    const toggle = this.requiredElement<HTMLButtonElement>(".solution-toggle");
    toggle.disabled = this.guidedQuestionSelection === undefined;
    toggle.textContent = this.guidedSolutionVisible
      ? "Hide explanation"
      : "Check answer";

    if (this.guidedSolutionVisible) {
      const assessment = multipleChoiceAssessment(comment);
      const correct = this.guidedQuestionSelection === assessment.answer;
      solution.dataset.result = correct ? "correct" : "incorrect";
      this.requiredElement<HTMLElement>(".teaching-solution .solution-label").textContent =
        correct ? "Correct" : "Not quite";
      renderMarkdown(
        this.requiredElement<HTMLElement>(".solution-copy"),
        comment.solution ?? comment.explanation,
      );
    }
  }

  private renderQuestion(note: TeachingNote | undefined, line: number): void {
    const container = this.requiredElement<HTMLElement>(".teaching-question");

    if (!note?.question) {
      container.hidden = true;
      return;
    }

    if (this.teachingLine !== line) {
      this.teachingLine = line;
      this.questionSelection = undefined;
      this.solutionVisible = false;
    }

    container.hidden = false;
    renderMarkdown(this.requiredElement<HTMLElement>(".question-prompt"), note.question);
    this.renderChoiceOptions(
      this.requiredElement<HTMLElement>(".question-choices"),
      note,
      this.questionSelection,
      this.solutionVisible,
      (selection) => {
        this.questionSelection = selection;
        this.solutionVisible = false;
        this.renderQuestion(note, line);
      },
    );
    const solution = this.requiredElement<HTMLElement>(".teaching-solution");
    const toggle = this.requiredElement<HTMLButtonElement>(".solution-toggle");
    solution.hidden = !this.solutionVisible;
    toggle.disabled = this.questionSelection === undefined;
    toggle.textContent = this.solutionVisible ? "Hide explanation" : "Check answer";

    if (this.solutionVisible) {
      const assessment = multipleChoiceAssessment(note);
      solution.dataset.result =
        this.questionSelection === assessment.answer ? "correct" : "incorrect";
      this.requiredElement<HTMLElement>(".teaching-solution .solution-label").textContent =
        this.questionSelection === assessment.answer ? "Correct" : "Not quite";
      renderMarkdown(
        this.requiredElement<HTMLElement>(".solution-copy"),
        note.solution ?? note.explanation,
      );
    }
  }

  private renderChoiceOptions(
    container: HTMLElement,
    note: TeachingNote,
    selection: number | undefined,
    revealed: boolean,
    onSelect: (selection: number) => void,
  ): void {
    const assessment = multipleChoiceAssessment(note);
    container.replaceChildren();

    assessment.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "choice-option";
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(selection === index));
      button.dataset.selected = String(selection === index);
      button.disabled = revealed;

      if (revealed && index === assessment.answer) button.dataset.result = "correct";
      else if (revealed && index === selection) button.dataset.result = "incorrect";

      const marker = document.createElement("span");
      marker.className = "choice-marker";
      marker.textContent = String.fromCharCode(65 + index);
      const copy = document.createElement("div");
      copy.className = "choice-copy";
      renderMarkdown(copy, choice);
      button.append(marker, copy);
      button.addEventListener("click", () => onSelect(index));
      container.append(button);
    });
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
