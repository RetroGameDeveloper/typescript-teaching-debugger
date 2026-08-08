# TypeScript Teaching Debugger

An embeddable custom element that teaches synchronous TypeScript execution using a deterministic AST interpreter. It highlights both the active source line and the exact AST range, while exposing Chrome-style stepping, scopes, frames, breakpoints, and console output.

## Features

* Step into, step over, step out, resume, pause, and restart
* Executable AST-node and source-line highlighting
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
* Guided walkthrough by default, with anchored Markdown dialogs

## Included lessons

The demo includes linear and binary search; bubble, insertion, selection, merge,
and quick sort; breadth-first and depth-first graph traversal; Dijkstra shortest
paths; recursive factorial; and Fibonacci tabulation. Every lesson includes
time and space complexity, suggested breakpoints, and code that can be stepped
through inside the teaching runtime.

Lessons read from top to bottom as a problem statement, type context, sample
variables, invocation and output, then hoisted function implementations.

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
* `breakpoints: number[]`
* `autoResetDelay: number` - milliseconds before reset; use `-1` to disable
* `guidedMode: boolean` - enabled by default
* `guidedSteps: number[]`
* `showComments: boolean`

Place a Markdown JSDoc block immediately above an executable line. The debugger
uses it for the "Why this line exists" panel:

```ts
/**
 * ## Compare with the target
 *
 * This checks whether the current array element is the value being sought.
 *
 * ### Question
 * What happens when `values[index]` equals `target`?
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

The Comments toolbar control only changes the blocks' editor presentation. When
shown, headings, bold text, and inline code receive readable Markdown styling in
the code editor. Their content remains available to the teaching panel and
hovers when hidden. Questions are always enabled whenever a teaching block
defines one.

Hovering an identifier reads its value from the nearest active scope. If its
declaration has a Markdown JSDoc teaching block, the same documentation is shown
in the hover card even while comments are hidden. Function declaration blocks
act as rendered function docstrings.

## Guided walkthrough

Guided mode starts enabled. Set `guidedMode` to `false`, or use the Guided toolbar
toggle, to close it. The large walkthrough dialog is anchored above or below the
selected code. Previous and Next navigate the
ordered teaching blocks without executing or mutating program state. The dialog
includes Markdown documentation, optional questions, answer input, and solution
reveal. Finish closes the walkthrough.

By default, steps follow executable Markdown teaching blocks in source order.
Set `guidedSteps` to source line numbers when a lesson needs a custom route:

```ts
teachingDebugger.guidedSteps = [12, 24, 37];
teachingDebugger.guidedMode = true;
```

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
