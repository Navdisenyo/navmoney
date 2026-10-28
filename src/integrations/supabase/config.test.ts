import { describe, expect, it } from "vitest";
import { resolveSupabaseConfig } from "./config";

describe("Supabase configuration", () => {
  const build = {
    VITE_SUPABASE_URL: "https://example.invalid",
    VITE_SUPABASE_PUBLISHABLE_KEY: "test-placeholder",
  };

  it("supports build configuration when Functions have no runtime overrides", () => {
    expect(resolveSupabaseConfig(build)).toEqual({
      url: build.VITE_SUPABASE_URL,
      publishableKey: build.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
  });

  it("supports server and Vite variable names at runtime", () => {
    expect(resolveSupabaseConfig({}, build)).toEqual(resolveSupabaseConfig(build));
    expect(
      resolveSupabaseConfig(
        {},
        {
          SUPABASE_URL: build.VITE_SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY: build.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      ),
    ).toEqual(resolveSupabaseConfig(build));
  });

  it("prefers runtime settings on the server", () => {
    expect(resolveSupabaseConfig(build, { SUPABASE_URL: "https://runtime.invalid" }).url).toBe(
      "https://runtime.invalid",
    );
  });

  it("reports missing names without including configured values", () => {
    expect(() => resolveSupabaseConfig({})).toThrow("Netlify");
    expect(() => resolveSupabaseConfig({ VITE_SUPABASE_URL: build.VITE_SUPABASE_URL })).toThrow(
      "SUPABASE_PUBLISHABLE_KEY",
    );
    expect(() => resolveSupabaseConfig({ VITE_SUPABASE_URL: build.VITE_SUPABASE_URL })).not.toThrow(
      build.VITE_SUPABASE_URL,
    );
  });
});
