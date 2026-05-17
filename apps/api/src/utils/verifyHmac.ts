import crypto from "crypto";

interface VerifyHmacParams {
  rawBody: string;
  signature: string;
  secret: string;
}

export function verifyHmacSha256Signature({ rawBody, signature, secret }: VerifyHmacParams): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody, "utf8");
  const digest = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}