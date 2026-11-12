export type GmailAttachmentPart = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size?: number;
};

export type ParsedGmailMessage = {
  id: string;
  threadId: string;
  historyId?: string;
  internalDate?: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  attachmentParts: GmailAttachmentPart[];
};

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
};

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  const found = (headers ?? []).find((h) => (h.name || "").toLowerCase() === name.toLowerCase());
  return found?.value?.trim() || "";
}

function walkParts(part: GmailPart | undefined, out: GmailAttachmentPart[]) {
  if (!part) return;
  const filename = part.filename?.trim();
  const attachmentId = part.body?.attachmentId;
  if (filename && attachmentId) {
    out.push({
      filename,
      mimeType: part.mimeType || "application/octet-stream",
      attachmentId,
      size: part.body?.size,
    });
  }
  for (const child of part.parts ?? []) walkParts(child, out);
}

/** Parse a Gmail users.messages.get payload (format=full). */
export function parseGmailMessagePayload(message: {
  id?: string;
  threadId?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
}): ParsedGmailMessage {
  const id = message.id?.trim();
  if (!id) throw new Error("Gmail message missing id.");
  const headers = message.payload?.headers ?? [];
  const attachmentParts: GmailAttachmentPart[] = [];
  walkParts(message.payload, attachmentParts);
  const internalMs = Number(message.internalDate || "");
  const receivedAt = Number.isFinite(internalMs)
    ? new Date(internalMs).toISOString()
    : new Date().toISOString();
  return {
    id,
    threadId: message.threadId?.trim() || id,
    historyId: message.historyId,
    internalDate: message.internalDate,
    fromAddress: headerValue(headers, "From"),
    subject: headerValue(headers, "Subject"),
    receivedAt,
    attachmentParts,
  };
}

export function decodeGmailBase64Url(data: string): Buffer {
  const normalised = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalised, "base64");
}
