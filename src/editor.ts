import { javascript } from "@codemirror/lang-javascript";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
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
  lineNumbers,
  rectangularSelection,
  type DecorationSet,
} from "@codemirror/view";
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

class BreakpointMarker extends GutterMarker {
  readonly elementClass = "cm-breakpoint-marker";

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.setAttribute("aria-hidden", "true");
    return marker;
  }
}

const breakpointMarker = new BreakpointMarker();

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
  onBreakpointsChange: (lines: number[]) => void;
  onChange: (code: string) => void;
  parent: HTMLElement;
  readOnly: boolean;
}

export function createEditor({
  code,
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
      highlightSpecialChars(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      highlightActiveLine(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle),
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
            color: "#d7dae0",
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
            backgroundColor: "#202124",
            borderRight: "1px solid #303134",
            color: "#74777d",
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
            width: "18px",
          },
          ".cm-breakpoint-marker": {
            background: "#e35b66",
            border: "2px solid #202124",
            borderRadius: "50%",
            boxShadow: "0 0 0 1px #e35b66",
            display: "block",
            height: "8px",
            width: "8px",
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(138, 180, 248, 0.045)",
          },
          ".cm-debug-line": {
            backgroundColor: "rgba(250, 206, 90, 0.11)",
            boxShadow: "inset 3px 0 0 #f9c74f",
          },
          ".cm-debug-node": {
            backgroundColor: "rgba(138, 180, 248, 0.2)",
            borderBottom: "1px solid rgba(138, 180, 248, 0.65)",
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
