export function appendInlineMarkdown(parent: HTMLElement, source: string): void {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    parent.append(document.createTextNode(source.slice(cursor, match.index)));
    const token = match[0];
    const element = document.createElement(
      token.startsWith("`") ? "code" : token.startsWith("**") ? "strong" : "em",
    );
    element.textContent = token.startsWith("**")
      ? token.slice(2, -2)
      : token.slice(1, -1);
    parent.append(element);
    cursor = match.index + token.length;
  }

  parent.append(document.createTextNode(source.slice(cursor)));
}

export function renderMarkdown(target: HTMLElement, markdown: string): void {
  target.replaceChildren();
  const lines = markdown.split("\n");
  let list: HTMLUListElement | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      list = undefined;
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.+)$/);

    if (listItem) {
      if (!list) {
        list = document.createElement("ul");
        target.append(list);
      }
      const item = document.createElement("li");
      appendInlineMarkdown(item, listItem[1] ?? "");
      list.append(item);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading?.[1] && heading[2]) {
      list = undefined;
      const headingElement = document.createElement("h3");
      headingElement.className =
        `markdown-heading markdown-heading-${heading[1].length}`;
      appendInlineMarkdown(headingElement, heading[2]);
      target.append(headingElement);
      continue;
    }

    list = undefined;
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, line);
    target.append(paragraph);
  }
}
