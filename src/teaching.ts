export interface TeachingNote {
  answer?: number;
  arguments?: Record<string, string>;
  choices?: string[];
  explanation: string;
  question?: string;
  solution?: string;
  title: string;
}

export type TeachingNotes = Record<number, TeachingNote>;

export interface TeachingComment extends TeachingNote {
  from: number;
  line: number;
  markdown: string;
  to: number;
}

export interface TeachingSymbol {
  kind: "function" | "parameter" | "variable";
  line: number;
  name: string;
  note: TeachingNote;
  position: number;
}

export interface AnnotatedCode {
  code: string;
  lineMap: Record<number, number>;
}

const argumentDescriptions: Record<string, string> = {
  a: "The first point or rectangle value used by this comparison.",
  ah: "The height of rectangle A.",
  aw: "The width of rectangle A.",
  ax: "The left edge of rectangle A.",
  ay: "The top edge of rectangle A.",
  b: "The second point or rectangle value used by this comparison.",
  bh: "The height of rectangle B.",
  block: "The current control-flow graph block.",
  blocks: "The control-flow graph blocks processed by the algorithm.",
  bw: "The width of rectangle B.",
  bx: "The left edge of rectangle B.",
  by: "The top edge of rectangle B.",
  column: "The column currently being examined.",
  count: "The number of items or iterations to process.",
  current: "The item currently being examined.",
  definitionBlocks: "The blocks containing definitions of the variable.",
  dominanceFrontier: "The dominance-frontier relation used to find join points.",
  entry: "The entry block where control-flow analysis begins.",
  goal: "The destination cell the pathfinder is trying to reach.",
  graph: "The graph represented by its adjacency lists.",
  grid: "The two-dimensional map or board being processed.",
  heap: "The binary-heap array ordered so parents are smaller than children.",
  high: "The inclusive upper bound of the current search range.",
  immediateDominator: "The immediate-dominator relation for the control-flow graph.",
  inAttackRange: "Whether the player is close enough for a melee attack.",
  index: "The position currently being examined.",
  input: "The input values supplied to the algorithm.",
  items: "The candidate items that can be selected.",
  left: "The left input or boundary used by this step.",
  low: "The inclusive lower bound of the current search range.",
  maximizing: "Whether this minimax frame chooses the highest child score.",
  node: "The graph node or game-tree node currently being processed.",
  order: "The traversal order accumulated by the algorithm.",
  playerVisible: "Whether the NPC can currently see the player.",
  point: "The grid coordinate being converted or inspected.",
  predecessor: "A control-flow predecessor of the current block.",
  predecessors: "The predecessor relation for the control-flow graph.",
  replacement: "The new value written into every filled cell.",
  right: "The right input or boundary used by this step.",
  row: "The row currently being examined.",
  seed: "The deterministic seed that drives the lesson's random numbers.",
  stacks: "The per-variable stacks holding current SSA names.",
  start: "The starting node, cell, or index for the algorithm.",
  startColumn: "The column where the flood fill begins.",
  startRow: "The row where the flood fill begins.",
  state: "The NPC behaviour state before this transition.",
  statements: "The statements that the analysis or transformation processes.",
  target: "The value the algorithm is trying to locate.",
  tree: "The dominator tree or game tree used by the algorithm.",
  value: "The value supplied to this function.",
  values: "The values this algorithm processes.",
  variable: "The variable currently being analysed or renamed.",
  variables: "The variables processed by the algorithm.",
  visited: "The set of graph nodes already visited.",
  walkable: "The grid of passable and blocked tiles used for pathfinding.",
  weights: "The relative chances used by the weighted picker.",
  x0: "The starting x-coordinate of the line.",
  x1: "The ending x-coordinate of the line.",
  y0: "The starting y-coordinate of the line.",
  y1: "The ending y-coordinate of the line.",
};

function matchingParen(source: string, open: number): number {
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

interface FunctionParameter {
  name: string;
  position: number;
}

interface FunctionSignature {
  name: string;
  namePosition: number;
  parameters: FunctionParameter[];
}

function functionSignature(source: string): FunctionSignature | undefined {
  const prefix = source.match(
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
  );

  if (!prefix?.[1]) return undefined;
  const open = (prefix[0]?.length ?? 0) - 1;
  const close = matchingParen(source, open);
  if (close < 0) return undefined;
  const body = source.slice(open + 1, close);
  const parameters: FunctionParameter[] = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  let angle = 0;

  const addParameter = (end: number) => {
    const segment = body.slice(start, end);
    const nameMatch = segment.match(/^\s*(?:\.\.\.\s*)?([A-Za-z_$][\w$]*)/);
    if (nameMatch?.[1]) {
      parameters.push({
        name: nameMatch[1],
        position: open + 1 + start + segment.indexOf(nameMatch[1]),
      });
    }
  };

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "(") round += 1;
    else if (character === ")") round -= 1;
    else if (character === "[") square += 1;
    else if (character === "]") square -= 1;
    else if (character === "{") curly += 1;
    else if (character === "}") curly -= 1;
    else if (character === "<") angle += 1;
    else if (character === ">") angle = Math.max(0, angle - 1);
    else if (
      character === "," &&
      round === 0 &&
      square === 0 &&
      curly === 0 &&
      angle === 0
    ) {
      addParameter(index);
      start = index + 1;
    }
  }

  addParameter(body.length);
  return {
    name: prefix[1],
    namePosition: source.indexOf(prefix[1]),
    parameters,
  };
}

function describeArgument(name: string): string {
  return argumentDescriptions[name] ?? `The \`${name}\` value supplied to this function.`;
}

function multipleChoiceAssessment(note: TeachingNote, line: number): TeachingNote {
  if (note.choices && note.choices.length >= 2) return note;
  const correctChoice = note.solution ?? note.explanation;
  const distractors = [
    "This clears the current data and restarts the algorithm from the beginning.",
    "This skips the remaining work and immediately reports a final result.",
  ];
  const answer = Math.abs(line) % 3;
  const choices = [...distractors];
  choices.splice(answer, 0, correctChoice);

  return {
    ...note,
    answer,
    choices,
    question:
      note.question ??
      "Using what you have learned so far, what do you think this step will do?",
    solution: note.solution ?? note.explanation,
  };
}

function jsdocTextLines(text: string): string[] {
  return text.split("\n").map((line) => (line.trim() === "" ? " *" : ` * ${line}`));
}

function commentBody(note: TeachingNote, indentation: string): string[] {
  const lines = ["/**", ` * ## ${note.title}`, ...jsdocTextLines(note.explanation)];

  if (note.arguments && Object.keys(note.arguments).length > 0) {
    lines.push(" *", " * ### Arguments");
    for (const [name, description] of Object.entries(note.arguments)) {
      lines.push(` * * \`${name}\` - ${description}`);
    }
  }

  if (note.question) {
    lines.push(
      " *",
      " * ### Question",
      ...jsdocTextLines(note.question),
    );
    if (note.choices && note.choices.length > 0) {
      lines.push(" *", " * ### Choices");
      for (const choice of note.choices) lines.push(` * * ${choice}`);
    }
    if (note.answer !== undefined) {
      lines.push(" *", " * ### Answer", ` * ${note.answer + 1}`);
    }
    if (note.solution) {
      lines.push(" *", " * ### Solution", ...jsdocTextLines(note.solution));
    }
  }

  lines.push(" */");
  return lines.map((line) => `${indentation}${line}`);
}

export function annotateCode(
  code: string,
  sourceNotes: TeachingNotes,
  questionLines: Iterable<number> = [],
): AnnotatedCode {
  const preparedNotes = prepareTeachingNotes(code, sourceNotes, questionLines);
  const output: string[] = [];
  const lineMap: Record<number, number> = {};

  const sourceLines = code.split("\n");
  sourceLines.forEach((line, index) => {
    const sourceLine = index + 1;
    const sourceNote = preparedNotes[sourceLine];

    if (sourceNote) {
      const indentation = line.match(/^\s*/)?.[0] ?? "";
      output.push(...commentBody(sourceNote, indentation));
    }

    lineMap[sourceLine] = output.length + 1;
    output.push(line);
  });

  return { code: output.join("\n"), lineMap };
}

export function prepareTeachingNotes(
  code: string,
  sourceNotes: TeachingNotes,
  questionLines: Iterable<number> = [],
): TeachingNotes {
  const questions = new Set(questionLines);
  const sourceLines = code.split("\n");

  return Object.fromEntries(
    Object.entries(sourceNotes).map(([lineText, sourceNote]) => {
      const line = Number(lineText);
      let note = questions.has(line)
        ? multipleChoiceAssessment(sourceNote, line)
        : sourceNote;
      const signature = functionSignature(sourceLines.slice(line - 1).join("\n"));
      if (signature && !note.arguments) {
        note = {
          ...note,
          arguments: Object.fromEntries(
            signature.parameters.map(({ name }) => [name, describeArgument(name)]),
          ),
        };
      }
      return [line, note];
    }),
  );
}

function cleanCommentBody(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, "").trimEnd());
}

function section(lines: string[], start: number, end: number): string {
  return lines.slice(start, end).join("\n").trim();
}

export function parseTeachingComments(code: string): TeachingComment[] {
  const comments: TeachingComment[] = [];
  const pattern = /\/\*\*([\s\S]*?)\*\//g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(code))) {
    const lines = cleanCommentBody(match[1] ?? "");
    const titleIndex = lines.findIndex((line) => /^#{1,6}\s+\S/.test(line));

    if (titleIndex < 0) continue;

    const argumentsIndex = lines.findIndex((line) =>
      /^#{1,6}\s+(Arguments|Parameters)\s*$/i.test(line),
    );
    const questionIndex = lines.findIndex((line) => /^#{1,6}\s+Question\s*$/i.test(line));
    const choicesIndex = lines.findIndex((line) => /^#{1,6}\s+Choices\s*$/i.test(line));
    const answerIndex = lines.findIndex((line) => /^#{1,6}\s+Answer\s*$/i.test(line));
    const solutionIndex = lines.findIndex((line) => /^#{1,6}\s+Solution\s*$/i.test(line));
    const explanationEnd = [argumentsIndex, questionIndex, choicesIndex, answerIndex, solutionIndex]
      .filter((index) => index >= 0)
      .reduce((lowest, index) => Math.min(lowest, index), lines.length);
    const title = lines[titleIndex]?.replace(/^#{1,6}\s+/, "").trim() ?? "Why this line exists";
    const explanation = section(lines, titleIndex + 1, explanationEnd);
    const argumentsEnd = [questionIndex, choicesIndex, answerIndex, solutionIndex]
      .filter((index) => index > argumentsIndex)
      .reduce((lowest, index) => Math.min(lowest, index), lines.length);
    const argumentEntries = argumentsIndex >= 0
      ? lines
          .slice(argumentsIndex + 1, argumentsEnd)
          .flatMap((line) => {
            const argument = line.match(/^[-*]\s+`([^`]+)`\s*[-:]\s*(.+)$/);
            return argument?.[1] && argument[2] ? [[argument[1], argument[2]]] : [];
          })
      : [];
    const argumentsDocumentation =
      argumentEntries.length > 0 ? Object.fromEntries(argumentEntries) : undefined;
    const question =
      questionIndex >= 0
        ? section(
            lines,
            questionIndex + 1,
            [choicesIndex, answerIndex, solutionIndex]
              .filter((index) => index > questionIndex)
              .reduce((lowest, index) => Math.min(lowest, index), lines.length),
          )
        : undefined;
    const choicesEnd = [answerIndex, solutionIndex]
      .filter((index) => index > choicesIndex)
      .reduce((lowest, index) => Math.min(lowest, index), lines.length);
    const choices = choicesIndex >= 0
      ? lines
          .slice(choicesIndex + 1, choicesEnd)
          .flatMap((line) => {
            const choice = line.match(/^[-*]\s+(.+)$/)?.[1]?.trim();
            return choice ? [choice] : [];
          })
      : undefined;
    const answerBody = answerIndex >= 0
      ? section(
          lines,
          answerIndex + 1,
          solutionIndex > answerIndex ? solutionIndex : lines.length,
        )
      : undefined;
    const parsedAnswer = answerBody && /^\d+$/.test(answerBody)
      ? Number(answerBody) - 1
      : undefined;
    const solution = solutionIndex >= 0
      ? section(lines, solutionIndex + 1, lines.length)
      : answerBody && parsedAnswer === undefined
        ? answerBody
        : undefined;
    let next = pattern.lastIndex;

    while (code[next] === " " || code[next] === "\t" || code[next] === "\r" || code[next] === "\n") {
      next += 1;
    }

    const line = code.slice(0, next).split("\n").length;
    const lineStart = code.lastIndexOf("\n", match.index) + 1;
    const afterCommentLine = code.indexOf("\n", pattern.lastIndex);

    comments.push({
      ...(parsedAnswer !== undefined ? { answer: parsedAnswer } : {}),
      ...(argumentsDocumentation ? { arguments: argumentsDocumentation } : {}),
      ...(choices && choices.length > 0 ? { choices } : {}),
      explanation,
      from: lineStart,
      line,
      markdown: lines.join("\n").trim(),
      question,
      solution,
      title,
      to: afterCommentLine >= 0 ? afterCommentLine + 1 : pattern.lastIndex,
    });
  }

  return comments;
}

export function teachingNotesFromComments(code: string): TeachingNotes {
  return Object.fromEntries(
    parseTeachingComments(code).map(({ answer, arguments: args, choices, explanation, line, question, solution, title }) => [
      line,
      {
        ...(answer !== undefined ? { answer } : {}),
        ...(args ? { arguments: args } : {}),
        ...(choices ? { choices } : {}),
        explanation,
        question,
        solution,
        title,
      },
    ]),
  );
}

export function parseTeachingSymbols(code: string): TeachingSymbol[] {
  const sourceLines = code.split("\n");
  const lineStarts: number[] = [];
  let position = 0;

  for (const line of sourceLines) {
    lineStarts.push(position);
    position += line.length + 1;
  }

  return parseTeachingComments(code).flatMap((comment) => {
    const source = sourceLines[comment.line - 1] ?? "";
    const sourceStart = lineStarts[comment.line - 1] ?? 0;
    const signature = functionSignature(code.slice(sourceStart));
    const variableMatch = source.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
    const matchName = signature?.name ?? variableMatch?.[1];

    if (!matchName) return [];

    const note: TeachingNote = {
      ...(comment.answer !== undefined ? { answer: comment.answer } : {}),
      ...(comment.arguments ? { arguments: comment.arguments } : {}),
      ...(comment.choices ? { choices: comment.choices } : {}),
      explanation: comment.explanation,
      question: comment.question,
      solution: comment.solution,
      title: comment.title,
    };
    const declaration: TeachingSymbol = {
      kind: signature ? "function" : "variable",
      line: comment.line,
      name: matchName,
      note,
      position: sourceStart +
        (signature ? signature.namePosition : source.indexOf(matchName)),
    };

    if (!signature) return [declaration];

    return [
      declaration,
      ...signature.parameters.flatMap(({ name, position: parameterPosition }) => {
        const explanation = comment.arguments?.[name];
        if (!explanation) return [];
        return [{
          kind: "parameter" as const,
          line: comment.line,
          name,
          note: {
            explanation,
            title: `Argument ${name}`,
          },
          position: sourceStart + parameterPosition,
        } satisfies TeachingSymbol];
      }),
    ];
  });
}
