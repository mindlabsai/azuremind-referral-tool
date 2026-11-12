import {
  classifyReferralAttachment,
  defaultContentTypeForKind,
  isSupportedReferralAttachment,
} from "../attachments";
import { createReferralFromIntake } from "../pipeline";
import type { CreateIntakeReferralResult } from "../types";
import {
  downloadGmailAttachment,
  getAccessTokenForRefresh,
  getGmailMessage,
} from "./client";

/**
 * Fetch a Gmail message + all supported attachments (PDF, JPEG, PNG, DOCX)
 * and create a referral via the intake pipeline.
 * Every supported file is preserved; extraction decides which contain referral info.
 * Live mailbox callers must gate with referralIntakeLiveMailbox() before invoking.
 */
export async function processGmailMessageIntoReferral(args: {
  refreshToken: string;
  messageId: string;
  clinicSlug: string;
  mailboxEmail?: string;
  actor?: string;
}): Promise<CreateIntakeReferralResult> {
  try {
    const accessToken = await getAccessTokenForRefresh(args.refreshToken);
    const message = await getGmailMessage({
      accessToken,
      messageId: args.messageId,
    });

    const supportedParts = message.attachmentParts.filter((part) =>
      isSupportedReferralAttachment({
        filename: part.filename,
        contentType: part.mimeType,
      })
    );

    const documents: Array<{ filename: string; contentType: string; bytes: Buffer }> = [];
    for (const part of supportedParts) {
      const kind = classifyReferralAttachment({
        filename: part.filename,
        contentType: part.mimeType,
      });
      const bytes = await downloadGmailAttachment({
        accessToken,
        messageId: message.id,
        attachmentId: part.attachmentId,
      });
      documents.push({
        filename: part.filename || `referral.${kind || "bin"}`,
        contentType: kind
          ? defaultContentTypeForKind(kind)
          : part.mimeType || "application/octet-stream",
        bytes,
      });
    }

    return createReferralFromIntake({
      clinicSlug: args.clinicSlug,
      source: "gp_email",
      actor: args.actor ?? "gmail",
      email: {
        provider: "gmail",
        providerMessageId: message.id,
        providerThreadId: message.threadId,
        historyId: message.historyId,
        fromAddress: message.fromAddress,
        subject: message.subject,
        receivedAt: message.receivedAt,
        mailboxEmail: args.mailboxEmail,
      },
      documents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message,
      dashboardStatus: "processing_error",
    };
  }
}
