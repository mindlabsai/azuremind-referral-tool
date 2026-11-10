import { gmailConfig } from "../config";
import { refreshGmailAccessToken } from "./oauth";
import { decodeGmailBase64Url, parseGmailMessagePayload, type ParsedGmailMessage } from "./parse-message";

async function gmailFetch(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const err = typeof json.error === "object" && json.error && "message" in json.error
      ? String((json.error as { message?: string }).message)
      : `Gmail API ${response.status}`;
    throw new Error(err);
  }
  return json;
}

export async function getAccessTokenForRefresh(refreshToken: string): Promise<string> {
  return refreshGmailAccessToken(refreshToken);
}

export async function listHistoryMessageIds(args: {
  accessToken: string;
  startHistoryId: string;
}): Promise<{ messageIds: string[]; latestHistoryId?: string }> {
  const params = new URLSearchParams({
    startHistoryId: args.startHistoryId,
    historyTypes: "messageAdded",
  });
  const json = (await gmailFetch(
    args.accessToken,
    `users/me/history?${params.toString()}`
  )) as {
    history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
    historyId?: string;
  };
  const ids = new Set<string>();
  for (const row of json.history ?? []) {
    for (const added of row.messagesAdded ?? []) {
      const id = added.message?.id?.trim();
      if (id) ids.add(id);
    }
  }
  return { messageIds: [...ids], latestHistoryId: json.historyId };
}

export async function getGmailMessage(args: {
  accessToken: string;
  messageId: string;
}): Promise<ParsedGmailMessage> {
  const json = await gmailFetch(
    args.accessToken,
    `users/me/messages/${encodeURIComponent(args.messageId)}?format=full`
  );
  return parseGmailMessagePayload(json as Parameters<typeof parseGmailMessagePayload>[0]);
}

export async function downloadGmailAttachment(args: {
  accessToken: string;
  messageId: string;
  attachmentId: string;
}): Promise<Buffer> {
  const json = (await gmailFetch(
    args.accessToken,
    `users/me/messages/${encodeURIComponent(args.messageId)}/attachments/${encodeURIComponent(args.attachmentId)}`
  )) as { data?: string };
  if (!json.data) throw new Error("Gmail attachment payload missing.");
  return decodeGmailBase64Url(json.data);
}

export async function startGmailWatch(args: {
  accessToken: string;
  topicName: string;
}): Promise<{ historyId: string; expiration: string }> {
  const cfg = gmailConfig();
  const topic = args.topicName || cfg.pubsubTopic;
  if (!topic) throw new Error("GOOGLE_PUBSUB_TOPIC is required to start a Gmail watch.");
  const json = (await gmailFetch(args.accessToken, "users/me/watch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topicName: topic,
      labelIds: ["INBOX"],
    }),
  })) as { historyId?: string; expiration?: string };
  if (!json.historyId) throw new Error("Gmail watch did not return historyId.");
  return {
    historyId: String(json.historyId),
    expiration: json.expiration ? new Date(Number(json.expiration)).toISOString() : "",
  };
}

/** Pull recent inbox messages — used for missed-notification recovery. */
export async function listRecentInboxMessageIds(args: {
  accessToken: string;
  maxResults?: number;
}): Promise<string[]> {
  const params = new URLSearchParams({
    labelIds: "INBOX",
    maxResults: String(args.maxResults ?? 25),
  });
  const json = (await gmailFetch(
    args.accessToken,
    `users/me/messages?${params.toString()}`
  )) as { messages?: Array<{ id?: string }> };
  return (json.messages ?? []).map((m) => m.id?.trim()).filter((id): id is string => Boolean(id));
}
