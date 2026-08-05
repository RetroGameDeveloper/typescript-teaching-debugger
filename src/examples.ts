export type AlgorithmCategory =
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

export const algorithmExamples: AlgorithmExample[] = [
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
