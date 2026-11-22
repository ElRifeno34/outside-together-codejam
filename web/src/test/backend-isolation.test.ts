import { describe, expect, it } from "vitest";
import { backendMode, supabase } from "@/lib/supabase";

// Vite loads web/.env.local in every mode, including tests. vitest.config.ts blanks the
// Supabase variables so the suite can never reach the hosted project, even on a machine
// that has a real .env.local. Tests that need a backend inject a fake client instead.
describe("test isolation", () => {
  it("never connects the test suite to a real Supabase project", () => {
    expect(import.meta.env.VITE_SUPABASE_URL ?? "").toBe("");
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").toBe("");
    expect(supabase).toBeNull();
    expect(backendMode).toBe("unconfigured");
  });
});
