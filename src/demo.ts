import "./ts-teaching-debugger";
import {
  algorithmExamples,
  type AlgorithmExample,
} from "./examples";
import type { TsTeachingDebuggerElement } from "./ts-teaching-debugger";
import { curriculumGroups } from "./curriculum";


const teachingDebugger = document.querySelector<TsTeachingDebuggerElement>(
  "#debugger",
);
if (teachingDebugger) teachingDebugger.autoResetDelay = -1;
const exampleList = requiredElement<HTMLElement>("#example-list");
const exampleCount = requiredElement<HTMLElement>("#example-count");
const searchInput = requiredElement<HTMLInputElement>("#example-search");
const lessonCategory = requiredElement<HTMLElement>("#lesson-category");
const lessonTitle = requiredElement<HTMLElement>("#lesson-title");
const lessonDescription = requiredElement<HTMLElement>("#lesson-description");
const timeComplexity = requiredElement<HTMLElement>("#time-complexity");
const spaceComplexity = requiredElement<HTMLElement>("#space-complexity");

const examplesById = new Map(
  algorithmExamples.map((example) => [example.id, example]),
);
const firstExample = examplesById.get(curriculumGroups[0]?.ids[0] ?? "");

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

function filteredExamples(): AlgorithmExample[] {
  const normalizedQuery = query.trim().toLowerCase();

  return algorithmExamples.filter((example) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      `${example.title} ${example.description} ${example.category}`
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesQuery;
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
    teachingDebugger.teachingNotes = example.teachingNotes;
    teachingDebugger.breakpoints = [];
  }

  renderExampleList();
}

function renderExampleList(): void {
  const examples = filteredExamples();
  const visibleIds = new Set(examples.map((example) => example.id));
  exampleList.replaceChildren();
  exampleCount.textContent = String(examples.length);

  if (examples.length === 0) {
    const empty = document.createElement("p");
    empty.className = "example-summary";
    empty.textContent = "No algorithms match this search.";
    exampleList.append(empty);
    return;
  }

  for (const [groupIndex, curriculumGroup] of curriculumGroups.entries()) {
    const groupExamples = curriculumGroup.ids
      .filter((id) => visibleIds.has(id))
      .map((id) => examplesById.get(id))
      .filter((example): example is AlgorithmExample => Boolean(example));

    if (groupExamples.length === 0) continue;

    const group = document.createElement("section");
    group.className = "example-group";
    const heading = document.createElement("div");
    heading.className = "example-group-heading";
    const order = document.createElement("span");
    order.className = "example-group-order";
    order.textContent = String(groupIndex + 1).padStart(2, "0");
    const groupTitle = document.createElement("h3");
    groupTitle.className = "example-group-title";
    groupTitle.textContent = curriculumGroup.title;
    heading.append(order, groupTitle);
    group.append(heading);

    for (const example of groupExamples) {
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
      group.append(button);
    }

    exampleList.append(group);
  }
}

searchInput.addEventListener("input", () => {
  query = searchInput.value;
  renderExampleList();
});

selectExample(activeExample);
