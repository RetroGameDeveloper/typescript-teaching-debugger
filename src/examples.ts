export type AlgorithmCategory =
  | "Compilers"
  | "Dynamic programming"
  | "Graphs"
  | "Recursion"
  | "Searching"
  | "Sorting";

export interface AlgorithmExample {
  breakpoints: number[];
  category: AlgorithmCategory;
  code: string;
  description: string;
  id: string;
  spaceComplexity: string;
  timeComplexity: string;
  title: string;
}

const sourceAlgorithmExamples: AlgorithmExample[] = [
  {
    id: "cfg-reverse-postorder",
    title: "CFG reverse postorder",
    category: "Compilers",
    description: "Order reachable basic blocks so predecessors usually appear before successors.",
    timeComplexity: "O(V + E)",
    spaceComplexity: "O(V)",
    breakpoints: [7, 15],
    code: `type CFG = Record<string, string[]>;

function reversePostorder(graph: CFG, entry: string): string[] {
  const visited: Record<string, boolean> = {};
  const postorder: string[] = [];

  function visit(block: string): void {
    visited[block] = true;

    for (const successor of graph[block]) {
      if (!visited[successor]) {
        visit(successor);
      }
    }

    postorder.push(block);
  }

  visit(entry);
  const result: string[] = [];

  for (let index = postorder.length - 1; index >= 0; index -= 1) {
    result.push(postorder[index]);
  }

  return result;
}

const cfg: CFG = {
  entry: ["header"],
  header: ["body", "exit"],
  body: ["header"],
  exit: [],
};

console.log("Reverse postorder:", reversePostorder(cfg, "entry"));`,
  },
  {
    id: "iterative-dominators",
    title: "Iterative dominators",
    category: "Compilers",
    description: "Solve dominator sets to a fixed point over the control-flow graph.",
    timeComplexity: "O(V^2 * E)",
    spaceComplexity: "O(V^2)",
    breakpoints: [25, 37],
    code: `type Predecessors = Record<string, string[]>;
type BlockSet = Record<string, boolean>;

function intersect(left: BlockSet, right: BlockSet): BlockSet {
  const result: BlockSet = {};

  for (const block of Object.keys(left)) {
    if (left[block] && right[block]) {
      result[block] = true;
    }
  }

  return result;
}

function dominators(
  blocks: string[],
  predecessors: Predecessors,
  entry: string,
): Record<string, BlockSet> {
  const result: Record<string, BlockSet> = {};
  const allBlocks: BlockSet = {};

  for (const block of blocks) {
    allBlocks[block] = true;
  }

  for (const block of blocks) {
    result[block] = block === entry ? { entry: true } : Object.assign({}, allBlocks);
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const block of blocks) {
      if (block === entry) {
        continue;
      }

      const incoming = predecessors[block];
      let next = Object.assign({}, result[incoming[0]]);

      for (let index = 1; index < incoming.length; index += 1) {
        next = intersect(next, result[incoming[index]]);
      }

      next[block] = true;

      if (Object.keys(next).length !== Object.keys(result[block]).length) {
        result[block] = next;
        changed = true;
      }
    }
  }

  return result;
}

const blocks = ["entry", "left", "right", "join", "exit"];
const predecessors: Predecessors = {
  entry: [], left: ["entry"], right: ["entry"],
  join: ["left", "right"], exit: ["join"],
};
console.log("Dominators:", dominators(blocks, predecessors, "entry"));`,
  },
  {
    id: "dominance-frontiers",
    title: "Dominance frontiers",
    category: "Compilers",
    description: "Find CFG joins where a block's dominance stops being strict.",
    timeComplexity: "O(VE)",
    spaceComplexity: "O(V + E)",
    breakpoints: [12, 18],
    code: `type Predecessors = Record<string, string[]>;

function dominanceFrontiers(
  blocks: string[],
  predecessors: Predecessors,
  immediateDominator: Record<string, string>,
): Record<string, string[]> {
  const frontier: Record<string, string[]> = {};

  for (const block of blocks) {
    frontier[block] = [];
  }

  for (const join of blocks) {
    if (predecessors[join].length < 2) {
      continue;
    }

    for (const predecessor of predecessors[join]) {
      let runner = predecessor;

      while (runner !== immediateDominator[join]) {
        if (!frontier[runner].includes(join)) {
          frontier[runner].push(join);
        }
        runner = immediateDominator[runner];
      }
    }
  }

  return frontier;
}

const blocks = ["entry", "left", "right", "join", "exit"];
const predecessors: Predecessors = {
  entry: [], left: ["entry"], right: ["entry"],
  join: ["left", "right"], exit: ["join"],
};
const immediateDominator = {
  entry: "entry", left: "entry", right: "entry",
  join: "entry", exit: "join",
};
console.log("Dominance frontiers:",
  dominanceFrontiers(blocks, predecessors, immediateDominator));`,
  },
  {
    id: "cytron-phi-placement",
    title: "Cytron phi placement",
    category: "Compilers",
    description: "Place minimal SSA phi functions using iterated dominance frontiers.",
    timeComplexity: "O(defs + phi placements)",
    spaceComplexity: "O(V + phi placements)",
    breakpoints: [13, 19],
    code: `type BlockLists = Record<string, string[]>;

function placePhiFunctions(
  variables: string[],
  definitionBlocks: BlockLists,
  dominanceFrontier: BlockLists,
): Record<string, string[]> {
  const phi: Record<string, string[]> = {};

  for (const variable of variables) {
    const worklist = definitionBlocks[variable].slice();
    const queued: Record<string, boolean> = {};

    for (const block of worklist) {
      queued[block] = true;
    }

    while (worklist.length > 0) {
      const block = worklist.shift();

      if (block === undefined) {
        break;
      }

      for (const join of dominanceFrontier[block]) {
        if (phi[join] === undefined) {
          phi[join] = [];
        }

        if (!phi[join].includes(variable)) {
          phi[join].push(variable);

          if (!queued[join]) {
            queued[join] = true;
            worklist.push(join);
          }
        }
      }
    }
  }

  return phi;
}

const variables = ["x", "y"];
const definitions: BlockLists = {
  x: ["left", "right"],
  y: ["entry", "loopBody"],
};
const frontier: BlockLists = {
  entry: [], left: ["join"], right: ["join"],
  join: [], loopBody: ["loopHeader"], loopHeader: ["loopHeader"],
};
console.log("Phi functions:", placePhiFunctions(variables, definitions, frontier));`,
  },
  {
    id: "ssa-renaming",
    title: "SSA variable renaming",
    category: "Compilers",
    description: "Rename definitions and uses while walking the dominator tree.",
    timeComplexity: "O(instructions + phi operands)",
    spaceComplexity: "O(instructions)",
    breakpoints: [24, 31],
    code: `type Statements = Record<string, string[][]>;
type Tree = Record<string, string[]>;

function renameToSSA(
  block: string,
  tree: Tree,
  statements: Statements,
  counters: Record<string, number>,
  stacks: Record<string, string[]>,
): void {
  const pushed: string[] = [];

  for (const statement of statements[block]) {
    const kind = statement[0];
    const variable = statement[1];

    if (kind === "use") {
      const versions = stacks[variable];
      statement[1] = versions[versions.length - 1];
    } else {
      counters[variable] += 1;
      const version = variable + counters[variable];
      stacks[variable].push(version);
      statement[1] = version;
      pushed.push(variable);
    }
  }

  for (const child of tree[block]) {
    renameToSSA(child, tree, statements, counters, stacks);
  }

  for (let index = pushed.length - 1; index >= 0; index -= 1) {
    stacks[pushed[index]].pop();
  }
}

const statements: Statements = {
  entry: [["def", "x"]],
  left: [["use", "x"], ["def", "x"]],
  right: [["use", "x"]],
  join: [["def", "x"], ["use", "x"]],
};
const dominatorTree: Tree = {
  entry: ["left", "right", "join"], left: [], right: [], join: [],
};
renameToSSA("entry", dominatorTree, statements, { x: 0 }, { x: [] });
console.log("Renamed statements:", statements);`,
  },
  {
    id: "linear-search",
    title: "Linear search",
    category: "Searching",
    description: "Scan each value until the target is found.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    breakpoints: [3, 4],
    code: `function linearSearch(values: number[], target: number): number {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === target) {
      return index;
    }
  }

  return -1;
}

const values = [8, 3, 11, 6, 2];
const result = linearSearch(values, 6);
console.log("Found at index:", result);`,
  },
  {
    id: "binary-search",
    title: "Binary search",
    category: "Searching",
    description: "Repeatedly discard half of a sorted search range.",
    timeComplexity: "O(log n)",
    spaceComplexity: "O(1)",
    breakpoints: [5, 8],
    code: `function binarySearch(values: number[], target: number): number {
  let low = 0;
  let high = values.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = values[middle];

    if (candidate === target) {
      return middle;
    }

    if (candidate < target) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return -1;
}

const values = [2, 4, 7, 11, 16, 21, 25];
const result = binarySearch(values, 16);
console.log("Found at index:", result);`,
  },
  {
    id: "bubble-sort",
    title: "Bubble sort",
    category: "Sorting",
    description: "Swap adjacent out-of-order values across repeated passes.",
    timeComplexity: "O(n^2)",
    spaceComplexity: "O(1)",
    breakpoints: [5, 7],
    code: `function bubbleSort(input: number[]): number[] {
  const values = input.slice();

  for (let end = values.length - 1; end > 0; end -= 1) {
    for (let index = 0; index < end; index += 1) {
      if (values[index] > values[index + 1]) {
        const temporary = values[index];
        values[index] = values[index + 1];
        values[index + 1] = temporary;
      }
    }
  }

  return values;
}

const result = bubbleSort([7, 2, 9, 4, 1]);
console.log("Sorted:", result);`,
  },
  {
    id: "insertion-sort",
    title: "Insertion sort",
    category: "Sorting",
    description: "Insert each value into its correct position in a sorted prefix.",
    timeComplexity: "O(n^2)",
    spaceComplexity: "O(1)",
    breakpoints: [5, 8],
    code: `function insertionSort(input: number[]): number[] {
  const values = input.slice();

  for (let index = 1; index < values.length; index += 1) {
    const current = values[index];
    let position = index - 1;

    while (position >= 0 && values[position] > current) {
      values[position + 1] = values[position];
      position -= 1;
    }

    values[position + 1] = current;
  }

  return values;
}

const result = insertionSort([7, 2, 9, 4, 1]);
console.log("Sorted:", result);`,
  },
  {
    id: "selection-sort",
    title: "Selection sort",
    category: "Sorting",
    description: "Select the smallest remaining value for each output position.",
    timeComplexity: "O(n^2)",
    spaceComplexity: "O(1)",
    breakpoints: [5, 9],
    code: `function selectionSort(input: number[]): number[] {
  const values = input.slice();

  for (let start = 0; start < values.length - 1; start += 1) {
    let smallest = start;

    for (let index = start + 1; index < values.length; index += 1) {
      if (values[index] < values[smallest]) {
        smallest = index;
      }
    }

    const temporary = values[start];
    values[start] = values[smallest];
    values[smallest] = temporary;
  }

  return values;
}

const result = selectionSort([7, 2, 9, 4, 1]);
console.log("Sorted:", result);`,
  },
  {
    id: "merge-sort",
    title: "Merge sort",
    category: "Sorting",
    description: "Divide the input recursively, then merge sorted halves.",
    timeComplexity: "O(n log n)",
    spaceComplexity: "O(n)",
    breakpoints: [5, 29],
    code: `function merge(left: number[], right: number[]): number[] {
  const result: number[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] <= right[rightIndex]) {
      result.push(left[leftIndex]);
      leftIndex += 1;
    } else {
      result.push(right[rightIndex]);
      rightIndex += 1;
    }
  }

  while (leftIndex < left.length) {
    result.push(left[leftIndex]);
    leftIndex += 1;
  }

  while (rightIndex < right.length) {
    result.push(right[rightIndex]);
    rightIndex += 1;
  }

  return result;
}

function mergeSort(values: number[]): number[] {
  if (values.length <= 1) {
    return values;
  }

  const middle = Math.floor(values.length / 2);
  const left = mergeSort(values.slice(0, middle));
  const right = mergeSort(values.slice(middle));
  return merge(left, right);
}

const result = mergeSort([7, 2, 9, 4, 1]);
console.log("Sorted:", result);`,
  },
  {
    id: "quick-sort",
    title: "Quick sort",
    category: "Sorting",
    description: "Partition values around a pivot, then sort each partition.",
    timeComplexity: "O(n log n) average",
    spaceComplexity: "O(log n)",
    breakpoints: [8, 22],
    code: `function swap(values: number[], left: number, right: number): void {
  const temporary = values[left];
  values[left] = values[right];
  values[right] = temporary;
}

function partition(values: number[], low: number, high: number): number {
  const pivot = values[high];
  let boundary = low;

  for (let index = low; index < high; index += 1) {
    if (values[index] < pivot) {
      swap(values, index, boundary);
      boundary += 1;
    }
  }

  swap(values, boundary, high);
  return boundary;
}

function quickSort(values: number[], low: number, high: number): void {
  if (low >= high) {
    return;
  }

  const pivotIndex = partition(values, low, high);
  quickSort(values, low, pivotIndex - 1);
  quickSort(values, pivotIndex + 1, high);
}

const values = [7, 2, 9, 4, 1];
quickSort(values, 0, values.length - 1);
console.log("Sorted:", values);`,
  },
  {
    id: "breadth-first-search",
    title: "Breadth-first search",
    category: "Graphs",
    description: "Visit graph vertices level by level using a queue.",
    timeComplexity: "O(V + E)",
    spaceComplexity: "O(V)",
    breakpoints: [8, 17],
    code: `type Graph = Record<string, string[]>;

function breadthFirstSearch(graph: Graph, start: string): string[] {
  const queue = [start];
  const visited: Record<string, boolean> = {};
  const order: string[] = [];
  visited[start] = true;

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined) {
      break;
    }

    order.push(current);
    const neighbors = graph[current];

    for (const neighbor of neighbors) {
      if (!visited[neighbor]) {
        visited[neighbor] = true;
        queue.push(neighbor);
      }
    }
  }

  return order;
}

const graph: Graph = {
  A: ["B", "C"],
  B: ["D", "E"],
  C: ["F"],
  D: [],
  E: ["F"],
  F: [],
};

const order = breadthFirstSearch(graph, "A");
console.log("Visit order:", order);`,
  },
  {
    id: "depth-first-search",
    title: "Depth-first search",
    category: "Graphs",
    description: "Follow each graph branch recursively before backtracking.",
    timeComplexity: "O(V + E)",
    spaceComplexity: "O(V)",
    breakpoints: [7, 12],
    code: `type Graph = Record<string, string[]>;

function depthFirstSearch(
  graph: Graph,
  current: string,
  visited: Record<string, boolean>,
  order: string[],
): void {
  visited[current] = true;
  order.push(current);

  for (const neighbor of graph[current]) {
    if (!visited[neighbor]) {
      depthFirstSearch(graph, neighbor, visited, order);
    }
  }
}

const graph: Graph = {
  A: ["B", "C"],
  B: ["D", "E"],
  C: ["F"],
  D: [],
  E: ["F"],
  F: [],
};
const visited: Record<string, boolean> = {};
const order: string[] = [];
depthFirstSearch(graph, "A", visited, order);
console.log("Visit order:", order);`,
  },
  {
    id: "dijkstra-shortest-path",
    title: "Dijkstra shortest paths",
    category: "Graphs",
    description: "Grow the lowest-cost known paths through a weighted graph.",
    timeComplexity: "O(V^2)",
    spaceComplexity: "O(V)",
    breakpoints: [14, 30],
    code: `type WeightedGraph = Record<string, Record<string, number>>;

function shortestPaths(graph: WeightedGraph, start: string): Record<string, number> {
  const distances: Record<string, number> = {};
  const visited: Record<string, boolean> = {};

  for (const node of Object.keys(graph)) {
    distances[node] = Infinity;
  }
  distances[start] = 0;

  while (true) {
    let current: string | null = null;
    let bestDistance = Infinity;

    for (const node of Object.keys(graph)) {
      if (!visited[node] && distances[node] < bestDistance) {
        current = node;
        bestDistance = distances[node];
      }
    }

    if (current === null) {
      break;
    }

    visited[current] = true;

    for (const neighbor of Object.keys(graph[current])) {
      const candidate = distances[current] + graph[current][neighbor];

      if (candidate < distances[neighbor]) {
        distances[neighbor] = candidate;
      }
    }
  }

  return distances;
}

const graph: WeightedGraph = {
  A: { B: 4, C: 2 },
  B: { C: 1, D: 5 },
  C: { B: 1, D: 8, E: 10 },
  D: { E: 2 },
  E: {},
};

const distances = shortestPaths(graph, "A");
console.log("Distances:", distances);`,
  },
  {
    id: "factorial-recursion",
    title: "Recursive factorial",
    category: "Recursion",
    description: "Reduce a problem until it reaches a base case.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    breakpoints: [2, 6],
    code: `function factorial(value: number): number {
  if (value <= 1) {
    return 1;
  }

  return value * factorial(value - 1);
}

const result = factorial(5);
console.log("5! =", result);`,
  },
  {
    id: "fibonacci-dynamic-programming",
    title: "Fibonacci tabulation",
    category: "Dynamic programming",
    description: "Store earlier results and build the sequence iteratively.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    breakpoints: [12, 13],
    code: `function fibonacci(count: number): number[] {
  if (count <= 0) {
    return [];
  }

  const sequence = [0];

  if (count === 1) {
    return sequence;
  }

  sequence.push(1);

  for (let index = 2; index < count; index += 1) {
    const next = sequence[index - 1] + sequence[index - 2];
    sequence.push(next);
  }

  return sequence;
}

const result = fibonacci(10);
console.log("Sequence:", result);`,
  },
];

export const algorithmExamples: AlgorithmExample[] = sourceAlgorithmExamples.map(
  (example) => {
    const sourceNotes = teachingNotesByExample[example.id] ?? {};
    const noteLines = Object.keys(sourceNotes).map(Number).sort((left, right) => left - right);
    const questionLines = example.breakpoints.map(
      (line) =>
        sourceNotes[line]
          ? line
          : noteLines.find((noteLine) => noteLine >= line) ?? line,
    );
    const annotated = annotateCode(
      example.code,
      sourceNotes,
      questionLines,
    );

    return {
      ...example,
      breakpoints: questionLines.map(
        (line) => annotated.lineMap[line] ?? line,
      ),
      code: annotated.code,
    };
  },
);
import { teachingNotesByExample } from "./example-notes";
import { annotateCode } from "./teaching";
