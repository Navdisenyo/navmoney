import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { bootstrapQueryOptions, type Settings } from "@/lib/finance-queries";
import { updateProfile, updateSettings } from "@/lib/finance.functions";
import { formatCurrency } from "@/lib/finance-calc";
import {
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  WEEK_START_OPTIONS,
} from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageHeader, PageSkeleton, RouteError } from "@/components/finance-ui";

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(bootstrapQueryOptions()),
  head: () => ({
    meta: [
      { title: "Settings — Artha" },
      { name: "description", content: "Your profile, currency, date format and monthly budget." },
      { property: "og:title", content: "Settings — Artha" },
      { property: "og:description", content: "Profile, currency and budget settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  notFoundComponent: () => <PageSkeleton />,
  component: SettingsPage,
});

function SettingsPage() {
  const { data: boot } = useSuspenseQuery(bootstrapQueryOptions());
  const queryClient = useQueryClient();
  const updateProfileFn = useServerFn(updateProfile);
  const updateSettingsFn = useServerFn(updateSettings);

  const [fullName, setFullName] = useState(boot.profile.full_name ?? "");
  const [currency, setCurrency] = useState(boot.settings.currency);
  const [dateFormat, setDateFormat] = useState(boot.settings.date_format);
  const [weekStart, setWeekStart] = useState(boot.settings.week_start);
  const [budget, setBudget] = useState(
    boot.settings.monthly_budget != null ? String(boot.settings.monthly_budget) : "",
  );

  useEffect(() => {
    setFullName(boot.profile.full_name ?? "");
    setCurrency(boot.settings.currency);
    setDateFormat(boot.settings.date_format);
    setWeekStart(boot.settings.week_start);
    setBudget(boot.settings.monthly_budget != null ? String(boot.settings.monthly_budget) : "");
  }, [boot]);

  const saveProfile = useMutation({
    mutationFn: () => updateProfileFn({ data: { full_name: fullName } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      updateSettingsFn({
        data: {
          currency,
          date_format: dateFormat,
          week_start: weekStart,
          monthly_budget: budget.trim() === "" ? null : Number(budget),
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bootstrap"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
      toast.success("Preferences saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = boot.settings as Settings;

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Settings" description="Profile and formatting preferences." />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Full name</Label>
            <Input id="settings-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={boot.profile.email} disabled />
            <p className="text-xs text-muted-foreground">Your email can't be changed here.</p>
          </div>
          <Button disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
            Save profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger aria-label="Currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date format</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger aria-label="Date format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATE_FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Week starts on</Label>
              <Select value={weekStart} onValueChange={setWeekStart}>
                <SelectTrigger aria-label="Week start"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEK_START_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-budget">Monthly budget</Label>
              <Input
                id="settings-budget"
                type="number"
                min="0"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Preview: {formatCurrency(1234567.5, currency)} · Indian grouping and compact
            lakh/crore summaries apply to INR.
          </p>
          <Button disabled={saveSettings.isPending} onClick={() => saveSettings.mutate()}>
            Save preferences
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Signed in with {boot.profile.email}. Week start ({s.week_start}) and date format
        apply across every page.
      </p>
    </div>
  );
}
