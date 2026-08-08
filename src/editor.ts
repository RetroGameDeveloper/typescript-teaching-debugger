import { javascript } from "@codemirror/lang-javascript";
import {
  bracketMatching,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  EditorState,
  RangeSet,
  StateEffect,
  StateField,
  type Extension,
  type Range,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  drawSelection,
  dropCursor,
  gutter,
  highlightActiveLine,
  highlightSpecialChars,
  hoverTooltip,
  lineNumbers,
  rectangularSelection,
  type DecorationSet,
  WidgetType,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { ExecutionPoint } from "./core/types";
import { renderMarkdown } from "./markdown";

interface BreakpointChange {
  kind?: BreakpointKind;
  position: number;
}

export type BreakpointKind = "regular" | "once";

interface ActiveRange {
  focusFrom: number;
  focusTo: number;
  from: number;
  lineFrom: number;
  lineTo: number;
  to: number;
}

export interface EditorRange {
  from: number;
  markdown?: string;
  title?: string;
  to: number;
}

const breakpointEffect = StateEffect.define<BreakpointChange>({
  map: (value, mapping) => ({
    ...value,
    position: mapping.mapPos(value.position),
  }),
});

const activeRangeEffect = StateEffect.define<ActiveRange | null>({
  map: (value, mapping) =>
    value
      ? {
          focusFrom: mapping.mapPos(value.focusFrom),
          focusTo: mapping.mapPos(value.focusTo),
          from: mapping.mapPos(value.from),
          lineFrom: mapping.mapPos(value.lineFrom),
          lineTo: mapping.mapPos(value.lineTo),
          to: mapping.mapPos(value.to),
        }
      : null,
});

const guidedRangeEffect = StateEffect.define<ActiveRange | null>({
  map: (value, mapping) =>
    value
      ? {
          focusFrom: mapping.mapPos(value.focusFrom),
          focusTo: mapping.mapPos(value.focusTo),
          from: mapping.mapPos(value.from),
          lineFrom: mapping.mapPos(value.lineFrom),
          lineTo: mapping.mapPos(value.lineTo),
          to: mapping.mapPos(value.to),
        }
      : null,
});

interface CommentDisplayChange {
  expandAll?: boolean;
  ranges: EditorRange[];
}

const expandCommentsEffect = StateEffect.define<number[]>({
  map: (positions, mapping) => positions.map((position) => mapping.mapPos(position)),
});

interface CommentDisplayState {
  decorations: DecorationSet;
  expanded: ReadonlySet<number>;
  ranges: EditorRange[];
}

const commentDisplayEffect = StateEffect.define<CommentDisplayChange>({
  map: (value, mapping) => ({
    ...value,
    ranges: value.ranges.map((range) => ({
      ...range,
      from: mapping.mapPos(range.from),
      to: mapping.mapPos(range.to),
    })),
  }),
});

const toggleCommentEffect = StateEffect.define<number>({
  map: (position, mapping) => mapping.mapPos(position),
});

const markdownCommentsEffect = StateEffect.define<EditorRange[]>({
  map: (ranges, mapping) =>
    ranges.map((range) => ({
      ...range,
      from: mapping.mapPos(range.from),
      to: mapping.mapPos(range.to),
    })),
});

class BreakpointMarker extends GutterMarker {
  readonly elementClass: string;

  constructor(readonly kind: BreakpointKind) {
    super();
    this.elementClass = `cm-breakpoint-marker cm-breakpoint-marker-${kind}`;
  }

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = `cm-breakpoint-chevron cm-breakpoint-chevron-${this.kind}`;
    marker.setAttribute("aria-hidden", "true");
    return marker;
  }
}

const breakpointMarker = new BreakpointMarker("regular");
const oneTimeBreakpointMarker = new BreakpointMarker("once");

const chromeDarkHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.modifier, tags.operatorKeyword],
    color: "#c58af9",
  },
  {
    tag: [tags.definition(tags.variableName), tags.function(tags.variableName)],
    color: "#8ab4f8",
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace],
    color: "#78d9ec",
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp],
    color: "#f28b82",
  },
  {
    tag: [tags.number, tags.bool, tags.null, tags.atom],
    color: "#f6aea9",
  },
  {
    tag: [tags.propertyName, tags.attributeName],
    color: "#bdc1c6",
  },
  {
    tag: [tags.comment, tags.docComment],
    color: "#9aa0a6",
    fontStyle: "italic",
  },
  {
    tag: [tags.operator, tags.punctuation, tags.bracket],
    color: "#d7dae0",
  },
  { tag: tags.invalid, color: "#f28b82", textDecoration: "underline" },
]);

const breakpointState = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update: (markers, transaction) => {
    let next = markers.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (!effect.is(breakpointEffect)) continue;
      next = next.update({
        add: effect.value.kind
          ? [(effect.value.kind === "once" ? oneTimeBreakpointMarker : breakpointMarker).range(effect.value.position)]
          : [],
        filter: (from) => from !== effect.value.position,
        sort: true,
      });
    }

    return next;
  },
});

const activeRangeState = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    let next = decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (!effect.is(activeRangeEffect)) continue;

      if (!effect.value) {
        next = Decoration.none;
        continue;
      }

      const ranges = [
        Decoration.line({ class: "cm-debug-line" }).range(effect.value.lineFrom),
      ];

      if (effect.value.to > effect.value.from) {
        ranges.push(
          Decoration.mark({ class: "cm-debug-node" }).range(
            effect.value.from,
            effect.value.to,
          ),
        );
      }

      if (effect.value.focusFrom > 0) {
        ranges.push(
          Decoration.mark({ class: "cm-debug-dim" }).range(
            0,
            effect.value.focusFrom,
          ),
        );
      }

      if (effect.value.focusTo < transaction.state.doc.length) {
        ranges.push(
          Decoration.mark({ class: "cm-debug-dim" }).range(
            effect.value.focusTo,
            transaction.state.doc.length,
          ),
        );
      }

      next = Decoration.set(ranges, true);
    }

    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

class CommentToggleWidget extends WidgetType {
  constructor(
    private readonly expanded: boolean,
    private readonly indentation: number,
    private readonly markdown: string,
    private readonly position: number,
    private readonly title: string,
  ) {
    super();
  }

  eq(other: CommentToggleWidget): boolean {
    return (
      other.expanded === this.expanded &&
      other.indentation === this.indentation &&
      other.markdown === this.markdown &&
      other.position === this.position &&
      other.title === this.title
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-comment-toggle-row";
    wrapper.dataset.expanded = String(this.expanded);
    wrapper.style.paddingLeft = `${this.indentation}ch`;
    const button = document.createElement("button");
    button.className = "cm-comment-toggle";
    button.type = "button";
    button.dataset.expanded = String(this.expanded);
    button.setAttribute("aria-expanded", String(this.expanded));
    button.setAttribute(
      "aria-label",
      `${this.expanded ? "Collapse" : "Expand"} ${this.title} comment`,
    );
    const chevron = document.createElement("span");
    chevron.className = "cm-comment-toggle-chevron";
    chevron.setAttribute("aria-hidden", "true");
    const eyebrow = document.createElement("span");
    eyebrow.className = "cm-comment-toggle-eyebrow";
    eyebrow.textContent = "Lesson note";
    const label = document.createElement("span");
    label.className = "cm-comment-toggle-label";
    label.textContent = this.title;
    const labelGroup = document.createElement("span");
    labelGroup.className = "cm-comment-toggle-label-group";
    if (this.expanded) labelGroup.append(eyebrow);
    labelGroup.append(label);
    button.append(chevron, labelGroup);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({ effects: toggleCommentEffect.of(this.position) });
    });
    wrapper.append(button);

    if (this.expanded) {
      const content = document.createElement("div");
      content.className = "cm-comment-card-content";
      renderMarkdown(content, this.markdown);
      wrapper.append(content);
    }
    return wrapper;
  }
}

function markdownFromTeachingComment(source: string): string {
  const markdown = source
    .replace(/^\s*\/\*\*?\s?/, "")
    .replace(/\s*\*\/\s*$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n")
    .trim();

  // The title lives in the card header, so avoid repeating its Markdown heading.
  return markdown.replace(/^#{1,6}\s+.*(?:\n+|$)/, "").trim();
}

function commentDisplayDecorations(
  state: EditorState,
  ranges: EditorRange[],
  expanded: ReadonlySet<number>,
): DecorationSet {
  return Decoration.set(
    ranges.flatMap((range) => {
      if (range.from > range.to || range.to > state.doc.length) return [];
      const source = state.doc.sliceString(range.from, range.to);
      const title =
        range.title ?? source.match(/^\s*\*\s+#{1,6}\s+(.+)$/m)?.[1]?.trim() ??
        "Teaching note";
      const indentation = source.match(/^\s*/)?.[0].replace(/\n/g, "").length ?? 0;
      const isExpanded = expanded.has(range.from);
      const widget = new CommentToggleWidget(
        isExpanded,
        indentation,
        range.markdown ?? markdownFromTeachingComment(source),
        range.from,
        title,
      );

      return range.from === range.to
        ? [Decoration.widget({ block: true, side: -1, widget }).range(range.from)]
        : [Decoration.replace({ block: true, widget }).range(range.from, range.to)];
    }),
    true,
  );
}

const commentDisplayState = StateField.define<CommentDisplayState>({
  create: () => ({
    decorations: Decoration.none,
    expanded: new Set<number>(),
    ranges: [],
  }),
  update: (value, transaction) => {
    let ranges = value.ranges.map((range) => ({
      ...range,
      from: transaction.changes.mapPos(range.from),
      to: transaction.changes.mapPos(range.to),
    }));
    let expanded = new Set(
      [...value.expanded].map((position) => transaction.changes.mapPos(position)),
    );

    for (const effect of transaction.effects) {
      if (effect.is(commentDisplayEffect)) {
        ranges = effect.value.ranges;
        if (effect.value.expandAll === true) {
          expanded = new Set(ranges.map((range) => range.from));
        } else if (effect.value.expandAll === false) {
          expanded = new Set<number>();
        }
        const valid = new Set(ranges.map((range) => range.from));
        expanded = new Set([...expanded].filter((position) => valid.has(position)));
      } else if (effect.is(expandCommentsEffect)) {
        expanded = new Set(effect.value);
      } else if (effect.is(toggleCommentEffect)) {
        if (expanded.has(effect.value)) expanded.delete(effect.value);
        else expanded.add(effect.value);
      }
    }

    return {
      decorations: commentDisplayDecorations(transaction.state, ranges, expanded),
      expanded,
      ranges,
    };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

function markdownCommentDecorations(
  state: EditorState,
  ranges: EditorRange[],
): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  for (const range of ranges) {
    const source = state.doc.sliceString(range.from, range.to);
    const headingPattern = /^\s*\*\s+(#{1,6})\s+(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = headingPattern.exec(source))) {
      const hashes = match[1];
      if (!hashes) continue;
      const from = range.from + match.index + match[0].indexOf(hashes);
      decorations.push(
        Decoration.mark({
          class: `cm-comment-heading cm-comment-heading-${hashes.length}`,
        }).range(from, range.from + match.index + match[0].length),
      );
    }

    const boldPattern = /\*\*([^*\n]+)\*\*/g;
    while ((match = boldPattern.exec(source))) {
      const inner = match[1];
      if (!inner) continue;
      const from = range.from + match.index;
      decorations.push(
        Decoration.mark({ class: "cm-comment-delimiter" }).range(from, from + 2),
        Decoration.mark({ class: "cm-comment-bold" }).range(
          from + 2,
          from + 2 + inner.length,
        ),
        Decoration.mark({ class: "cm-comment-delimiter" }).range(
          from + 2 + inner.length,
          from + 4 + inner.length,
        ),
      );
    }

    const codePattern = /`([^`\n]+)`/g;
    while ((match = codePattern.exec(source))) {
      const inner = match[1];
      if (!inner) continue;
      const from = range.from + match.index;
      decorations.push(
        Decoration.mark({ class: "cm-comment-delimiter" }).range(from, from + 1),
        Decoration.mark({ class: "cm-comment-code" }).range(
          from + 1,
          from + 1 + inner.length,
        ),
        Decoration.mark({ class: "cm-comment-delimiter" }).range(
          from + 1 + inner.length,
          from + 2 + inner.length,
        ),
      );
    }
  }

  return Decoration.set(decorations, true);
}

const markdownCommentsState = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    let next = decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (effect.is(markdownCommentsEffect)) {
        next = markdownCommentDecorations(transaction.state, effect.value);
      }
    }

    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const guidedRangeState = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    let next = decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (!effect.is(guidedRangeEffect)) continue;

      if (!effect.value) {
        next = Decoration.none;
        continue;
      }

      const ranges: Range<Decoration>[] = [
        Decoration.line({ class: "cm-guided-line" }).range(effect.value.lineFrom),
        Decoration.mark({ class: "cm-guided-code" }).range(
          effect.value.from,
          effect.value.to,
        ),
      ];

      if (effect.value.focusFrom > 0) {
        ranges.push(
          Decoration.mark({ class: "cm-guided-dim" }).range(
            0,
            effect.value.focusFrom,
          ),
        );
      }

      if (effect.value.focusTo < transaction.state.doc.length) {
        ranges.push(
          Decoration.mark({ class: "cm-guided-dim" }).range(
            effect.value.focusTo,
            transaction.state.doc.length,
          ),
        );
      }

      next = Decoration.set(ranges, true);
    }

    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function breakpointKindAt(view: EditorView, position: number): BreakpointKind | undefined {
  let kind: BreakpointKind | undefined;
  view.state.field(breakpointState).between(position, position, (_from, _to, marker) => {
    kind = marker === oneTimeBreakpointMarker ? "once" : "regular";
  });
  return kind;
}

export function readBreakpointLines(view: EditorView): number[] {
  const lines: number[] = [];

  view.state.field(breakpointState).between(0, view.state.doc.length, (from) => {
    lines.push(view.state.doc.lineAt(from).number);
  });

  return lines.sort((left, right) => left - right);
}

function breakpointGutter(
  onChange: (line: number, kind: BreakpointKind | undefined) => void,
): Extension {
  return gutter({
    class: "cm-breakpoint-gutter",
    initialSpacer: () => breakpointMarker,
    markers: (view) => view.state.field(breakpointState),
    domEventHandlers: {
      mousedown: (view, line) => {
        const current = breakpointKindAt(view, line.from);
        const kind = current === undefined ? "regular" : current === "regular" ? "once" : undefined;
        view.dispatch({
          effects: breakpointEffect.of({ kind, position: line.from }),
        });
        onChange(view.state.doc.lineAt(line.from).number, kind);
        return true;
      },
    },
  });
}

export interface CreateEditorOptions {
  code: string;
  createHover: (identifier: string, position: number) => HTMLElement | undefined;
  onBreakpointsChange: (line: number, kind: BreakpointKind | undefined) => void;
  onChange: (code: string) => void;
  parent: HTMLElement;
  readOnly: boolean;
}

export function createEditor({
  code,
  createHover,
  onBreakpointsChange,
  onChange,
  parent,
  readOnly,
}: CreateEditorOptions): EditorView {
  const state = EditorState.create({
    doc: code,
    extensions: [
      lineNumbers(),
      breakpointState,
      breakpointGutter(onBreakpointsChange),
      activeRangeState,
      commentDisplayState,
      markdownCommentsState,
      guidedRangeState,
      highlightSpecialChars(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      highlightActiveLine(),
      bracketMatching(),
      hoverTooltip((view, position) => {
        const line = view.state.doc.lineAt(position);
        let from = position;
        let to = position;

        while (from > line.from && /[\w$]/.test(view.state.doc.sliceString(from - 1, from))) {
          from -= 1;
        }

        while (to < line.to && /[\w$]/.test(view.state.doc.sliceString(to, to + 1))) {
          to += 1;
        }

        if (from === to) return null;
        const identifier = view.state.doc.sliceString(from, to);
        const dom = createHover(identifier, from);

        if (!dom) return null;

        return {
          above: true,
          create: () => ({ dom }),
          end: to,
          pos: from,
        };
      }),
      syntaxHighlighting(chromeDarkHighlightStyle),
      javascript({ typescript: true }),
      EditorState.readOnly.of(readOnly),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorView.theme(
        {
          "&": {
            height: "100%",
            color: "#e8eaed",
            backgroundColor: "#202124",
            fontSize: "13px",
          },
          ".cm-content": {
            caretColor: "#8ab4f8",
            fontFamily: "var(--debug-mono)",
            lineHeight: "1.7",
            padding: "10px 0 40px",
          },
          ".cm-scroller": {
            fontFamily: "var(--debug-mono)",
            overflow: "auto",
          },
          ".cm-gutters": {
            backgroundColor: "#1f2023",
            borderRight: "1px solid #303134",
            color: "#8b8e94",
          },
          ".cm-lineNumbers .cm-gutterElement": {
            minWidth: "38px",
            padding: "0 9px 0 5px",
          },
          ".cm-breakpoint-gutter .cm-gutterElement": {
            alignItems: "center",
            cursor: "pointer",
            display: "flex",
            justifyContent: "center",
            width: "17px",
          },
          ".cm-breakpoint-marker": {
            alignItems: "center",
            display: "flex",
            justifyContent: "center",
          },
          ".cm-breakpoint-chevron": {
            backgroundColor: "#8ab4f8",
            clipPath: "polygon(0 8%, 72% 8%, 100% 50%, 72% 92%, 0 92%)",
            display: "block",
            height: "13px",
            width: "13px",
          },
          ".cm-breakpoint-chevron-once": {
            backgroundColor: "transparent",
            border: "2px solid #8ab4f8",
            clipPath: "none",
            transform: "rotate(45deg)",
            width: "10px",
            height: "10px",
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(138, 180, 248, 0.045)",
          },
          ".cm-debug-line": {
            backgroundColor: "rgba(138, 180, 248, 0.1)",
            boxShadow: "inset 3px 0 0 #8ab4f8",
          },
          ".cm-debug-node": {
            backgroundColor: "rgba(138, 180, 248, 0.14)",
            borderBottom: "1px solid rgba(138, 180, 248, 0.72)",
          },
          ".cm-debug-dim": {
            filter: "grayscale(1)",
            opacity: "0.3",
          },
          ".cm-guided-line": {
            backgroundColor: "rgba(197, 138, 249, 0.09)",
            boxShadow: "inset 3px 0 0 #c58af9",
          },
          ".cm-guided-code": {
            backgroundColor: "rgba(197, 138, 249, 0.18)",
            borderBottom: "1px solid rgba(197, 138, 249, 0.78)",
          },
          ".cm-guided-dim": {
            filter: "grayscale(1)",
            opacity: "0.3",
          },
          ".cm-comment-heading": {
            color: "#e8eaed",
            fontStyle: "normal",
            fontWeight: "700",
          },
          ".cm-comment-heading-1, .cm-comment-heading-2": {
            fontSize: "1.16em",
            letterSpacing: "-0.01em",
          },
          ".cm-comment-heading-3, .cm-comment-heading-4": {
            color: "#c7a5f7",
            fontSize: "1.06em",
          },
          ".cm-comment-bold": {
            color: "#e8eaed",
            fontStyle: "normal",
            fontWeight: "700",
          },
          ".cm-comment-code": {
            backgroundColor: "rgba(138, 180, 248, 0.13)",
            borderRadius: "3px",
            color: "#8ab4f8",
            fontStyle: "normal",
          },
          ".cm-comment-delimiter": {
            opacity: "0.45",
          },
          ".cm-comment-toggle-row": {
            backgroundColor: "rgba(32, 35, 42, 0.96)",
            border: "1px solid rgba(138, 180, 248, 0.18)",
            borderLeft: "3px solid rgba(138, 180, 248, 0.75)",
            borderRadius: "6px",
            boxSizing: "border-box",
            boxShadow: "0 3px 12px rgba(0, 0, 0, 0.14)",
            margin: "3px 10px 3px 4px",
            maxWidth: "760px",
            overflow: "hidden",
            padding: "0 !important",
            transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, filter 160ms ease, opacity 160ms ease",
          },
          ".cm-comment-toggle-row[data-expanded='true']": {
            backgroundColor: "rgba(34, 38, 48, 0.98)",
            borderColor: "rgba(138, 180, 248, 0.35)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.24), inset 0 1px rgba(255, 255, 255, 0.025)",
            width: "auto",
          },
          ".cm-comment-toggle-row[data-expanded='false']": {
            borderLeftWidth: "2px",
            boxShadow: "none",
            display: "inline-block",
            filter: "grayscale(1)",
            maxWidth: "calc(100% - 18px)",
            opacity: "0.3",
            width: "max-content",
          },
          ".cm-comment-toggle-row[data-expanded='false']:hover, .cm-comment-toggle-row[data-expanded='false']:focus-within": {
            filter: "grayscale(0.35)",
            opacity: "0.72",
          },
          ".cm-comment-toggle": {
            alignItems: "center",
            backgroundColor: "rgba(138, 180, 248, 0.055)",
            border: "0",
            color: "#c9d2df",
            cursor: "pointer",
            display: "flex",
            font: "12px/1.35 var(--debug-sans)",
            gap: "9px",
            padding: "7px 10px",
            textAlign: "left",
            width: "100%",
          },
          ".cm-comment-toggle:hover": {
            backgroundColor: "rgba(138, 180, 248, 0.11)",
            color: "#f1f3f4",
          },
          ".cm-comment-toggle[data-expanded='false']": {
            font: "11px/1.25 var(--debug-sans)",
            gap: "6px",
            padding: "3px 7px",
          },
          ".cm-comment-toggle:focus-visible": {
            outline: "1px solid #8ab4f8",
            outlineOffset: "1px",
          },
          ".cm-comment-toggle-chevron": {
            borderBottom: "1.5px solid #8ab4f8",
            borderRight: "1.5px solid #8ab4f8",
            color: "#8ab4f8",
            display: "inline-block",
            flex: "0 0 auto",
            height: "6px",
            marginLeft: "2px",
            transform: "rotate(-45deg)",
            transition: "transform 180ms ease",
            width: "6px",
          },
          ".cm-comment-toggle[data-expanded='true'] .cm-comment-toggle-chevron": {
            transform: "rotate(45deg) translate(-1px, -1px)",
          },
          ".cm-comment-toggle-label-group": {
            display: "flex",
            flexDirection: "column",
            gap: "1px",
            minWidth: "0",
          },
          ".cm-comment-toggle[data-expanded='false'] .cm-comment-toggle-label-group": {
            display: "block",
          },
          ".cm-comment-toggle-eyebrow": {
            color: "#8ab4f8",
            font: "700 8px/1.2 var(--debug-mono)",
            letterSpacing: "0.09em",
            textTransform: "uppercase",
          },
          ".cm-comment-toggle-label": {
            fontWeight: "600",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
          ".cm-comment-card-content": {
            animation: "cm-comment-reveal 180ms ease-out both",
            borderTop: "1px solid rgba(138, 180, 248, 0.14)",
            color: "#bdc1c6",
            font: "12px/1.62 var(--debug-sans)",
            padding: "10px 13px 13px 30px",
          },
          ".cm-comment-card-content p": {
            margin: "0",
          },
          ".cm-comment-card-content p + p": {
            marginTop: "7px",
          },
          ".cm-comment-card-content ul": {
            margin: "6px 0 0",
            paddingLeft: "18px",
          },
          ".cm-comment-card-content li + li": {
            marginTop: "3px",
          },
          ".cm-comment-card-content .markdown-heading": {
            color: "#d7b8ff",
            font: "700 10px/1.35 var(--debug-sans)",
            letterSpacing: "0.06em",
            margin: "11px 0 5px",
            textTransform: "uppercase",
          },
          ".cm-comment-card-content .markdown-heading:first-child": {
            marginTop: "0",
          },
          ".cm-comment-card-content code": {
            backgroundColor: "rgba(138, 180, 248, 0.13)",
            border: "1px solid rgba(138, 180, 248, 0.12)",
            borderRadius: "4px",
            color: "#b9d2fa",
            font: "11px/1.4 var(--debug-mono)",
            padding: "1px 4px",
          },
          ".cm-comment-card-content strong": {
            color: "#e8eaed",
          },
          "@keyframes cm-comment-reveal": {
            from: { opacity: "0", transform: "translateY(-5px)" },
            to: { opacity: "1", transform: "translateY(0)" },
          },
          ".cm-selectionBackground, ::selection": {
            backgroundColor: "rgba(138, 180, 248, 0.27) !important",
          },
          ".cm-cursor": {
            borderLeftColor: "#8ab4f8",
          },
          ".cm-focused": {
            outline: "none",
          },
        },
        { dark: true },
      ),
    ],
  });

  return new EditorView({ parent, state });
}

export function setActivePoint(
  view: EditorView,
  point?: ExecutionPoint,
  focus?: EditorRange,
): void {
  if (!point) {
    view.dispatch({ effects: activeRangeEffect.of(null) });
    return;
  }

  const docLength = view.state.doc.length;
  const from = Math.min(Math.max(point.range.start, 0), docLength);
  const to = Math.min(Math.max(point.range.end, from), docLength);
  const line = view.state.doc.lineAt(from);
  const focusFrom = Math.min(focus?.from ?? line.from, line.from);
  const focusTo = Math.max(focus?.to ?? line.to, line.to);
  view.dispatch({
    effects: activeRangeEffect.of({
      focusFrom,
      focusTo,
      from,
      lineFrom: line.from,
      lineTo: line.to,
      to,
    }),
    scrollIntoView: true,
    selection: { anchor: from },
  });
}

export function setEditorBreakpoints(
  view: EditorView,
  lines: Iterable<number>,
  oneTimeLines: Iterable<number> = [],
): void {
  const requested = new Set(lines);
  const requestedOneTime = new Set(oneTimeLines);
  const current = new Map<number, BreakpointKind>();
  view.state.field(breakpointState).between(0, view.state.doc.length, (from, _to, marker) => {
    current.set(
      view.state.doc.lineAt(from).number,
      marker === oneTimeBreakpointMarker ? "once" : "regular",
    );
  });
  const effects: StateEffect<unknown>[] = [];

  for (const [line, kind] of current) {
    const requestedKind = requestedOneTime.has(line) ? "once" : "regular";
    if (!requested.has(line) || kind !== requestedKind) {
      effects.push(
        breakpointEffect.of({
          kind: undefined,
          position: view.state.doc.line(line).from,
        }),
      );
    }
  }

  for (const line of requested) {
    if (
      current.get(line) !== (requestedOneTime.has(line) ? "once" : "regular") &&
      Number.isInteger(line) &&
      line > 0 &&
      line <= view.state.doc.lines
    ) {
      effects.push(
        breakpointEffect.of({
          kind: requestedOneTime.has(line) ? "once" : "regular",
          position: view.state.doc.line(line).from,
        }),
      );
    }
  }

  if (effects.length > 0) {
    view.dispatch({ effects });
  }
}

export function setEditorCode(view: EditorView, code: string): void {
  const current = view.state.doc.toString();

  if (current === code) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: code },
  });
}

export function setCommentVisibility(
  view: EditorView,
  ranges: EditorRange[],
  visible?: boolean,
): void {
  view.dispatch({
    effects: [
      commentDisplayEffect.of({
        ...(visible === undefined ? {} : { expandAll: visible }),
        ranges,
      }),
      markdownCommentsEffect.of(ranges),
    ],
  });
}

export function setExpandedComments(
  view: EditorView,
  positions: Iterable<number>,
): void {
  const next = [...new Set(positions)];
  const current = view.state.field(commentDisplayState).expanded;
  if (next.length === current.size && next.every((position) => current.has(position))) {
    return;
  }
  view.dispatch({ effects: expandCommentsEffect.of(next) });
}

export function setGuidedLine(
  view: EditorView,
  lineNumber?: number,
  focus?: EditorRange,
): void {
  if (!lineNumber || lineNumber < 1 || lineNumber > view.state.doc.lines) {
    view.dispatch({ effects: guidedRangeEffect.of(null) });
    return;
  }

  const line = view.state.doc.line(lineNumber);
  const contentOffset = line.text.search(/\S/);
  const from = contentOffset >= 0 ? line.from + contentOffset : line.from;
  const focusFrom = Math.min(focus?.from ?? line.from, line.from);
  const focusTo = Math.max(focus?.to ?? line.to, line.to);
  view.dispatch({
    effects: guidedRangeEffect.of({
      focusFrom,
      focusTo,
      from,
      lineFrom: line.from,
      lineTo: line.to,
      to: line.to,
    }),
    scrollIntoView: true,
    selection: { anchor: from },
  });
}
