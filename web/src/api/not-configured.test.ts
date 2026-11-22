import { expect, it } from "vitest";
import * as api from "./index";
import { isNotConfiguredError } from "@/lib/supabase";

// vitest.config.ts blanks the Supabase variables, so the real module has no client here.
it("refuses every call with a not-configured error instead of showing fake data", async () => {
  for (const call of [
    () => api.getBoard(),
    () => api.getActivity("x"),
    () => api.getActivityTypes(),
    () => api.joinActivity("x"),
    () => api.signInWithGoogle("http://localhost:8080/"),
  ]) {
    const error = await call().catch((e: unknown) => e);
    expect(isNotConfiguredError(error)).toBe(true);
  }
});
