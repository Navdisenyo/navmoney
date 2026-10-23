import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

// Integration-managed gate shape: client-only session check, ssr disabled.
// Children need no auth code; server functions still verify the bearer token
// independently via requireSupabaseAuth.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
