/* eslint-disable @typescript-eslint/restrict-template-expressions */

interface PdfSection {
  heading: string;
  rows: {
    label: string;
    value: string;
  }[];
}

interface PdfDocumentInput {
  title: string;
  reference: string;
  generatedAt: string;
  sections: PdfSection[];
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT_MARGIN = 42;
const RIGHT_MARGIN = 42;
const HEADER_HEIGHT = 106;
const HEADER_BOTTOM_Y = PAGE_HEIGHT - HEADER_HEIGHT;
const FOOTER_RULE_Y = 42;
const FOOTER_TEXT_Y = 26;
const CONTENT_BOTTOM_Y = 66;
const BODY_LINE_HEIGHT = 16;
const ROW_GAP = 9;
const SECTION_BOTTOM_GAP = 18;
const VALUE_X = 190;
const VALUE_MAX_CHARACTERS = 61;
const METADATA_MAX_CHARACTERS = 82;

function safePdfText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function textCommand(
  text: string,
  x: number,
  y: number,
  size: number,
  font = "F1",
  color = "0.12 0.16 0.18"
): string {
  return [
    "BT",
    `/${font} ${size} Tf`,
    `${color} rg`,
    `1 0 0 1 ${x} ${y} Tm`,
    `(${safePdfText(text)}) Tj`,
    "ET"
  ].join("\n");
}

function wrapText(value: string, maxLength: number): string[] {
  const normalized = value.trim();
  if (!normalized) {
    return [""];
  }

  const lines: string[] = [];
  const words = normalized.split(/\s+/);
  let currentLine = "";

  const appendLongWord = (word: string) => {
    let remaining = word;
    while (remaining.length > maxLength) {
      lines.push(remaining.slice(0, maxLength));
      remaining = remaining.slice(maxLength);
    }
    currentLine = remaining;
  };

  for (const word of words) {
    if (word.length > maxLength) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
      appendLongWord(word);
      continue;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxLength) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function horizontalRule(y: number, color = "0.82 0.88 0.85"): string {
  return [
    `${color} RG`,
    `${LEFT_MARGIN} ${y} m`,
    `${PAGE_WIDTH - RIGHT_MARGIN} ${y} l`,
    "S"
  ].join("\n");
}

function createPageHeader(
  input: PdfDocumentInput,
  pageNumber: number
): { commands: string[]; contentStartY: number } {
  const commands = [
    "0.04 0.45 0.31 rg",
    `0 ${HEADER_BOTTOM_Y} ${PAGE_WIDTH} ${HEADER_HEIGHT} re f`,
    textCommand(
      "COURTIFY-BADMINTON",
      LEFT_MARGIN,
      PAGE_HEIGHT - 48,
      11,
      "F2",
      "1 1 1"
    ),
    textCommand(
      pageNumber === 1 ? input.title : `${input.title} - Continued`,
      LEFT_MARGIN,
      PAGE_HEIGHT - 80,
      22,
      "F2",
      "1 1 1"
    )
  ];

  let cursorY = HEADER_BOTTOM_Y - 28;
  const referenceLines = wrapText(
    `Reference: ${input.reference}`,
    METADATA_MAX_CHARACTERS
  );

  for (const line of referenceLines) {
    commands.push(textCommand(line, LEFT_MARGIN, cursorY, 9));
    cursorY -= BODY_LINE_HEIGHT;
  }

  commands.push(
    textCommand(`Generated: ${input.generatedAt}`, LEFT_MARGIN, cursorY, 9)
  );
  cursorY -= BODY_LINE_HEIGHT + 12;
  commands.push(horizontalRule(cursorY));

  return {
    commands,
    contentStartY: cursorY - 28
  };
}

function createPageFooter(pageNumber: number): string[] {
  return [
    horizontalRule(FOOTER_RULE_Y, "0.86 0.89 0.88"),
    textCommand(
      "Courtify-Badminton | Brunei Darussalam | Currency: BND",
      LEFT_MARGIN,
      FOOTER_TEXT_Y,
      8,
      "F1",
      "0.35 0.4 0.42"
    ),
    textCommand(
      `Page ${pageNumber}`,
      PAGE_WIDTH - RIGHT_MARGIN - 38,
      FOOTER_TEXT_Y,
      8,
      "F1",
      "0.35 0.4 0.42"
    )
  ];
}

function measureRowHeight(value: string): number {
  const lineCount = wrapText(value, VALUE_MAX_CHARACTERS).length;
  return lineCount * BODY_LINE_HEIGHT + ROW_GAP;
}

function measureSectionHeadingHeight(): number {
  return 13 + 12 + 18;
}

function createContentPages(input: PdfDocumentInput): string[] {
  const pages: string[] = [];
  let pageNumber = 1;
  let header = createPageHeader(input, pageNumber);
  let commands = [...header.commands];
  let cursorY = header.contentStartY;

  const finishPage = () => {
    commands.push(...createPageFooter(pageNumber));
    pages.push(commands.join("\n"));
  };

  const startNextPage = () => {
    finishPage();
    pageNumber += 1;
    header = createPageHeader(input, pageNumber);
    commands = [...header.commands];
    cursorY = header.contentStartY;
  };

  const ensureSpace = (height: number) => {
    if (cursorY - height >= CONTENT_BOTTOM_Y) {
      return;
    }
    startNextPage();
  };

  for (const section of input.sections) {
    const headingHeight = measureSectionHeadingHeight();
    ensureSpace(headingHeight + BODY_LINE_HEIGHT + ROW_GAP);

    commands.push(
      textCommand(
        section.heading,
        LEFT_MARGIN,
        cursorY,
        13,
        "F2",
        "0.04 0.45 0.31"
      )
    );
    cursorY -= 13 + 12;
    commands.push(horizontalRule(cursorY));
    cursorY -= 18;

    for (const row of section.rows) {
      const valueLines = wrapText(row.value, VALUE_MAX_CHARACTERS);
      const rowHeight = measureRowHeight(row.value);
      ensureSpace(rowHeight);

      commands.push(textCommand(row.label, LEFT_MARGIN, cursorY, 9, "F2"));
      valueLines.forEach((line, index) => {
        commands.push(
          textCommand(
            line,
            VALUE_X,
            cursorY - index * BODY_LINE_HEIGHT,
            9
          )
        );
      });
      cursorY -= rowHeight;
    }

    cursorY -= SECTION_BOTTOM_GAP;
  }

  finishPage();
  return pages;
}

function buildPdf(pageContents: string[]): Buffer {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (const content of pageContents) {
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
        `/Contents ${contentObjectId} 0 R >>`
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`
    );
  }

  objects[1] =
    `<< /Type /Pages /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    const offset = offsets[index] ?? 0;
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}

export function generateCourtifyPdf(input: PdfDocumentInput): Buffer {
  return buildPdf(createContentPages(input));
}
