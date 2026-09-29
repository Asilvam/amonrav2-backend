import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "amonra_admin";
const LIFETIME_SECONDS = 8 * 60 * 60;

function signature(payload: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET || "").update(payload).digest("base64url");
}

@Injectable()
export class AdminAuthService {
  passwordMatches(password: string): boolean {
    const expected = process.env.ADMIN_PASSWORD || "";
    const providedHash = createHmac("sha256", "amonra-admin-password").update(password).digest();
    const expectedHash = createHmac("sha256", "amonra-admin-password").update(expected).digest();
    return timingSafeEqual(providedHash, expectedHash);
  }

  createCookie(): string {
    const payload = Buffer.from(
      JSON.stringify({ expiresAt: Math.floor(Date.now() / 1000) + LIFETIME_SECONDS }),
    ).toString("base64url");
    const configuredSameSite = process.env.COOKIE_SAME_SITE || "lax";
    const sameSite = ["lax", "strict", "none"].includes(configuredSameSite)
      ? configuredSameSite
      : "lax";
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return `${COOKIE}=${payload}.${signature(payload)}; Path=/api/admin; HttpOnly; SameSite=${sameSite}; Max-Age=${LIFETIME_SECONDS}${secure}`;
  }

  clearCookie(): string {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const configuredSameSite = process.env.COOKIE_SAME_SITE || "lax";
    const sameSite = ["lax", "strict", "none"].includes(configuredSameSite)
      ? configuredSameSite
      : "lax";
    return `${COOKIE}=; Path=/api/admin; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure}`;
  }

  isAuthenticated(cookieHeader = ""): boolean {
    const item = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
    if (!item) return false;
    const value = item.slice(COOKIE.length + 1);
    const separator = value.lastIndexOf(".");
    if (separator < 1) return false;
    const payload = value.slice(0, separator);
    const received = Buffer.from(value.slice(separator + 1));
    const expected = Buffer.from(signature(payload));
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
    try {
      const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { expiresAt?: number };
      return typeof session.expiresAt === "number" && session.expiresAt > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  }
}
