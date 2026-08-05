import "./ts-teaching-debugger";
import {
  algorithmExamples,
  type AlgorithmCategory,
  type AlgorithmExample,
} from "./examples";
import type { TsTeachingDebuggerElement } from "./ts-teaching-debugger";

type CategoryFilter = "All" | AlgorithmCategory;

const teachingDebugger = document.querySelector<TsTeachingDebuggerElement>(
  "#debugger",
);
const exampleList = requiredElement<HTMLElement>("#example-list");
const exampleCount = requiredElement<HTMLElement>("#example-count");
const searchInput = requiredElement<HTMLInputElement>("#example-search");
const categoryFilters = requiredElement<HTMLElement>("#category-filters");
const lessonCategory = requiredElement<HTMLElement>("#lesson-category");
const lessonTitle = requiredElement<HTMLElement>("#lesson-title");
const lessonDescription = requiredElement<HTMLElement>("#lesson-description");
const timeComplexity = requiredElement<HTMLElement>("#time-complexity");
const spaceComplexity = requiredElement<HTMLElement>("#space-complexity");

let activeCategory: CategoryFilter = "All";
const firstExample = algorithmExamples[0];

if (!firstExample) {
  throw new Error("The algorithm library must contain at least one example.");
}

let activeExample: AlgorithmExample = firstExample;
let query = "";

function requiredElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);

  if (!element) {
    throw new Error(`Missing page element: ${selector}`);
  }

  return element;
}

function categories(): CategoryFilter[] {
  return [
    "All",
    ...new Set(algorithmExamples.map((example) => example.category)),
  ];
}

function filteredExamples(): AlgorithmExample[] {
  const normalizedQuery = query.trim().toLowerCase();

  return algorithmExamples.filter((example) => {
    const matchesCategory =
      activeCategory === "All" || example.category === activeCategory;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      `${example.title} ${example.description} ${example.category}`
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });
}

function selectExample(example: AlgorithmExample): void {
  activeExample = example;
  lessonCategory.textContent = example.category;
  lessonTitle.textContent = example.title;
  lessonDescription.textContent = example.description;
  timeComplexity.textContent = `Time ${example.timeComplexity}`;
  spaceComplexity.textContent = `Space ${example.spaceComplexity}`;

  if (teachingDebugger) {
    teachingDebugger.code = example.code;
    teachingDebugger.breakpoints = example.breakpoints;
  }

  renderExampleList();
}

function renderCategoryFilters(): void {
  categoryFilters.replaceChildren();

  for (const category of categories()) {
    const button = document.createElement("button");
    button.className = "category-button";
    button.type = "button";
    button.textContent = category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => {
      activeCategory = category;
      renderCategoryFilters();
      renderExampleList();
    });
    categoryFilters.append(button);
  }
}

function renderExampleList(): void {
  const examples = filteredExamples();
  exampleList.replaceChildren();
  exampleCount.textContent = String(examples.length);

  if (examples.length === 0) {
    const empty = document.createElement("p");
    empty.className = "example-summary";
    empty.textContent = "No algorithms match this search.";
    exampleList.append(empty);
    return;
  }

  for (const example of examples) {
    const button = document.createElement("button");
    button.className = "example-button";
    button.type = "button";
    button.setAttribute("aria-current", String(example.id === activeExample.id));

    const title = document.createElement("span");
    title.className = "example-title";
    title.textContent = example.title;

    const description = document.createElement("span");
    description.className = "example-summary";
    description.textContent = example.description;

    const complexity = document.createElement("span");
    complexity.className = "example-complexity";
    complexity.textContent = `${example.timeComplexity} time - ${example.spaceComplexity} space`;

    button.append(title, description, complexity);
    button.addEventListener("click", () => selectExample(example));
    exampleList.append(button);
  }
}

searchInput.addEventListener("input", () => {
  query = searchInput.value;
  renderExampleList();
});

renderCategoryFilters();
selectExample(activeExample);
