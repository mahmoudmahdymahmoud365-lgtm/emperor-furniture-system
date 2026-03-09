import { describe, it, expect } from "vitest";
import { nextId } from "@/data/store.core";
import { canDo, DEFAULT_PERMISSIONS } from "@/data/types";

describe("Store Core", () => {
  describe("nextId", () => {
    it("should generate sequential IDs", () => {
      const list = [{ id: "C001" }, { id: "C003" }];
      expect(nextId("C", list)).toBe("C004");
    });

    it("should handle empty list", () => {
      expect(nextId("P", [])).toBe("P001");
    });

    it("should handle invoice prefix", () => {
      const list = [{ id: "INV-001" }, { id: "INV-005" }];
      expect(nextId("INV-", list)).toBe("INV-006");
    });
  });
});

describe("Permissions", () => {
  describe("canDo", () => {
    it("should return true for boolean true", () => {
      expect(canDo(true, "view")).toBe(true);
      expect(canDo(true, "delete")).toBe(true);
    });

    it("should return false for boolean false", () => {
      expect(canDo(false, "view")).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(canDo(undefined, "view")).toBe(false);
    });

    it("should check specific operations", () => {
      const perm = { view: true, create: true, edit: false, delete: false };
      expect(canDo(perm, "view")).toBe(true);
      expect(canDo(perm, "create")).toBe(true);
      expect(canDo(perm, "edit")).toBe(false);
      expect(canDo(perm, "delete")).toBe(false);
    });
  });

  describe("DEFAULT_PERMISSIONS", () => {
    it("admin should have full access", () => {
      const admin = DEFAULT_PERMISSIONS.admin;
      expect(admin.dashboard).toBe(true);
      expect(admin.settings).toBe(true);
      expect(admin.users).toBe(true);
      expect(canDo(admin.customers, "delete")).toBe(true);
    });

    it("sales should have limited access", () => {
      const sales = DEFAULT_PERMISSIONS.sales;
      expect(sales.settings).toBe(false);
      expect(sales.users).toBe(false);
      expect(canDo(sales.customers, "view")).toBe(true);
      expect(canDo(sales.customers, "delete")).toBe(false);
    });

    it("accountant should have mid-level access", () => {
      const acc = DEFAULT_PERMISSIONS.accountant;
      expect(acc.reports).toBe(true);
      expect(acc.users).toBe(false);
      expect(canDo(acc.invoices, "view")).toBe(true);
      expect(canDo(acc.invoices, "delete")).toBe(false);
    });
  });
});
