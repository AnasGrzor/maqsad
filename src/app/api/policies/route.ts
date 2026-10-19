import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import messages from "../../../../messages/en.json";

// The rules and policies page as a PDF, built from the same English messages the page renders, so the two
// can't drift apart. English only: pdf-lib's standard fonts can't shape Urdu, so the Urdu page prints instead.

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = 56;
const WIDTH = PAGE.width - MARGIN * 2;
const INK = rgb(0.1, 0.12, 0.2);
const SOFT = rgb(0.38, 0.4, 0.47);

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function build() {
  const p = messages.policies;
  const doc = await PDFDocument.create();
  doc.setTitle(`Iraada · ${p.title}`);
  doc.setAuthor("Iraada");
  const [regular, bold] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const ensure = (height: number) => {
    if (y - height >= MARGIN) return;
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };
  const write = (text: string, { font = regular, size = 11, color = INK, indent = 0, gap = 4 } = {}) => {
    const leading = size * 1.4;
    for (const line of wrap(text, font, size, WIDTH - indent)) {
      ensure(leading);
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font, color });
      y -= leading;
    }
    y -= gap;
  };

  write("IRAADA", { font: bold, size: 10, color: SOFT, gap: 6 });
  write(p.title, { font: bold, size: 24, gap: 8 });
  write(p.intro, { color: SOFT, gap: 4 });
  write(p.updated, { size: 9.5, color: SOFT, gap: 18 });

  for (const s of p.sections) {
    ensure(60);
    write(s.title, { font: bold, size: 15, gap: 6 });
    for (const text of s.items) {
      ensure(16);
      page.drawText("-", { x: MARGIN + 2, y: y - 11, size: 11, font: bold, color: SOFT });
      write(text, { indent: 14, gap: 5 });
    }
    y -= 12;
  }

  return doc.save();
}

export async function GET() {
  const bytes = await build();
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="iraada-rules-and-policies.pdf"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
