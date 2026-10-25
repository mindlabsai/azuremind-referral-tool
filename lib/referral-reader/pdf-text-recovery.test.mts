import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { describe, it } from "node:test";
import { applyMobileEvidence, settleParentMobile } from "./mobile-evidence.ts";
import { recoverReferralPdfText } from "./pdf-text-recovery.ts";

const OFF_PAGE_LINE =
  "Referral. Patient Navcheck Sample. Date of birth 14 June 2016. Parent Morgan Sample. Mobile 0499000111. Email navcheck.parent@example.com. Referred for an ADHD assessment. Referrer Dr Pat Example, GP.";

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(contents: Array<Buffer | { stream: Buffer; filter?: "FlateDecode" }>): Buffer {
  const pages = contents.map((entry) => (Buffer.isBuffer(entry) ? { stream: entry } : entry));
  const objects: Buffer[] = [];
  const push = (body: string | Buffer) => {
    objects.push(typeof body === "string" ? Buffer.from(body) : body);
  };
  const pageCount = pages.length;
  const fontId = 3;
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const contentIds = pages.map((_, index) => 5 + index * 2);
  push(`<< /Type /Catalog /Pages 2 0 R >>`);
  push(
    `<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`
  );
  push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
  pages.forEach((page, index) => {
    const stream = page.filter === "FlateDecode" ? deflateSync(page.stream) : page.stream;
    const filter = page.filter ? "/Filter /FlateDecode " : "";
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[index]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    );
    push(
      Buffer.concat([
        Buffer.from(`<< ${filter}/Length ${stream.length} >>\nstream\n`),
        stream,
        Buffer.from("\nendstream"),
      ])
    );
  });

  const out: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.concat(out).length);
    out.push(Buffer.from(`${i + 1} 0 obj\n`));
    out.push(objects[i]!);
    out.push(Buffer.from("\nendobj\n"));
  }
  const body = Buffer.concat(out);
  const xref = body.length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) table += `${String(offset).padStart(10, "0")} 00000 n \n`;
  table += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.concat([body, Buffer.from(table)]);
}

function textStream(lines: string[]): Buffer {
  const ops = ["BT /F1 12 Tf", "50 740 Td"];
  lines.forEach((line, index) => {
    if (index > 0) ops.push("0 -18 Td");
    ops.push(`(${pdfEscape(line)}) Tj`);
  });
  ops.push("ET");
  return Buffer.from(ops.join("\n"));
}

describe("pdf text recovery", () => {
  it("records the off-page failure, then restores the content stream", async () => {
    const stream = Buffer.from(`BT /F1 12 Tf 50 740 Td (${pdfEscape(OFF_PAGE_LINE)}) Tj ET`);
    assert.match(stream.toString("latin1"), /0499000111/);
    const pdf = buildPdf([stream]);
    assert.match(pdf.toString("latin1"), /0499000111/);

    const result = await recoverReferralPdfText(pdf);
    assert.match(result.visibleText, /04990001/);
    assert.doesNotMatch(result.visibleText, /0499000111/);
    assert.doesNotMatch(result.visibleText, /navcheck\.parent@example\.com/);
    assert.doesNotMatch(result.visibleText, /ADHD assessment/);
    assert.doesNotMatch(result.visibleText, /Dr Pat Example/);
    assert.equal(result.offPage, true);
    assert.match(result.text, /0499000111/);
    assert.match(result.text, /navcheck\.parent@example\.com/);
    assert.match(result.text, /ADHD assessment/);
    assert.match(result.text, /Referrer Dr Pat Example, GP/);
    assert.doesNotMatch(result.text, /04990001111/);
  });

  it("restores the same off-page line from a FlateDecode stream", async () => {
    const stream = Buffer.from(`BT /F1 12 Tf 50 740 Td (${pdfEscape(OFF_PAGE_LINE)}) Tj ET`);
    const pdf = buildPdf([{ stream, filter: "FlateDecode" }]);
    assert.equal(pdf.includes(Buffer.from("0499000111")), false);
    const result = await recoverReferralPdfText(pdf);
    assert.equal(result.offPage, true);
    assert.match(result.text, /0499000111/);
    assert.match(result.text, /navcheck\.parent@example\.com/);
  });

  it("keeps a normal on-page referral unchanged", async () => {
    const pdf = buildPdf([
      textStream([
        "Referral for Rowan Sample.",
        "Parent mobile 0499000111.",
        "Parent email rowan.parent@example.com",
        "ADHD assessment.",
        "Dr Pat Example",
      ]),
    ]);
    const result = await recoverReferralPdfText(pdf);
    assert.equal(result.offPage, false);
    assert.match(result.visibleText, /0499000111/);
    assert.match(result.text, /0499000111/);
    assert.match(result.text, /rowan\.parent@example\.com/);
    assert.match(result.text, /ADHD assessment/);
    assert.equal(result.text.includes("0499000111"), result.visibleText.includes("0499000111"));
  });

  it("does not lengthen a mobile that is short in the source", async () => {
    const pdf = buildPdf([textStream(["Parent mobile 04990001."])]);
    const result = await recoverReferralPdfText(pdf);
    assert.equal(result.offPage, false);
    assert.match(result.text, /04990001/);
    assert.doesNotMatch(result.text, /0499000111/);
    const settled = settleParentMobile("04990001");
    assert.equal(settled.mobile, "");
    assert.match(settled.warning || "", /incomplete \(04990001\)/);
    assert.equal(applyMobileEvidence("04990001", undefined).mobile, "");
  });

  it("uses a complete number from the letter when the model value is only a prefix", () => {
    assert.equal(applyMobileEvidence("04990001", "0499000111").mobile, "0499000111");
    assert.equal(applyMobileEvidence("0499000111", "0499000111").mobile, "0499000111");
    assert.equal(settleParentMobile("0433 955 539").mobile, "0433955539");
  });

  it("keeps a missing assessment type and a missing referrer missing", async () => {
    const pdf = buildPdf([
      textStream(["Referral for Rowan Sample.", "Parent mobile 0499000111.", "Please review general progress."]),
    ]);
    const result = await recoverReferralPdfText(pdf);
    assert.doesNotMatch(result.text, /\bADHD\b|\bASD\b|\bSLD\b|Dr /);
    assert.match(result.text, /0499000111/);
  });

  it("reads every page of a multi-page PDF", async () => {
    const pdf = buildPdf([
      textStream(["Child Rowan Sample."]),
      textStream(["Parent mobile 0499000111.", "Parent email rowan.parent@example.com"]),
    ]);
    const result = await recoverReferralPdfText(pdf);
    assert.match(result.text, /Rowan Sample/);
    assert.match(result.text, /0499000111/);
    assert.match(result.text, /rowan\.parent@example\.com/);
    assert.equal(result.offPage, false);
  });

  it("does not invent text for an image-only page", async () => {
    const pdf = buildPdf([Buffer.from("50 50 100 100 re f")]);
    const result = await recoverReferralPdfText(pdf);
    assert.equal(result.offPage, false);
    assert.equal(result.text.replace(/\s/g, ""), "");
  });

  it("returns empty text for a malformed PDF", async () => {
    const result = await recoverReferralPdfText(Buffer.from("this is not a pdf"));
    assert.equal(result.text, "");
    assert.equal(result.offPage, false);
  });
});
