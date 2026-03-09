import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  checkPasswordStrength,
  escapeHtml,
  checkRateLimit,
  recordLoginAttempt,
  sanitizeEmail,
  validateInputLength,
} from "@/utils/security";

describe("Security Utils", () => {
  describe("hashPassword", () => {
    it("should return salt:hash format", async () => {
      const hash = await hashPassword("test123");
      expect(hash).toContain(":");
      const [salt, hex] = hash.split(":");
      expect(salt.length).toBe(32);
      expect(hex.length).toBe(64);
    });

    it("should produce different hashes for same password (different salts)", async () => {
      const h1 = await hashPassword("test123");
      const h2 = await hashPassword("test123");
      expect(h1).not.toBe(h2);
    });

    it("should produce same hash with same salt", async () => {
      const h1 = await hashPassword("test123", "mysalt");
      const h2 = await hashPassword("test123", "mysalt");
      expect(h1).toBe(h2);
    });
  });

  describe("verifyPassword", () => {
    it("should verify a hashed password", async () => {
      const hash = await hashPassword("mypassword");
      expect(await verifyPassword("mypassword", hash)).toBe(true);
      expect(await verifyPassword("wrongpass", hash)).toBe(false);
    });

    it("should support legacy plain-text passwords", async () => {
      expect(await verifyPassword("admin123", "admin123")).toBe(true);
      expect(await verifyPassword("wrong", "admin123")).toBe(false);
    });
  });

  describe("checkPasswordStrength", () => {
    it("should return score 0 for empty password", () => {
      const result = checkPasswordStrength("");
      expect(result.score).toBe(0);
    });

    it("should return low score for short password", () => {
      const result = checkPasswordStrength("abc");
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return high score for strong password", () => {
      const result = checkPasswordStrength("MyStr0ng!Pass123");
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it("should have correct labels", () => {
      const weak = checkPasswordStrength("a");
      expect(weak.label).toBeDefined();
      expect(weak.color).toContain("bg-");
    });
  });

  describe("escapeHtml", () => {
    it("should escape HTML special chars", () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it("should handle null/undefined", () => {
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
      expect(escapeHtml("")).toBe("");
    });

    it("should escape ampersand and quotes", () => {
      expect(escapeHtml("a & b 'c'")).toBe("a &amp; b &#039;c&#039;");
    });
  });

  describe("sanitizeEmail", () => {
    it("should lowercase and trim", () => {
      expect(sanitizeEmail("  Admin@Test.COM  ")).toBe("admin@test.com");
    });

    it("should limit length to 255", () => {
      const longEmail = "a".repeat(300);
      expect(sanitizeEmail(longEmail).length).toBe(255);
    });
  });

  describe("validateInputLength", () => {
    it("should validate within limit", () => {
      expect(validateInputLength("hello", 10)).toBe(true);
      expect(validateInputLength("hello world!", 5)).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should allow first attempt", () => {
      const result = checkRateLimit("fresh@test.com");
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });

    it("should track failed attempts", () => {
      const email = `ratelimit-${Date.now()}@test.com`;
      recordLoginAttempt(email, false);
      recordLoginAttempt(email, false);
      const result = checkRateLimit(email);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(3);
    });

    it("should lock after max attempts", () => {
      const email = `lockout-${Date.now()}@test.com`;
      for (let i = 0; i < 5; i++) {
        recordLoginAttempt(email, false);
      }
      const result = checkRateLimit(email);
      expect(result.allowed).toBe(false);
      expect(result.remainingAttempts).toBe(0);
      expect(result.lockedUntilMs).toBeGreaterThan(0);
    });

    it("should reset on success", () => {
      const email = `reset-${Date.now()}@test.com`;
      recordLoginAttempt(email, false);
      recordLoginAttempt(email, false);
      recordLoginAttempt(email, true);
      const result = checkRateLimit(email);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });
  });
});
