import { EditorView } from "@codemirror/view";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  ChevronDown,
  CircleSlash2,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Undo2,
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
  setExpandedComments,
  setGuidedLine,
  type BreakpointKind,
} from "./editor";
import { renderMarkdown } from "./markdown";
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

export type TeachingPlacement = "bottom" | "sidebar";

const teachingCardTemplate = `
        <div class="teaching-card" hidden>
          <h2 class="teaching-title">Quick check</h2>
          <div class="teaching-question" hidden>
            <div class="question-prompt"></div>
            <div class="question-choices" role="radiogroup" aria-label="Choose an answer"></div>
            <button class="solution-toggle" type="button">Check answer</button>
            <div class="teaching-solution" hidden>
              <p class="solution-label">Solution</p>
              <div class="solution-copy"></div>
            </div>
          </div>
        </div>`;

const componentTemplate = `
  <style>${debuggerStyles}</style>
  <div class="shell" data-teaching-placement="sidebar" tabindex="0">
    <header class="tab-strip">
      <div class="file-tab"><span class="ts-badge">TS</span><span>lesson.ts</span></div>
      <div class="mode-badge"><span class="mode-dot"></span>AST runtime</div>
    </header>
    <div class="workspace">
      <section class="editor-pane" aria-label="TypeScript source">
        <div class="editor-host"></div>
      </section>
      <aside class="sidebar" aria-label="Debugger details">
        <div class="sidebar-control-panel">
          <div class="runtime-sidebar-controls" role="toolbar" aria-label="Debugger controls">
            <button class="tool-button" data-command="back" type="button" aria-label="Step back" title="Step back"></button>
            <button class="tool-button" data-command="continue" type="button" aria-label="Resume execution" title="Resume (F8)"></button>
            <button class="tool-button" data-command="over" type="button" aria-label="Step over" title="Step over (F10)"></button>
            <button class="tool-button" data-command="into" type="button" aria-label="Step into" title="Step into (F11)"></button>
            <button class="tool-button" data-command="out" type="button" aria-label="Step out" title="Step out (Shift+F11)"></button>
            <span class="toolbar-separator" aria-hidden="true"></span>
            <button class="tool-button" data-command="restart" type="button" aria-label="Restart" title="Restart (Ctrl+Shift+F5)"></button>
            <span class="toolbar-separator" aria-hidden="true"></span>
            <button class="tool-button debug-toggle" data-debug-toggle="notes" type="button" aria-label="Ignore lesson notes" aria-pressed="false" title="Ignore lesson-note pauses"></button>
            <button class="tool-button debug-toggle" data-debug-toggle="breakpoints" type="button" aria-label="Deactivate breakpoints" aria-pressed="false" title="Deactivate breakpoints"></button>
          </div>
        </div>
        <div class="teaching-host" data-teaching-host="sidebar" hidden></div>
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
    <section class="teaching-host teaching-bottom-panel" data-teaching-host="bottom" aria-label="Lesson explanation">
      ${teachingCardTemplate}
    </section>
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
  static readonly observedAttributes = ["code", "readonly", "teaching-placement"];

  private _breakpoints = new Set<number>();
  private _oneTimeBreakpoints = new Set<number>();
  private _autoResetDelay = 1000;
  private _code = "";
  private _teachingPlacement: TeachingPlacement = "sidebar";
  private expandedCommentKey?: string;
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
  private _providedTeachingNotes?: TeachingNotes;
  private teachingSymbols: TeachingSymbol[] = [];
  private guidedComments: TeachingComment[] = [];
  private guidedIndex = 0;
  private guidedQuestionSelection?: number;
  private guidedSolutionVisible = false;
  private lessonPauseLines = new Set<number>();
  private consumedOneTimeBreakpoints = new Set<number>();
  private consumedLessonNotes = new Set<number>();
  private ignoreLessonNotes = false;
  private breakpointsActive = true;
  private executionHistory: Array<{
    consumedBreakpoints: number[];
    consumedNotes: number[];
    operationIndex: number;
  }> = [];
  private followingRuntime = false;

  get code(): string {
    return this.editor?.state.doc.toString() ?? this._code;
  }

  get autoResetDelay(): number {
    return this._autoResetDelay;
  }

  set autoResetDelay(delay: number) {
    this._autoResetDelay = Number.isFinite(delay) ? Math.max(-1, delay) : 1000;
  }

  get breakpointsEnabled(): boolean {
    return this.breakpointsActive;
  }

  set breakpointsEnabled(enabled: boolean) {
    this.breakpointsActive = Boolean(enabled);
    this.syncBreakpoints();
    if (this.shadowRoot) this.renderToolbar();
  }

  get pauseOnTeachingNotes(): boolean {
    return !this.ignoreLessonNotes;
  }

  set pauseOnTeachingNotes(enabled: boolean) {
    this.ignoreLessonNotes = !enabled;
    this.syncBreakpoints();
    if (this.shadowRoot) this.renderToolbar();
  }

  set code(value: string) {
    this._code = value ?? "";

    if (this.editor) {
      this.followingRuntime = false;
      this.expandedCommentKey = undefined;
      this.consumedOneTimeBreakpoints.clear();
      this.consumedLessonNotes.clear();
      this.executionHistory = [];
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
    return [...this.userBreakpoints()].sort((left, right) => left - right);
  }

  set breakpoints(lines: Iterable<number>) {
    this._breakpoints = new Set(
      [...lines].filter((line) => Number.isInteger(line) && line > 0),
    );
    for (const line of this._breakpoints) this._oneTimeBreakpoints.delete(line);
    this.syncBreakpoints();
  }

  get oneTimeBreakpoints(): number[] {
    return [...this.allOneTimeBreakpoints()].sort((left, right) => left - right);
  }

  set oneTimeBreakpoints(lines: Iterable<number>) {
    this._oneTimeBreakpoints = new Set(
      [...lines].filter((line) => Number.isInteger(line) && line > 0),
    );
    for (const line of this._oneTimeBreakpoints) this._breakpoints.delete(line);
    this.consumedOneTimeBreakpoints.clear();
    this.consumedLessonNotes.clear();
    this.syncBreakpoints();
  }

  get teachingPlacement(): TeachingPlacement {
    return this._teachingPlacement;
  }

  get teachingNotes(): TeachingNotes {
    return this._providedTeachingNotes ?? {};
  }

  set teachingNotes(value: TeachingNotes | undefined) {
    this._providedTeachingNotes = value;
    this.consumedLessonNotes.clear();
    if (this.editor) {
      this.refreshTeachingComments();
      void this.reset();
    }
  }

  set teachingPlacement(value: TeachingPlacement | string) {
    const placement: TeachingPlacement = value === "bottom" ? "bottom" : "sidebar";
    this._teachingPlacement = placement;
    if (this.getAttribute("teaching-placement") !== placement) {
      this.setAttribute("teaching-placement", placement);
    }
    this.applyTeachingPlacement();
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
    this.applyTeachingPlacement();
    this.addIcons();
    this.editor = createEditor({
      code: this._code,
      createHover: (identifier, position) =>
        this.createIdentifierHover(identifier, position),
      onBreakpointsChange: (line, kind) => this.handleBreakpointChange(line, kind),
      onChange: (source) => this.handleSourceChange(source),
      parent: this.requiredElement(".editor-host"),
      readOnly: this.hasAttribute("readonly"),
    });
    this.refreshTeachingComments();
    this.syncBreakpoints();
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

    if (name === "teaching-placement") {
      this.teachingPlacement = newValue === "bottom" ? "bottom" : "sidebar";
    }
  }

  private applyTeachingPlacement(): void {
    if (!this.shadowRoot) return;

    const shell = this.requiredElement<HTMLElement>(".shell");
    shell.dataset.teachingPlacement = this._teachingPlacement;
    const card = this.requiredElement<HTMLElement>(".teaching-card");
    const sidebarHost = this.requiredElement<HTMLElement>(
      '[data-teaching-host="sidebar"]',
    );
    const bottomHost = this.requiredElement<HTMLElement>(
      '[data-teaching-host="bottom"]',
    );
    const activeHost = this._teachingPlacement === "sidebar" ? sidebarHost : bottomHost;
    const idleHost = activeHost === sidebarHost ? bottomHost : sidebarHost;
    idleHost.hidden = true;
    activeHost.hidden = false;
    activeHost.append(card);
  }

  async reset(): Promise<DebuggerSnapshot> {
    clearTimeout(this.completionResetTimer);
    const sequence = ++this.resetSequence;
    this.engine?.requestPause();
    this.consoleEntries = [];
    this.consumedOneTimeBreakpoints.clear();
    this.consumedLessonNotes.clear();
    this.executionHistory = [];
    this.followingRuntime = false;
    this.expandedCommentKey = undefined;
    this.guidedIndex = 0;
    this.guidedQuestionSelection = undefined;
    this.guidedSolutionVisible = false;
    this.snapshot = { status: "ready" };
    this.render();

    if (!this.code.trim()) {
      this.engine = undefined;
      return this.snapshot;
    }

    try {
      const engine = new DebuggerEngine(this.code, {
        breakpoints: this.activePauseLines(),
        onConsole: (entry) => {
          this.consoleEntries.push(entry);
          this.renderConsole();
        },
      });
      this.engine = engine;
      if (sequence !== this.resetSequence || this.engine !== engine) return this.snapshot;
      this.syncBreakpoints();
      this.render();
      return this.snapshot;
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

  async stepBack(): Promise<DebuggerSnapshot> {
    if (this.executionHistory.length === 0) return this.reset();
    if (this.snapshot.status === "paused") this.executionHistory.pop();
    if (this.executionHistory.length === 0) return this.reset();
    const checkpoint = this.executionHistory.at(-1)!;
    this.consoleEntries = [];
    this.consumedOneTimeBreakpoints = new Set(checkpoint.consumedBreakpoints);
    this.consumedLessonNotes = new Set(checkpoint.consumedNotes);
    const engine = new DebuggerEngine(this.code, {
      onConsole: (entry) => {
        this.consoleEntries.push(entry);
      },
    });
    this.engine = engine;
    let result: DebuggerSnapshot = { status: "ready" };
    while (engine.operationIndex < checkpoint.operationIndex) {
      result = await engine.advance("into");
      if (result.status !== "paused") break;
    }
    engine.setBreakpoints(this.activePauseLines());
    this.followingRuntime = true;
    this.acceptSnapshot(result);
    return result;
  }

  private requiredElement<T extends Element>(selector: string): T {
    const element = this.shadowRoot?.querySelector<T>(selector);

    if (!element) throw new Error(`Debugger element not found: ${selector}`);
    return element;
  }

  private addIcons(): void {
    const icons: Record<string, IconNode> = {
      continue: Play,
      back: Undo2,
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

    this.requiredElement<HTMLButtonElement>('[data-debug-toggle="notes"]').append(
      icon(BookOpen),
    );
    this.requiredElement<HTMLButtonElement>('[data-debug-toggle="breakpoints"]').append(
      icon(CircleSlash2),
    );

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
          } else if (command === "back") {
            void this.stepBack();
          } else if (command) {
            void this.runCommand(command as DebugCommand);
          }
        },
        { signal },
      );
    });

    this.shadowRoot
      ?.querySelectorAll<HTMLButtonElement>("[data-debug-toggle]")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            if (button.dataset.debugToggle === "notes") {
              this.pauseOnTeachingNotes = this.ignoreLessonNotes;
            } else {
              this.breakpointsEnabled = !this.breakpointsActive;
            }
          },
          { signal },
        );
      });

    this.requiredElement<HTMLButtonElement>(".solution-toggle").addEventListener(
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
        this.removeBreakpoint(line);
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
    this._teachingNotes = this._providedTeachingNotes ?? teachingNotesFromComments(this._code);
    this.teachingSymbols = parseTeachingSymbols(this._code);
    this.refreshGuidedComments();
    const sourceLines = this._code.split("\n");
    this.lessonPauseLines = new Set(
      this.guidedComments
        .filter((comment) => {
          const source = sourceLines[comment.line - 1]?.trimStart() ?? "";
          return source.length > 0 && !source.startsWith("/**");
        })
        .map((comment) => comment.line),
    );
    this.syncBreakpoints();
    this.applyCommentVisibility();
    if (this.shadowRoot) {
      this.renderGuidedDialog();
    }
  }

  private refreshGuidedComments(): void {
    this.guidedComments = this._providedTeachingNotes
      ? Object.entries(this._providedTeachingNotes)
          .flatMap(([lineText, note]) => {
            const line = Number(lineText);
            const lineCount = this.editor?.state.doc.lines ?? 0;
            if (!Number.isInteger(line) || line < 1 || line > lineCount) return [];
            const from = this.editor?.state.doc.line(line).from ?? 0;
            return [{
              ...note,
              from,
              line,
              markdown: note.explanation,
              to: from,
            }];
          })
          .sort((left, right) => left.line - right.line)
      : parseTeachingComments(this._code);

    this.guidedIndex = Math.min(
      this.guidedIndex,
      Math.max(0, this.guidedComments.length - 1),
    );
  }

  private renderGuidedDialog(): void {
    if (!this.editor) return;
    const comment = this.followingRuntime ? undefined : this.activeTeachingComment();

    if (!comment) {
      setGuidedLine(this.editor);
      return;
    }

    const lineNumber = this.guidedAnchorLine(comment);
    const line = this.editor.state.doc.line(lineNumber);
    setActivePoint(this.editor);
    setGuidedLine(this.editor, lineNumber, { from: comment.from, to: line.to });
  }

  private activeTeachingComment(): TeachingComment | undefined {
    if (this.followingRuntime) {
      const line = this.snapshot.point?.range.startLine;
      return this.guidedComments.find((comment) => comment.line === line);
    }

    return this.guidedComments[this.guidedIndex];
  }

  private syncActiveTeachingComment(): void {
    if (!this.editor) return;
    const comment = this.activeTeachingComment();
    const key = comment ? String(comment.from) : "";
    if (key === this.expandedCommentKey) return;
    this.expandedCommentKey = key;
    setExpandedComments(this.editor, comment ? [comment.from] : []);
  }

  private guidedAnchorLine(comment: TeachingComment): number {
    if (!this.editor) return comment.line;
    const target = this.editor.state.doc.line(comment.line).text.trimStart();
    return target.startsWith("/**")
      ? this.editor.state.doc.lineAt(comment.from).number
      : comment.line;
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

    const isFunction =
      symbol?.kind === "function" ||
      scopeEntry?.kind === "function" ||
      typeof scopeEntry?.value === "function" ||
      (typeof scopeEntry?.value === "object" &&
        scopeEntry.value !== null &&
        "type" in scopeEntry.value &&
        (scopeEntry.value as { type?: string }).type === "user-function");

    if (scopeEntry && !isFunction) {
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
    const ranges = this.guidedComments.map(({ from, markdown, title, to }) => ({
      from,
      markdown,
      title,
      to,
    }));
    setCommentVisibility(this.editor, ranges);
  }

  private userBreakpoints(): Set<number> {
    return new Set([...this._breakpoints, ...this.allOneTimeBreakpoints()]);
  }

  private allOneTimeBreakpoints(): Set<number> {
    return new Set(
      [...this._oneTimeBreakpoints].filter(
        (line) =>
          !this._breakpoints.has(line) &&
          !this.consumedOneTimeBreakpoints.has(line),
      ),
    );
  }

  private activeLessonPauseLines(): Set<number> {
    if (this.ignoreLessonNotes) return new Set<number>();
    return new Set(
      [...this.lessonPauseLines].filter(
        (line) => !this.consumedLessonNotes.has(line),
      ),
    );
  }

  private activePauseLines(): Set<number> {
    return new Set([
      ...(this.breakpointsActive ? this.userBreakpoints() : []),
      ...this.activeLessonPauseLines(),
    ]);
  }

  private syncBreakpoints(): void {
    this.engine?.setBreakpoints(this.activePauseLines());
    if (this.editor) {
      setEditorBreakpoints(
        this.editor,
        this.userBreakpoints(),
        this.allOneTimeBreakpoints(),
      );
    }
    if (this.shadowRoot) this.renderBreakpoints();
  }

  private scheduleReset(delay: number): void {
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => void this.reset(), delay);
  }

  private handleBreakpointChange(
    line: number,
    kind: BreakpointKind | undefined,
  ): void {
    this._breakpoints.delete(line);
    this._oneTimeBreakpoints.delete(line);
    this.consumedOneTimeBreakpoints.delete(line);
    if (kind === "regular") this._breakpoints.add(line);
    if (kind === "once") this._oneTimeBreakpoints.add(line);
    this.syncBreakpoints();
    this.dispatchEvent(
      new CustomEvent("breakpoints-change", {
        detail: {
          breakpoints: this.breakpoints,
          oneTimeBreakpoints: this.oneTimeBreakpoints,
        },
      }),
    );
  }

  private removeBreakpoint(line: number): void {
    this._breakpoints.delete(line);
    this._oneTimeBreakpoints.delete(line);
    this.consumedOneTimeBreakpoints.delete(line);
    this.syncBreakpoints();
    this.dispatchEvent(new CustomEvent("breakpoints-change", {
      detail: { breakpoints: this.breakpoints, oneTimeBreakpoints: this.oneTimeBreakpoints },
    }));
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
    this.followingRuntime = true;
    setGuidedLine(this.editor!);
    this.snapshot = { point: this.snapshot.point, status: "running" };
    this.render();
    const result = await engine.advance(command);

    if (this.engine === engine) {
      if (result.status === "paused" && result.point) {
        const line = result.point.range.startLine;
        if (this.allOneTimeBreakpoints().has(line)) {
          this.consumedOneTimeBreakpoints.add(line);
        }
        if (this.activeLessonPauseLines().has(line)) {
          this.consumedLessonNotes.add(line);
        }
        this.syncBreakpoints();
        this.executionHistory.push({
          consumedBreakpoints: [...this.consumedOneTimeBreakpoints],
          consumedNotes: [...this.consumedLessonNotes],
          operationIndex: engine.operationIndex,
        });
      }
      this.acceptSnapshot(result);
    }

    return result;
  }

  private acceptSnapshot(snapshot: DebuggerSnapshot): void {
    this.snapshot = snapshot;
    if (this.followingRuntime && snapshot.status === "paused" && snapshot.point) {
      const index = this.guidedComments.findIndex(
        (comment) => comment.line === snapshot.point?.range.startLine,
      );
      if (index >= 0 && index !== this.guidedIndex) {
        this.guidedIndex = index;
        this.guidedQuestionSelection = undefined;
        this.guidedSolutionVisible = false;
      }
    }
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
    const comment = this.activeTeachingComment();
    const focus = comment && this.editor
      ? {
          from: comment.from,
          to: this.editor.state.doc.line(
            Math.min(comment.line, this.editor.state.doc.lines),
          ).to,
        }
      : undefined;
    setActivePoint(
      this.editor!,
      this.followingRuntime ? this.snapshot.point : undefined,
      focus,
    );
    this.renderGuidedDialog();
    this.syncActiveTeachingComment();
    this.renderToolbar();
    this.renderTeachingCard();
    this.renderScope();
    this.renderStack();
    this.renderBreakpoints();
    this.renderConsole();
    this.renderStatusbar();
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
    this.requiredElement<HTMLButtonElement>('[data-command="back"]').disabled =
      running || this.executionHistory.length === 0;

    const notesToggle = this.requiredElement<HTMLButtonElement>(
      '[data-debug-toggle="notes"]',
    );
    notesToggle.setAttribute("aria-pressed", String(this.ignoreLessonNotes));
    notesToggle.title = this.ignoreLessonNotes
      ? "Pause on lesson notes"
      : "Ignore lesson-note pauses";
    notesToggle.setAttribute(
      "aria-label",
      this.ignoreLessonNotes ? "Pause on lesson notes" : "Ignore lesson notes",
    );

    const breakpointsToggle = this.requiredElement<HTMLButtonElement>(
      '[data-debug-toggle="breakpoints"]',
    );
    breakpointsToggle.setAttribute("aria-pressed", String(!this.breakpointsActive));
    breakpointsToggle.title = this.breakpointsActive
      ? "Deactivate breakpoints"
      : "Activate breakpoints";
    breakpointsToggle.setAttribute(
      "aria-label",
      this.breakpointsActive ? "Deactivate breakpoints" : "Activate breakpoints",
    );
    this.requiredElement<HTMLElement>(".shell").dataset.breakpointsActive = String(
      this.breakpointsActive,
    );
  }

  private renderTeachingCard(): void {
    const card = this.requiredElement<HTMLElement>(".teaching-card");
    const question = this.requiredElement<HTMLElement>(".teaching-question");
    const comment = this.activeTeachingComment();

    if (!comment?.question) {
      card.hidden = true;
      question.hidden = true;
      return;
    }

    card.hidden = false;
    this.renderGuidedTeachingCard(comment, question);
  }

  private renderGuidedTeachingCard(
    comment: TeachingComment,
    question: HTMLElement,
  ): void {
    this.requiredElement<HTMLElement>(".teaching-title").textContent = "Quick check";
    question.hidden = false;
    renderMarkdown(
      this.requiredElement<HTMLElement>(".question-prompt"),
      comment.question ?? "",
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
        const oneTime = this.allOneTimeBreakpoints().has(line);
        row.dataset.kind = oneTime ? "once" : "regular";
        const dot = document.createElement("span");
        dot.className = "breakpoint-dot";
        const label = document.createElement("span");
        label.textContent = oneTime ? "lesson.ts (once)" : "lesson.ts";
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
