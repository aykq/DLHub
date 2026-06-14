import { createHmac } from "crypto";

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret-change-in-prod";
}

export function createDownloadToken(downloadId: string, expiresAt: Date): string {
  const exp = expiresAt.getTime().toString();
  const sig = createHmac("sha256", getSecret())
    .update(`dl:${downloadId}:${exp}`)
    .digest("hex");
  return Buffer.from(JSON.stringify({ id: downloadId, exp, sig })).toString("base64url");
}

export function verifyDownloadToken(token: string): { downloadId: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
    const { id, exp, sig } = decoded as { id?: string; exp?: string; sig?: string };
    if (!id || !exp || !sig) return null;

    const expected = createHmac("sha256", getSecret())
      .update(`dl:${id}:${exp}`)
      .digest("hex");

    if (sig !== expected) return null;
    if (Date.now() > Number(exp)) return null;

    return { downloadId: id };
  } catch {
    return null;
  }
}
