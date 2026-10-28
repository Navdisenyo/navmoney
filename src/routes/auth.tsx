import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Artha" },
      { name: "description", content: "Sign in to Artha to track your money." },
      { property: "og:title", content: "Sign in — Artha" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const card = "w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm";

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // Already signed in? Straight to the dashboard.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) navigate({ to: "/dashboard", replace: true, search: {} });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate({ to: "/dashboard", replace: true, search: {} });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        // Email confirmation is on: the user must click the link in their inbox.
        setAwaitingConfirmation(true);
        return;
      }
      navigate({ to: "/dashboard", replace: true, search: {} });
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: "google" | "lovable") {
    setOauthBusy(provider);
    try {
      if (provider === "google") {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        return;
      }

      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Could not start sign-in");
        return;
      }
      if (result.redirected) return; // browser is heading to the provider
      navigate({ to: "/dashboard", replace: true, search: {} });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate sign-in");
    } finally {
      setOauthBusy(null);
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className={card + " text-center"}>
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-primary">
            <MailCheck className="size-6" />
          </span>
          <h1 className="mt-4 font-display text-xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account, then sign in.
          </p>
          <Button className="mt-6 w-full" variant="outline" asChild>
            <Link to="/auth">Back to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            A
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Artha</span>
        </Link>

        <div className={card}>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />} Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />} Create account
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  We'll email you a confirmation link to activate your account.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              disabled={oauthBusy !== null}
              onClick={() => handleOAuth("google")}
            >
              {oauthBusy === "google" && <Loader2 className="size-4 animate-spin" />}
              Google
            </Button>
            <Button
              variant="outline"
              disabled={oauthBusy !== null}
              onClick={() => handleOAuth("lovable")}
            >
              {oauthBusy === "lovable" && <Loader2 className="size-4 animate-spin" />}
              Lovable
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
