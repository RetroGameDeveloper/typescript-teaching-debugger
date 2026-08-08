export interface TeachingNote {
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

export interface AnnotatedCode {
  code: string;
  lineMap: Record<number, number>;
}

function commentBody(note: TeachingNote): string[] {
  const lines = ["/**", ` * ## ${note.title}`, ` * ${note.explanation}`];

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
  return lines;
}

export function annotateCode(
  code: string,
  sourceNotes: TeachingNotes,
  questionLines: Iterable<number> = [],
): AnnotatedCode {
  const questions = new Set(questionLines);
  const output: string[] = [];
  const lineMap: Record<number, number> = {};

  code.split("\n").forEach((line, index) => {
    const sourceLine = index + 1;
    const sourceNote = sourceNotes[sourceLine];

    if (sourceNote) {
      const note = questions.has(sourceLine)
        ? {
            ...sourceNote,
            question:
              sourceNote.question ??
              `What role does "${sourceNote.title}" play in this algorithm?`,
            solution: sourceNote.solution ?? sourceNote.explanation,
          }
        : sourceNote;
      output.push(...commentBody(note));
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

    const questionIndex = lines.findIndex((line) => /^#{1,6}\s+Question\s*$/i.test(line));
    const solutionIndex = lines.findIndex((line) => /^#{1,6}\s+(Solution|Answer)\s*$/i.test(line));
    const explanationEnd = [questionIndex, solutionIndex]
      .filter((index) => index >= 0)
      .reduce((lowest, index) => Math.min(lowest, index), lines.length);
    const title = lines[titleIndex]?.replace(/^#{1,6}\s+/, "").trim() ?? "Why this line exists";
    const explanation = section(lines, titleIndex + 1, explanationEnd);
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
    parseTeachingComments(code).map(({ explanation, line, question, solution, title }) => [
      line,
      { explanation, question, solution, title },
    ]),
  );
}
