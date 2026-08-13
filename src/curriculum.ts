export interface CurriculumGroup {
  ids: string[];
  title: string;
}

export const curriculumGroups: CurriculumGroup[] = [
  {
    title: "Fundamentals",
    ids: ["linear-search", "binary-search", "factorial-recursion"],
  },
  {
    title: "Elementary sorting",
    ids: ["bubble-sort", "selection-sort", "insertion-sort"],
  },
  {
    title: "Divide and conquer",
    ids: ["merge-sort", "quick-sort"],
  },
  {
    title: "Graph algorithms",
    ids: ["breadth-first-search", "depth-first-search", "dijkstra-shortest-path"],
  },
  {
    title: "Dynamic programming",
    ids: ["fibonacci-dynamic-programming"],
  },
  {
    title: "Game algorithms",
    ids: [
      "flood-fill",
      "bresenham-line",
      "aabb-collision",
      "binary-heap",
      "a-star-pathfinding",
      "minimax",
      "npc-finite-state-machine",
      "fisher-yates-shuffle",
      "weighted-random-pick",
      "cellular-automata-caves",
      "topological-sort",
    ],
  },
  {
    title: "Control flow and SSA",
    ids: [
      "cfg-reverse-postorder",
      "iterative-dominators",
      "dominance-frontiers",
      "cytron-phi-placement",
      "ssa-renaming",
    ],
  },
];
