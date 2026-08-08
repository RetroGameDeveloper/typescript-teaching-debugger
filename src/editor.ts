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
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { ExecutionPoint } from "./core/types";

interface BreakpointChange {
  enabled: boolean;
  position: number;
}

interface ActiveRange {
  from: number;
  lineFrom: number;
  to: number;
}

export interface EditorRange {
  from: number;
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
          from: mapping.mapPos(value.from),
          lineFrom: mapping.mapPos(value.lineFrom),
          to: mapping.mapPos(value.to),
        }
      : null,
});

const hiddenCommentsEffect = StateEffect.define<EditorRange[]>({
  map: (ranges, mapping) =>
    ranges.map((range) => ({
      from: mapping.mapPos(range.from),
      to: mapping.mapPos(range.to),
    })),
});

class BreakpointMarker extends GutterMarker {
  readonly elementClass = "cm-breakpoint-marker";

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = "cm-breakpoint-chevron";
    marker.setAttribute("aria-hidden", "true");
    return marker;
  }
}

const breakpointMarker = new BreakpointMarker();

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
        add: effect.value.enabled
          ? [breakpointMarker.range(effect.value.position)]
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

      next = Decoration.set(ranges, true);
    }

    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const hiddenCommentsState = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    let next = decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (effect.is(hiddenCommentsEffect)) {
        next = Decoration.set(
          effect.value.map((range) =>
            Decoration.replace({ block: true }).range(range.from, range.to),
          ),
          true,
        );
      }
    }

    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function hasBreakpoint(view: EditorView, position: number): boolean {
  let found = false;
  view.state.field(breakpointState).between(position, position, () => {
    found = true;
  });
  return found;
}

export function readBreakpointLines(view: EditorView): number[] {
  const lines: number[] = [];

  view.state.field(breakpointState).between(0, view.state.doc.length, (from) => {
    lines.push(view.state.doc.lineAt(from).number);
  });

  return lines.sort((left, right) => left - right);
}

function breakpointGutter(onChange: (lines: number[]) => void): Extension {
  return gutter({
    class: "cm-breakpoint-gutter",
    initialSpacer: () => breakpointMarker,
    markers: (view) => view.state.field(breakpointState),
    domEventHandlers: {
      mousedown: (view, line) => {
        const enabled = !hasBreakpoint(view, line.from);
        view.dispatch({
          effects: breakpointEffect.of({ enabled, position: line.from }),
        });
        onChange(readBreakpointLines(view));
        return true;
      },
    },
  });
}

export interface CreateEditorOptions {
  code: string;
  createHover: (identifier: string, position: number) => HTMLElement | undefined;
  onBreakpointsChange: (lines: number[]) => void;
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
      hiddenCommentsState,
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
): void {
  if (!point) {
    view.dispatch({ effects: activeRangeEffect.of(null) });
    return;
  }

  const docLength = view.state.doc.length;
  const from = Math.min(Math.max(point.range.start, 0), docLength);
  const to = Math.min(Math.max(point.range.end, from), docLength);
  const lineFrom = view.state.doc.lineAt(from).from;
  view.dispatch({
    effects: activeRangeEffect.of({ from, lineFrom, to }),
    scrollIntoView: true,
    selection: { anchor: from },
  });
}

export function setEditorBreakpoints(
  view: EditorView,
  lines: Iterable<number>,
): void {
  const requested = new Set(lines);
  const current = new Set(readBreakpointLines(view));
  const effects: StateEffect<unknown>[] = [];

  for (const line of current) {
    if (!requested.has(line)) {
      effects.push(
        breakpointEffect.of({
          enabled: false,
          position: view.state.doc.line(line).from,
        }),
      );
    }
  }

  for (const line of requested) {
    if (
      !current.has(line) &&
      Number.isInteger(line) &&
      line > 0 &&
      line <= view.state.doc.lines
    ) {
      effects.push(
        breakpointEffect.of({
          enabled: true,
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
  visible: boolean,
): void {
  view.dispatch({
    effects: hiddenCommentsEffect.of(visible ? [] : ranges),
  });
}
