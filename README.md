# TypeScript Teaching Debugger

An embeddable custom element that teaches synchronous TypeScript execution using a deterministic AST interpreter. It highlights both the active source line and the exact AST range, while exposing Chrome-style stepping, scopes, frames, breakpoints, and console output.

## Features

* Step into, step over, step out, resume, pause, and restart
* Executable AST-node and source-line highlighting
* Focus dimming around the active runtime or guided line
* Editable TypeScript with clickable gutter breakpoints
* Live local, block, and module scopes
* Call-stack frames with source locations
* Sandboxed console output
* Responsive Chrome DevTools-inspired interface
* Shadow DOM style isolation
* Keyboard controls matching common browser debuggers
* Searchable teaching library with 17 classic algorithms
* Curriculum groups ordered from fundamentals through compiler algorithms
* Live variable-value and Markdown documentation hovers
* Automatic restart after a completed run
* Unified lesson walkthrough in the right teaching panel
* Individually collapsible teaching comments, collapsed by default
* Runtime and lesson navigation controls in the right sidebar

## Included lessons

The demo includes linear and binary search; bubble, insertion, selection, merge,
and quick sort; breadth-first and depth-first graph traversal; Dijkstra shortest
paths; recursive factorial; and Fibonacci tabulation. Every lesson includes
time and space complexity, suggested breakpoints, and code that can be stepped
through inside the teaching runtime.

Lessons read from top to bottom as a beginner problem introduction, type context,
sample variables and invocation, function implementations, then reported output.

Compiler lessons cover CFG reverse postorder, iterative dominator analysis,
dominance frontiers, Cytron phi-function placement, and dominator-tree SSA
renaming.

## Install

```bash
npm install ./ts-teaching-debugger-0.1.0.tgz
```

Import the element once, then assign TypeScript through its `code` property:

```ts
import "ts-teaching-debugger";
import type { TsTeachingDebuggerElement } from "ts-teaching-debugger";

const teachingDebugger = document.querySelector<TsTeachingDebuggerElement>(
  "#teaching-debugger",
);

if (teachingDebugger) {
  teachingDebugger.code = `
    function add(a: number, b: number): number {
      const result = a + b;
      return result;
    }

    const total = add(2, 3);
    console.log(total);
  `;

  teachingDebugger.breakpoints = [3, 7];
}
```

```html
<ts-teaching-debugger id="teaching-debugger"></ts-teaching-debugger>
```

For static snippets, an inert child script is also supported:

```html
<ts-teaching-debugger readonly>
  <script type="text/typescript">
    const price: number = 4;
    const quantity: number = 3;
    console.log(price * quantity);
  </script>
</ts-teaching-debugger>
```

Give the element an explicit height:

```css
ts-teaching-debugger {
  display: block;
  height: 680px;
  min-height: 480px;
}
```

## API

Properties:

* `code: string`
* `breakpoints: number[]` - includes automatic lesson-step breakpoints
* `autoResetDelay: number` - milliseconds before reset; use `-1` to disable

Place a Markdown JSDoc block immediately above an executable line. The debugger
uses it for the "Why this line exists" panel:

```ts
/**
 * ## Compare with the target
 *
 * This checks whether the current array element is the value being sought.
 *
 * ### Question
 * Using what you have learned so far, what happens when the values match?
 *
 * ### Choices
 * * The function returns the current index.
 * * The search restarts from the beginning.
 * * The array is sorted before searching again.
 *
 * ### Answer
 * 1
 *
 * ### Solution
 * The function returns the current index and ends the search.
 */
if (values[index] === target) {
  return index;
}
```

Function blocks can additionally document their parameters:

```ts
/**
 * ## Linear search
 *
 * Finds the first value equal to the requested target.
 *
 * ### Arguments
 * * `values` - The array being searched.
 * * `target` - The value to locate.
 */
function linearSearch(values: number[], target: number): number {
  // ...
}
```

`##` supplies the teaching title. Markdown below it supplies the explanation.
Function teaching blocks act as docstrings. An optional `### Arguments` section
documents parameters and supplies the Markdown shown when a learner hovers over
each argument. The `### Question` and `### Solution` sections are optional. Content is parsed
from the current editor source after edits, rather than held in separate lesson
metadata.

Teaching comments begin as compact collapsed rows and can be expanded
individually. When expanded, headings, bold text, and inline code receive
readable Markdown styling in the editor. Full content remains available to the
teaching panel and hovers while collapsed.

Questions use multiple-choice options. `### Choices` contains the options and
`### Answer` contains the one-based number of the correct option. Generated
lesson checks ask learners to predict the next behavior using concepts introduced
so far. Lesson steps present the question first and reveal the explanation after
the learner checks an answer.

Hovering an identifier reads its value from the nearest active scope. If its
declaration has a Markdown JSDoc teaching block, the same documentation is shown
in the hover card even while comments are hidden. Function declaration blocks
act as rendered function docstrings. Function hovers omit the redundant current
value preview; variable and parameter hovers retain it.

## Lesson flow

The initial and reset state displays the first `# Problem` block in the right
teaching panel. Previous and Next navigate all Markdown teaching blocks without
executing or mutating program state. The selected source line is focused and
other lines are dimmed.

Executable teaching steps are also installed as automatic breakpoints. Resume
or stepping executes the program, pauses at those lesson lines, and synchronizes
the same right panel to the reached step. Runtime controls and lesson navigation
therefore operate together without a separate guided mode or dialog.

Methods:

* `reset()`
* `resume()`
* `pause()`
* `stepInto()`
* `stepOver()`
* `stepOut()`

Events:

* `code-change`
* `breakpoints-change`
* `debugger-paused`
* `debugger-complete`
* `debugger-error`

Keyboard controls:

* `F8`: resume
* `F10`: step over
* `F11`: step into
* `Shift+F11`: step out
* `Ctrl+Shift+F5`: restart when focus is outside the editor

## Runtime model

The component parses TypeScript with Babel and interprets the AST without using `eval` or granting access to the host DOM. Type annotations and interfaces are parsed but do not create runtime steps.

The teaching runtime supports variables, functions, arrays, objects, arithmetic, assignments, conditionals, synchronous loops, switch statements, try/catch, template strings, destructuring, member access, and a restricted set of standard globals.

This is intentionally not a complete JavaScript engine. Imports, exports, classes, async functions, generators, DOM access, networking, and interpreted functions passed into native callbacks are currently unsupported. Use a loop instead of `map`, `filter`, or `reduce` when the callback should be stepped into.

Do not use this component as a security boundary for hostile code without an additional isolated iframe and a restrictive Content Security Policy. The interpreter blocks common prototype and constructor escape paths, but defense in depth is still required for public code-execution products.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```
