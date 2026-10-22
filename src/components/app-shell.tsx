import { useState, type ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  ReceiptText,
  Landmark,
  PieChart,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { bootstrapQueryOptions } from "@/lib/finance-queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/investments", label: "Investments", icon: TrendingUp },
  { to: "/income", label: "Income", icon: Wallet },
  { to: "/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/loans", label: "Loans & EMI", icon: Landmark },
  { to: "/reports", label: "Reports", icon: PieChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
        A
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">Artha</span>
    </div>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label="Toggle dark mode"
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.classList.toggle("dark", next === "dark");
        try {
          localStorage.setItem("artha-theme", next);
        } catch {
          // storage unavailable; theme still applies for this session
        }
        setTheme(next);
      }}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: bootstrap } = useQuery({
    ...bootstrapQueryOptions(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const profile = bootstrap?.profile;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b px-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t p-4">
          <p className="truncate text-sm font-medium">
            {profile?.full_name || profile?.email || "Signed in"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/90 px-4 backdrop-blur md:pl-64">
        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <div className="flex h-14 items-center border-b px-5">
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </div>
              <nav className="space-y-1 p-3">
                <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
          <Logo />
        </div>
        <div className="hidden font-display text-sm font-medium text-muted-foreground md:block">
          {NAV_ITEMS.find((i) => pathname === i.to || pathname.startsWith(i.to + "/"))?.label}
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Account menu"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials(profile?.full_name ?? null, profile?.email ?? "?")}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                {profile?.full_name || "Account"}
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {profile?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.navigate({ to: "/settings" })}>
                <Settings className="size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}

export function ShellSkeleton() {
  return <Skeleton className="h-8 w-40" />;
}
