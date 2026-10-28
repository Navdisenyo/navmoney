// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";
import { resolveSupabaseConfig } from "./src/integrations/supabase/config";

// Resolve the two public settings during the build, when Netlify supplies them.
// Never expose the full server environment (in particular, service-role keys).
function supabasePublicConfig(): Plugin {
  return {
    name: "supabase-public-config",
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      const { url, publishableKey } = resolveSupabaseConfig({
        VITE_SUPABASE_URL: env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"],
        VITE_SUPABASE_PUBLISHABLE_KEY:
          env["VITE_SUPABASE_PUBLISHABLE_KEY"] || env["SUPABASE_PUBLISHABLE_KEY"],
      });
      return {
        define: {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
          "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publishableKey),
        },
      };
    },
  };
}

export default defineConfig({
  vite: { plugins: [supabasePublicConfig()] },
  // Match Netlify's publish directory instead of the preset's dist default.
  nitro: { output: { publicDir: "dist/client" } },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
