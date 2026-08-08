export interface TeachingNote {
  arguments?: Record<string, string>;
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
  block: "The current control-flow graph block.",
  blocks: "The control-flow graph blocks processed by the algorithm.",
  count: "The number of items or iterations to process.",
  current: "The item currently being examined.",
  definitionBlocks: "The blocks containing definitions of the variable.",
  dominanceFrontier: "The dominance-frontier relation used to find join points.",
  entry: "The entry block where control-flow analysis begins.",
  graph: "The graph represented by its adjacency lists.",
  high: "The inclusive upper bound of the current search range.",
  immediateDominator: "The immediate-dominator relation for the control-flow graph.",
  index: "The position currently being examined.",
  input: "The input values supplied to the algorithm.",
  left: "The left input or boundary used by this step.",
  low: "The inclusive lower bound of the current search range.",
  node: "The graph node currently being processed.",
  order: "The traversal order accumulated by the algorithm.",
  predecessor: "A control-flow predecessor of the current block.",
  predecessors: "The predecessor relation for the control-flow graph.",
  right: "The right input or boundary used by this step.",
  stacks: "The per-variable stacks holding current SSA names.",
  start: "The starting node or index for the algorithm.",
  statements: "The statements that the analysis or transformation processes.",
  target: "The value the algorithm is trying to locate.",
  tree: "The dominator tree used to visit dominated blocks.",
  value: "The value supplied to this function.",
  values: "The values this algorithm processes.",
  variable: "The variable currently being analysed or renamed.",
  variables: "The variables processed by the algorithm.",
  visited: "The set of graph nodes already visited.",
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

function commentBody(note: TeachingNote, indentation: string): string[] {
  const lines = ["/**", ` * ## ${note.title}`, ` * ${note.explanation}`];

  if (note.arguments && Object.keys(note.arguments).length > 0) {
    lines.push(" *", " * ### Arguments");
    for (const [name, description] of Object.entries(note.arguments)) {
      lines.push(` * * \`${name}\` - ${description}`);
    }
  }

  if (note.question && note.solution) {
    lines.push(
      " *",
      " * ### Question",
      ` * ${note.question}`,
      " *",
      " * ### Solution",
      ` * ${note.solution}`,
    );
  }

  lines.push(" */");
  return lines.map((line) => `${indentation}${line}`);
}

export function annotateCode(
  code: string,
  sourceNotes: TeachingNotes,
  questionLines: Iterable<number> = [],
): AnnotatedCode {
  const questions = new Set(questionLines);
  const output: string[] = [];
  const lineMap: Record<number, number> = {};

  const sourceLines = code.split("\n");
  sourceLines.forEach((line, index) => {
    const sourceLine = index + 1;
    const sourceNote = sourceNotes[sourceLine];

    if (sourceNote) {
      let note = questions.has(sourceLine)
        ? {
            ...sourceNote,
            question:
              sourceNote.question ??
              `What role does "${sourceNote.title}" play in this algorithm?`,
            solution: sourceNote.solution ?? sourceNote.explanation,
          }
        : sourceNote;
      const signature = functionSignature(sourceLines.slice(index).join("\n"));
      if (signature && !note.arguments) {
        note = {
          ...note,
          arguments: Object.fromEntries(
            signature.parameters.map(({ name }) => [name, describeArgument(name)]),
          ),
        };
      }
      const indentation = line.match(/^\s*/)?.[0] ?? "";
      output.push(...commentBody(note, indentation));
    }

    lineMap[sourceLine] = output.length + 1;
    output.push(line);
  });

  return { code: output.join("\n"), lineMap };
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
    const solutionIndex = lines.findIndex((line) => /^#{1,6}\s+(Solution|Answer)\s*$/i.test(line));
    const explanationEnd = [argumentsIndex, questionIndex, solutionIndex]
      .filter((index) => index >= 0)
      .reduce((lowest, index) => Math.min(lowest, index), lines.length);
    const title = lines[titleIndex]?.replace(/^#{1,6}\s+/, "").trim() ?? "Why this line exists";
    const explanation = section(lines, titleIndex + 1, explanationEnd);
    const argumentsEnd = [questionIndex, solutionIndex]
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
        ? section(lines, questionIndex + 1, solutionIndex >= 0 ? solutionIndex : lines.length)
        : undefined;
    const solution =
      solutionIndex >= 0 ? section(lines, solutionIndex + 1, lines.length) : undefined;
    let next = pattern.lastIndex;

    while (code[next] === " " || code[next] === "\t" || code[next] === "\r" || code[next] === "\n") {
      next += 1;
    }

    const line = code.slice(0, next).split("\n").length;
    const lineStart = code.lastIndexOf("\n", match.index) + 1;
    const afterCommentLine = code.indexOf("\n", pattern.lastIndex);

    comments.push({
      ...(argumentsDocumentation ? { arguments: argumentsDocumentation } : {}),
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
    parseTeachingComments(code).map(({ arguments: args, explanation, line, question, solution, title }) => [
      line,
      { ...(args ? { arguments: args } : {}), explanation, question, solution, title },
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
      ...(comment.arguments ? { arguments: comment.arguments } : {}),
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
