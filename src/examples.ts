import { teachingNotesByExample } from "./example-notes";
import { reorderForLearning } from "./source-layout";
import { prepareTeachingNotes, type TeachingNotes } from "./teaching";

export type AlgorithmCategory =
  | "Compilers"
  | "Dynamic programming"
  | "Games"
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
  teachingNotes?: TeachingNotes;
}

interface BeginnerIntroduction {
  analogy: string;
  explanation: string;
}

const beginnerIntroductions: Record<string, BeginnerIntroduction> = {
  "cfg-reverse-postorder": {
    analogy: "Imagine rooms joined by one-way doors. We need a useful list of every room we can reach from the entrance, even when some doors lead back to rooms we already visited.",
    explanation: "Walk through each reachable room without visiting one twice. Write a room down only after exploring all doors leaving it, then reverse that finished list. Compiler passes use the result so information usually reaches a room before that room is processed.",
  },
  "iterative-dominators": {
    analogy: "Imagine asking which checkpoints you must pass on every possible route from a building entrance to each room. A checkpoint that appears on every route controls access to that room.",
    explanation: "Start with generous guesses, then repeatedly compare all routes entering each block. Remove any block that is not shared by every incoming route. Stop when another pass changes nothing.",
  },
  "dominance-frontiers": {
    analogy: "Imagine two paths splitting around a park and meeting again. A guide who controlled one path stops having complete control where the paths join.",
    explanation: "Look at every control-flow join and walk backwards through its incoming paths. Record the join for each block whose dominance reaches that boundary. These boundaries tell SSA construction where different values may meet.",
  },
  "cytron-phi-placement": {
    analogy: "Imagine two children write different answers for `x` on two paths, then meet in the same room. The room needs a small sign saying which `x` arrived.",
    explanation: "For each variable, begin at blocks that define it. Follow their dominance frontiers to joins and place a phi function wherever definitions can meet. Treat each new phi as another definition until no more joins need one.",
  },
  "ssa-renaming": {
    analogy: "Imagine every new version of a toy gets a numbered sticker: `x1`, `x2`, then `x3`. When someone asks for `x`, they receive the newest sticker visible on their path.",
    explanation: "Walk down the dominator tree. Give every definition a fresh number, replace each use with the current numbered version, and restore the previous version when leaving a branch.",
  },
  "linear-search": {
    analogy:
      "Imagine a row of closed boxes, and you are looking for a red toy. Open the first box. If it is not there, open the next one. Keep going one box at a time. Stop as soon as you find the toy. If you open every box and never see it, you know it is not in the row.",
    explanation:
      "Linear search does the same thing with a list of numbers. Begin at the left, at index `0`. Compare that number with the target. If they match, return the index — that is where the target lives. If they do not match, move one step right and try again.\n\nThe list does not need to be sorted, but that also means you cannot skip items: the target could be anywhere. If you reach the end with no match, return `-1` to mean \"not found\".\n\nThis lesson searches `[8, 3, 11, 6, 2]` twice: once for `6`, which is there, and once for `4`, which is not.",
  },
  "binary-search": {
    analogy: "Imagine finding a word in a dictionary. Open near the middle, decide whether the word comes before or after that page, and ignore the half that cannot contain it.",
    explanation: "The values must already be sorted. Compare the middle value with the target, keep only the possible half, and repeat until the value is found or the search range is empty.",
  },
  "bubble-sort": {
    analogy: "Imagine children in a line comparing heights with the child beside them. Whenever taller is on the left, the pair swaps places.",
    explanation: "Compare neighbouring values repeatedly and swap pairs that are out of order. Each full pass moves the largest remaining value to the end, like a bubble rising to the surface.",
  },
  "insertion-sort": {
    analogy: "Imagine sorting playing cards in your hand. Take one new card and slide it left until it sits between the correct cards.",
    explanation: "Keep a sorted section at the start of the array. Take the next value, shift larger values one place right, and insert it into the gap that remains.",
  },
  "selection-sort": {
    analogy: "Imagine repeatedly choosing the smallest toy from a messy pile and placing it into the next empty spot in a neat row.",
    explanation: "Scan the unsorted part to find its smallest value, then swap that value into the next output position. Repeat until every position is sorted.",
  },
  "merge-sort": {
    analogy: "Imagine splitting a messy pile of cards into tiny piles, sorting those tiny piles, then joining them by repeatedly taking the smaller card at the front.",
    explanation: "Divide the array into halves until each piece has at most one value. Recursively sort the pieces, then merge each pair by choosing the smallest available front value.",
  },
  "quick-sort": {
    analogy: "Imagine choosing one child as a height marker. Shorter children move to one side and taller children move to the other side.",
    explanation: "Choose a pivot, partition the values around it, and leave the pivot in its final position. Recursively repeat the same process for the values on each side.",
  },
  "breadth-first-search": {
    analogy: "Imagine news spreading through friends. First you tell your closest friends, then they tell their friends, so the news moves outward one group at a time.",
    explanation: "Put the start vertex in a queue. Repeatedly remove the oldest vertex, visit its unseen neighbours, and add them to the back. This explores an unweighted graph by distance from the start.",
  },
  "depth-first-search": {
    analogy: "Imagine exploring a maze by following one passage as far as possible. When it ends, walk back to the last choice and try another passage.",
    explanation: "Visit a vertex, mark it seen, and recursively explore each unseen neighbour. Backtracking returns to earlier vertices when a branch has no unexplored neighbours.",
  },
  "dijkstra-shortest-path": {
    analogy: "Imagine planning deliveries on roads with different travel times. Always finish the closest place you can currently reach before considering a more expensive journey.",
    explanation: "Give the start vertex distance zero and every other vertex infinity. Repeatedly choose the unfinished vertex with the smallest distance and use its outgoing edges to improve neighbouring distances.",
  },
  "factorial-recursion": {
    analogy: "Imagine arranging toys in a row. With five toys there are five choices for the first place, then four choices, then three, until only one choice remains.",
    explanation: "Multiply the current number by the factorial of the number below it. The base case returns `1` for zero or one, allowing all waiting multiplications to finish.",
  },
  "fibonacci-dynamic-programming": {
    analogy: "Imagine building a number path where every new stepping stone is made by adding the previous two stones together.",
    explanation: "Start with `0` and `1`. Add the last two stored values to create the next value, append it to the table, and repeat until the requested sequence length is reached.",
  },
  "flood-fill": {
    analogy: "Imagine pouring paint onto a tile floor. The colour spreads into every neighbouring tile of the same colour, stopping at tiles that already differ.",
    explanation: "Read the starting cell's colour, then use a queue to visit orthogonal neighbours. Recolor each matching cell when it is first discovered so the fill cannot loop forever. This is the same idea games use for paint buckets and connected regions.",
  },
  "bresenham-line": {
    analogy: "Imagine walking from one street corner to another on a city grid. At each step you decide whether the next move should go more horizontally, more vertically, or both.",
    explanation: "Track an error term that remembers how far discrete steps have drifted from the ideal line. Whenever the error grows large enough on an axis, advance on that axis and reduce the error again. The result is every grid cell the line crosses.",
  },
  "aabb-collision": {
    analogy: "Imagine two picture frames on a wall. They overlap unless one frame is completely to the left, right, above, or below the other.",
    explanation: "Two axis-aligned boxes collide when they overlap on both the x-axis and the y-axis. Testing the four separation cases and inverting the result is a common, cheap broad-phase collision check.",
  },
  "binary-heap": {
    analogy: "Imagine a family tree where every parent is smaller than its children. The smallest value always sits at the root, ready to be taken next.",
    explanation: "Store the heap in an array. Insertions append a value and sift it upward; removals replace the root with the last value and sift downward until heap order is restored. Games use this structure for priority queues.",
  },
  "a-star-pathfinding": {
    analogy: "Imagine exploring a city while always expanding the route that currently looks cheapest after adding an optimistic estimate of the remaining walk to your destination.",
    explanation: "Keep a best-known cost `g` from the start and an estimate `f = g + h` using Manhattan distance. Repeatedly expand the lowest-`f` open cell and relax its walkable neighbours until the goal is selected.",
  },
  "minimax": {
    analogy: "Imagine two players taking turns. One always picks the highest available score, and the other always picks the lowest, each assuming the opponent plays perfectly.",
    explanation: "At a leaf, return the stored score. At a maximizing node take the largest child result; at a minimizing node take the smallest child result. The root score is the best achievable outcome against perfect replies.",
  },
  "npc-finite-state-machine": {
    analogy: "Imagine a guard who patrols quietly, then chases when they spot you, then fights when close enough, and returns to patrol if you disappear.",
    explanation: "Represent each behaviour as a state. On every update, inspect a few conditions and return the next state. Recording the sequence of states makes enemy AI easy to teach and debug.",
  },
  "fisher-yates-shuffle": {
    analogy: "Imagine cards in a row. Starting from the last card, swap it with a random card at that position or earlier, then move one step left and repeat.",
    explanation: "Walk backward through the array. At each index, choose a random earlier-or-equal index and swap. A seeded generator keeps the lesson deterministic while still showing a fair shuffle.",
  },
  "weighted-random-pick": {
    analogy: "Imagine spinning a wheel divided into slices of different sizes. Larger slices are more likely, but every slice can still win.",
    explanation: "Sum the weights, roll a number in that range, then walk the list subtracting each weight until the roll lands inside one item's slice. This is the core of loot and spawn tables.",
  },
  "cellular-automata-caves": {
    analogy: "Imagine each tile looking at its eight neighbours and deciding to become rock or open space based on how crowded those neighbours are.",
    explanation: "For every cell, count neighbouring walls and treat out-of-bounds cells as walls. If the count is high enough, the cell becomes a wall in the next generation; otherwise it becomes open space.",
  },
  "topological-sort": {
    analogy: "Imagine lining up chores so that each chore only starts after the chores it depends on are finished.",
    explanation: "Count incoming edges for every node, queue the nodes with indegree zero, then repeatedly emit a queued node and reduce the indegrees of its neighbours. The emitted order respects every dependency.",
  },
};

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
    description: "Look at each number from left to right until you find the target, or learn that it is missing.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    breakpoints: [3, 4, 8],
    code: `function linearSearch(values: number[], target: number): number {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === target) {
      return index;
    }
  }

  return -1;
}

const values = [8, 3, 11, 6, 2];
const foundIndex = linearSearch(values, 6);
const missingIndex = linearSearch(values, 4);
console.log("Index of 6:", foundIndex);
console.log("Index of 4:", missingIndex);`,
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
  {
    id: "flood-fill",
    title: "Flood fill",
    category: "Games",
    description: "Recolor every connected grid cell that matches a starting value.",
    timeComplexity: "O(R * C)",
    spaceComplexity: "O(R * C)",
    breakpoints: [8, 32],
    code: `type Grid = number[][];

function floodFill(
  grid: Grid,
  startRow: number,
  startColumn: number,
  replacement: number,
): void {
  const target = grid[startRow][startColumn];

  if (target === replacement) {
    return;
  }

  const queue = [[startRow, startColumn]];
  grid[startRow][startColumn] = replacement;

  while (queue.length > 0) {
    const cell = queue.shift();

    if (cell === undefined) {
      break;
    }

    const row = cell[0];
    const column = cell[1];
    const neighbors = [
      [row - 1, column],
      [row + 1, column],
      [row, column - 1],
      [row, column + 1],
    ];

    for (const neighbor of neighbors) {
      const nextRow = neighbor[0];
      const nextColumn = neighbor[1];

      if (
        nextRow >= 0 &&
        nextRow < grid.length &&
        nextColumn >= 0 &&
        nextColumn < grid[0].length &&
        grid[nextRow][nextColumn] === target
      ) {
        grid[nextRow][nextColumn] = replacement;
        queue.push([nextRow, nextColumn]);
      }
    }
  }
}

const grid: Grid = [
  [1, 1, 0],
  [1, 0, 0],
  [1, 1, 1],
];
floodFill(grid, 0, 0, 2);
console.log("Filled grid:", grid);`,
  },
  {
    id: "bresenham-line",
    title: "Bresenham line",
    category: "Games",
    description: "Trace every grid cell crossed by a straight line.",
    timeComplexity: "O(max(Δx, Δy))",
    spaceComplexity: "O(max(Δx, Δy))",
    breakpoints: [14, 20],
    code: `function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number[][] {
  const points: number[][] = [];
  let x = x0;
  let y = y0;
  const deltaX = Math.abs(x1 - x0);
  const deltaY = Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = deltaX - deltaY;

  while (true) {
    points.push([x, y]);

    if (x === x1 && y === y1) {
      break;
    }

    const error2 = error * 2;

    if (error2 > -deltaY) {
      error -= deltaY;
      x += stepX;
    }

    if (error2 < deltaX) {
      error += deltaX;
      y += stepY;
    }
  }

  return points;
}

const line = bresenhamLine(0, 0, 4, 2);
console.log("Line cells:", line);`,
  },
  {
    id: "aabb-collision",
    title: "AABB collision",
    category: "Games",
    description: "Test whether two axis-aligned rectangles overlap.",
    timeComplexity: "O(1)",
    spaceComplexity: "O(1)",
    breakpoints: [9, 15],
    code: `function aabbOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  const separate =
    ax + aw <= bx ||
    bx + bw <= ax ||
    ay + ah <= by ||
    by + bh <= ay;

  return !separate;
}

const hits = aabbOverlap(0, 0, 2, 2, 1, 1, 2, 2);
const misses = aabbOverlap(0, 0, 2, 2, 3, 0, 2, 2);
console.log("Overlap:", hits);
console.log("Separate:", misses);`,
  },
  {
    id: "binary-heap",
    title: "Binary heap",
    category: "Games",
    description: "Insert values and repeatedly extract the smallest one.",
    timeComplexity: "O(log n) per operation",
    spaceComplexity: "O(n)",
    breakpoints: [18, 55],
    code: `function heapParent(index: number): number {
  return Math.floor((index - 1) / 2);
}

function heapLeft(index: number): number {
  return index * 2 + 1;
}

function heapRight(index: number): number {
  return index * 2 + 2;
}

function siftUp(heap: number[], index: number): void {
  while (index > 0) {
    const parent = heapParent(index);

    if (heap[index] >= heap[parent]) {
      break;
    }

    const temporary = heap[index];
    heap[index] = heap[parent];
    heap[parent] = temporary;
    index = parent;
  }
}

function siftDown(heap: number[], index: number): void {
  while (true) {
    const left = heapLeft(index);
    const right = heapRight(index);
    let smallest = index;

    if (left < heap.length && heap[left] < heap[smallest]) {
      smallest = left;
    }

    if (right < heap.length && heap[right] < heap[smallest]) {
      smallest = right;
    }

    if (smallest === index) {
      break;
    }

    const temporary = heap[index];
    heap[index] = heap[smallest];
    heap[smallest] = temporary;
    index = smallest;
  }
}

function heapPush(heap: number[], value: number): void {
  heap.push(value);
  siftUp(heap, heap.length - 1);
}

function heapPop(heap: number[]): number | undefined {
  if (heap.length === 0) {
    return undefined;
  }

  const minimum = heap[0];
  const last = heap.pop();

  if (heap.length > 0 && last !== undefined) {
    heap[0] = last;
    siftDown(heap, 0);
  }

  return minimum;
}

const heap: number[] = [];
heapPush(heap, 5);
heapPush(heap, 1);
heapPush(heap, 3);
const first = heapPop(heap);
const second = heapPop(heap);
console.log("Pop order:", [first, second]);`,
  },
  {
    id: "a-star-pathfinding",
    title: "A* pathfinding",
    category: "Games",
    description: "Search a short walkable path with a goal heuristic.",
    timeComplexity: "O(R * C * log(R * C))",
    spaceComplexity: "O(R * C)",
    breakpoints: [28, 48],
    code: `type Point = { row: number; column: number };

function keyOf(point: Point): string {
  return point.row + "," + point.column;
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.row - b.row) + Math.abs(a.column - b.column);
}

function aStar(walkable: boolean[][], start: Point, goal: Point): Point[] {
  const open: Point[] = [start];
  const cameFrom: Record<string, string> = {};
  const gScore: Record<string, number> = {};
  const fScore: Record<string, number> = {};
  const startKey = keyOf(start);
  gScore[startKey] = 0;
  fScore[startKey] = heuristic(start, goal);

  while (open.length > 0) {
    let bestIndex = 0;

    for (let index = 1; index < open.length; index += 1) {
      if (fScore[keyOf(open[index])] < fScore[keyOf(open[bestIndex])]) {
        bestIndex = index;
      }
    }

    const current = open[bestIndex];
    open.splice(bestIndex, 1);

    if (current.row === goal.row && current.column === goal.column) {
      const path = [current];
      let cursor = keyOf(current);

      while (cameFrom[cursor] !== undefined) {
        const parts = cameFrom[cursor].split(",");
        const previous = {
          row: Number(parts[0]),
          column: Number(parts[1]),
        };
        path.unshift(previous);
        cursor = cameFrom[cursor];
      }

      return path;
    }

    const neighbors = [
      { row: current.row - 1, column: current.column },
      { row: current.row + 1, column: current.column },
      { row: current.row, column: current.column - 1 },
      { row: current.row, column: current.column + 1 },
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor.row < 0 ||
        neighbor.row >= walkable.length ||
        neighbor.column < 0 ||
        neighbor.column >= walkable[0].length ||
        !walkable[neighbor.row][neighbor.column]
      ) {
        continue;
      }

      const tentative = gScore[keyOf(current)] + 1;
      const neighborKey = keyOf(neighbor);

      if (
        gScore[neighborKey] === undefined ||
        tentative < gScore[neighborKey]
      ) {
        cameFrom[neighborKey] = keyOf(current);
        gScore[neighborKey] = tentative;
        fScore[neighborKey] = tentative + heuristic(neighbor, goal);
        let queued = false;

        for (const candidate of open) {
          if (
            candidate.row === neighbor.row &&
            candidate.column === neighbor.column
          ) {
            queued = true;
          }
        }

        if (!queued) {
          open.push(neighbor);
        }
      }
    }
  }

  return [];
}

const walkable = [
  [true, true, false, true],
  [true, false, false, true],
  [true, true, true, true],
];
const path = aStar(
  walkable,
  { row: 0, column: 0 },
  { row: 0, column: 3 },
);
console.log("Path:", path);`,
  },
  {
    id: "minimax",
    title: "Minimax",
    category: "Games",
    description: "Evaluate a game tree against a perfect opposing player.",
    timeComplexity: "O(b^d)",
    spaceComplexity: "O(d)",
    breakpoints: [4, 12],
    code: `type GameNode = {
  value: number | null;
  children: GameNode[];
};

function minimax(node: GameNode, maximizing: boolean): number {
  if (node.value !== null) {
    return node.value;
  }

  if (maximizing) {
    let best = -Infinity;

    for (const child of node.children) {
      const score = minimax(child, false);

      if (score > best) {
        best = score;
      }
    }

    return best;
  }

  let best = Infinity;

  for (const child of node.children) {
    const score = minimax(child, true);

    if (score < best) {
      best = score;
    }
  }

  return best;
}

const tree: GameNode = {
  value: null,
  children: [
    {
      value: null,
      children: [
        { value: 3, children: [] },
        { value: 5, children: [] },
      ],
    },
    {
      value: null,
      children: [
        { value: 2, children: [] },
        { value: 9, children: [] },
      ],
    },
  ],
};
const score = minimax(tree, true);
console.log("Best score:", score);`,
  },
  {
    id: "npc-finite-state-machine",
    title: "NPC state machine",
    category: "Games",
    description: "Transition an enemy between patrol, chase, and attack.",
    timeComplexity: "O(1) per update",
    spaceComplexity: "O(1)",
    breakpoints: [5, 18],
    code: `type NpcState = "patrol" | "chase" | "attack";

function transition(
  state: NpcState,
  playerVisible: boolean,
  inAttackRange: boolean,
): NpcState {
  if (state === "patrol") {
    if (playerVisible) {
      return "chase";
    }

    return "patrol";
  }

  if (state === "chase") {
    if (!playerVisible) {
      return "patrol";
    }

    if (inAttackRange) {
      return "attack";
    }

    return "chase";
  }

  if (!playerVisible) {
    return "patrol";
  }

  if (!inAttackRange) {
    return "chase";
  }

  return "attack";
}

const steps = [
  { visible: false, range: false },
  { visible: true, range: false },
  { visible: true, range: true },
  { visible: true, range: false },
  { visible: false, range: false },
];
let state: NpcState = "patrol";
const history: NpcState[] = [state];

for (const step of steps) {
  state = transition(state, step.visible, step.range);
  history.push(state);
}

console.log("State history:", history);`,
  },
  {
    id: "fisher-yates-shuffle",
    title: "Fisher-Yates shuffle",
    category: "Games",
    description: "Produce a fair permutation with a seeded generator.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    breakpoints: [2, 10],
    code: `function nextSeed(seed: number): number {
  return (seed * 1103515245 + 12345) % 2147483648;
}

function fisherYates(values: number[], seed: number): number[] {
  const shuffled = values.slice();
  let state = seed;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextSeed(state);
    const swapIndex = state % (index + 1);
    const temporary = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = temporary;
  }

  return shuffled;
}

const deck = [1, 2, 3, 4, 5];
const shuffled = fisherYates(deck, 1);
console.log("Shuffled deck:", shuffled);`,
  },
  {
    id: "weighted-random-pick",
    title: "Weighted random pick",
    category: "Games",
    description: "Choose an item according to designer-authored weights.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    breakpoints: [8, 14],
    code: `function nextSeed(seed: number): number {
  return (seed * 1103515245 + 12345) % 2147483648;
}

function weightedPick(
  items: string[],
  weights: number[],
  seed: number,
): string {
  let total = 0;

  for (const weight of weights) {
    total += weight;
  }

  const state = nextSeed(seed);
  let cursor = state % total;

  for (let index = 0; index < items.length; index += 1) {
    if (cursor < weights[index]) {
      return items[index];
    }

    cursor -= weights[index];
  }

  return items[items.length - 1];
}

const loot = ["common", "rare", "epic"];
const weights = [70, 25, 5];
const drop = weightedPick(loot, weights, 42);
console.log("Loot drop:", drop);`,
  },
  {
    id: "cellular-automata-caves",
    title: "Cellular automata caves",
    category: "Games",
    description: "Smooth a noisy grid into cave-like rooms.",
    timeComplexity: "O(R * C)",
    spaceComplexity: "O(R * C)",
    breakpoints: [18, 36],
    code: `function countWalls(grid: number[][], row: number, column: number): number {
  let walls = 0;

  for (let offsetRow = -1; offsetRow <= 1; offsetRow += 1) {
    for (let offsetColumn = -1; offsetColumn <= 1; offsetColumn += 1) {
      if (offsetRow === 0 && offsetColumn === 0) {
        continue;
      }

      const nextRow = row + offsetRow;
      const nextColumn = column + offsetColumn;

      if (
        nextRow < 0 ||
        nextRow >= grid.length ||
        nextColumn < 0 ||
        nextColumn >= grid[0].length ||
        grid[nextRow][nextColumn] === 1
      ) {
        walls += 1;
      }
    }
  }

  return walls;
}

function smoothCaves(grid: number[][]): number[][] {
  const next: number[][] = [];

  for (let row = 0; row < grid.length; row += 1) {
    const line: number[] = [];

    for (let column = 0; column < grid[row].length; column += 1) {
      const walls = countWalls(grid, row, column);

      if (walls >= 5) {
        line.push(1);
      } else {
        line.push(0);
      }
    }

    next.push(line);
  }

  return next;
}

let caves = [
  [1, 1, 1, 0, 0],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1],
];
caves = smoothCaves(caves);
caves = smoothCaves(caves);
console.log("Cave map:", caves);`,
  },
  {
    id: "topological-sort",
    title: "Topological sort",
    category: "Games",
    description: "Order quests so every dependency comes first.",
    timeComplexity: "O(V + E)",
    spaceComplexity: "O(V)",
    breakpoints: [16, 30],
    code: `type Graph = Record<string, string[]>;

function topologicalSort(graph: Graph): string[] {
  const indegree: Record<string, number> = {};

  for (const node of Object.keys(graph)) {
    indegree[node] = 0;
  }

  for (const node of Object.keys(graph)) {
    for (const neighbor of graph[node]) {
      indegree[neighbor] += 1;
    }
  }

  const queue: string[] = [];

  for (const node of Object.keys(indegree)) {
    if (indegree[node] === 0) {
      queue.push(node);
    }
  }

  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined) {
      break;
    }

    order.push(current);

    for (const neighbor of graph[current]) {
      indegree[neighbor] -= 1;

      if (indegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  return order;
}

const quests: Graph = {
  intro: ["forest", "town"],
  forest: ["boss"],
  town: ["boss"],
  boss: [],
};
const order = topologicalSort(quests);
console.log("Quest order:", order);`,
  },
];

export const algorithmExamples: AlgorithmExample[] = sourceAlgorithmExamples.map(
  (example) => {
    const sourceNotes = teachingNotesByExample[example.id] ?? {};
    const reordered = reorderForLearning(example.code);
    const reorderedNotes = Object.fromEntries(
      Object.entries(sourceNotes).flatMap(([line, note]) => {
        const reorderedLine = reordered.lineMap[Number(line)];
        return reorderedLine ? [[reorderedLine, note]] : [];
      }),
    );
    const reorderedBreakpoints = example.breakpoints.map(
      (line) => reordered.lineMap[line] ?? line,
    );
    const noteLines = Object.keys(reorderedNotes).map(Number).sort((left, right) => left - right);
    const questionLines = reorderedBreakpoints.map(
      (line) =>
        reorderedNotes[line]
          ? line
          : noteLines.find((noteLine) => noteLine >= line) ?? line,
    );

    const preparedNotes = prepareTeachingNotes(
      reordered.code,
      reorderedNotes,
      questionLines,
    );
    const introduction = beginnerIntroductions[example.id];

    return {
      ...example,
      breakpoints: questionLines,
      code: reordered.code,
      teachingNotes: {
        ...preparedNotes,
        1: {
          title: "Problem",
          explanation: `**${example.title}**\n\n${introduction?.analogy ?? example.description}\n\n## How it works\n\n${introduction?.explanation ?? example.description}`,
        },
      },
    };
  },
);
