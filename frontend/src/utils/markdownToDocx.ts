// Convert markdown text to a formatted .docx file
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Packer,
} from 'docx';
import { saveAs } from 'file-saver';

interface ParsedLine {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'paragraph' | 'bullet' | 'numbered' | 'hr' | 'empty';
  text: string;
  level?: number;
}

// Parse inline markdown (bold, italic) into TextRun array
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Match **bold**, *italic*, and plain text
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // ***bold italic***
      runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
    } else if (match[3]) {
      // **bold**
      runs.push(new TextRun({ text: match[3], bold: true }));
    } else if (match[4]) {
      // *italic*
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[5]) {
      // plain text
      runs.push(new TextRun({ text: match[5] }));
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

// Parse a single line to determine its type
function parseLine(line: string): ParsedLine {
  const trimmed = line.trim();

  if (trimmed === '') return { type: 'empty', text: '' };
  if (trimmed === '---' || trimmed === '***' || trimmed === '___') return { type: 'hr', text: '' };
  if (trimmed.startsWith('#### ')) return { type: 'h4', text: trimmed.slice(5) };
  if (trimmed.startsWith('### ')) return { type: 'h3', text: trimmed.slice(4) };
  if (trimmed.startsWith('## ')) return { type: 'h2', text: trimmed.slice(3) };
  if (trimmed.startsWith('# ')) return { type: 'h1', text: trimmed.slice(2) };
  if (/^[-*+]\s/.test(trimmed)) return { type: 'bullet', text: trimmed.replace(/^[-*+]\s+/, '') };
  if (/^\d+\.\s/.test(trimmed)) return { type: 'numbered', text: trimmed.replace(/^\d+\.\s+/, '') };

  return { type: 'paragraph', text: trimmed };
}

// Check if a line is a markdown table row
function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

// Check if a line is a table separator (|---|---|)
function isTableSeparator(line: string): boolean {
  return /^\|[\s-:|]+\|$/.test(line.trim());
}

// Parse a table row into cells
function parseTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

// Build a docx Table from markdown table lines
function buildTable(lines: string[]): Table {
  const dataLines = lines.filter(l => !isTableSeparator(l));
  const headerCells = dataLines.length > 0 ? parseTableCells(dataLines[0]) : [];
  const bodyRows = dataLines.slice(1);

  const tableBorder = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: '999999',
  };
  const borders = {
    top: tableBorder,
    bottom: tableBorder,
    left: tableBorder,
    right: tableBorder,
  };

  const rows: TableRow[] = [];

  // Header row
  if (headerCells.length > 0) {
    rows.push(
      new TableRow({
        tableHeader: true,
        children: headerCells.map(
          cell =>
            new TableCell({
              borders,
              shading: { fill: '2B6CB0' },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cell, bold: true, color: 'FFFFFF', size: 20 })],
                }),
              ],
            }),
        ),
      }),
    );
  }

  // Body rows
  bodyRows.forEach((line, rowIdx) => {
    const cells = parseTableCells(line);
    rows.push(
      new TableRow({
        children: cells.map(
          cell =>
            new TableCell({
              borders,
              shading: rowIdx % 2 === 1 ? { fill: 'F7FAFC' } : undefined,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cell, size: 20 })],
                }),
              ],
            }),
        ),
      }),
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

// Convert full markdown string to docx Document
function markdownToDocument(markdown: string): Document {
  const lines = markdown.split('\n');
  const children: (Paragraph | Table)[] = [];

  let i = 0;
  while (i < lines.length) {
    // Check for table block
    if (isTableRow(lines[i])) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      children.push(buildTable(tableLines));
      children.push(new Paragraph({ text: '' })); // spacing after table
      continue;
    }

    const parsed = parseLine(lines[i]);
    i++;

    switch (parsed.type) {
      case 'h1':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: parseInlineFormatting(parsed.text),
            spacing: { before: 240, after: 120 },
          }),
        );
        break;

      case 'h2':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: parseInlineFormatting(parsed.text),
            spacing: { before: 200, after: 100 },
          }),
        );
        break;

      case 'h3':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: parseInlineFormatting(parsed.text),
            spacing: { before: 160, after: 80 },
          }),
        );
        break;

      case 'h4':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_4,
            children: parseInlineFormatting(parsed.text),
            spacing: { before: 120, after: 60 },
          }),
        );
        break;

      case 'bullet':
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: parseInlineFormatting(parsed.text),
            spacing: { before: 40, after: 40 },
          }),
        );
        break;

      case 'numbered':
        children.push(
          new Paragraph({
            numbering: { reference: 'default-numbering', level: 0 },
            children: parseInlineFormatting(parsed.text),
            spacing: { before: 40, after: 40 },
          }),
        );
        break;

      case 'hr':
        children.push(
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
            spacing: { before: 120, after: 120 },
          }),
        );
        break;

      case 'empty':
        // skip consecutive empties
        break;

      case 'paragraph':
        children.push(
          new Paragraph({
            children: parseInlineFormatting(parsed.text),
            spacing: { before: 60, after: 60 },
          }),
        );
        break;
    }
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
        heading1: {
          run: { font: 'Calibri', size: 32, bold: true, color: '1A365D' },
        },
        heading2: {
          run: { font: 'Calibri', size: 28, bold: true, color: '2B6CB0' },
        },
        heading3: {
          run: { font: 'Calibri', size: 24, bold: true, color: '2C5282' },
        },
        heading4: {
          run: { font: 'Calibri', size: 22, bold: true, color: '2D3748' },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal' as const,
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });
}

// Export: generate and save a .docx from markdown
export async function downloadAsDocx(markdown: string, filename: string): Promise<void> {
  const doc = markdownToDocument(markdown);
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
}
