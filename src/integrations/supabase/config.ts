type Environment = Record<string, string | undefined>;

export function resolveSupabaseConfig(build: Environment, runtime: Environment = {}) {
  const url = runtime.SUPABASE_URL || runtime.VITE_SUPABASE_URL || build.VITE_SUPABASE_URL;
  const publishableKey =
    runtime.SUPABASE_PUBLISHABLE_KEY ||
    runtime.VITE_SUPABASE_PUBLISHABLE_KEY ||
    build.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    const missing = [
      ...(!url ? ["SUPABASE_URL / VITE_SUPABASE_URL"] : []),
      ...(!publishableKey ? ["SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(", ")}. Configure the matching Supabase project URL and publishable key in Netlify for builds and Functions, then redeploy.`,
    );
  }

  return { url, publishableKey };
}

export function getSupabaseConfig() {
  return resolveSupabaseConfig(
    {
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    typeof window === "undefined" && typeof process !== "undefined" ? process.env : {},
  );
}
