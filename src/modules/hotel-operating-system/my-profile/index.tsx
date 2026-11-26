"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KeyRound, LayoutDashboard, Mail, Settings, ShieldCheck, User } from "lucide-react";

interface MyProfileProps {
  initialUser: {
    name: string;
    email: string;
    userId: string;
  };
}

interface ProfilePermissions {
  isAdmin: boolean;
  permissions: string[];
}

export default function MyProfileModule({ initialUser }: MyProfileProps) {
  const [profile, setProfile] = useState<ProfilePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadPermissions() {
      try {
        const res = await fetch("/api/hos/app-sidebar/user-profile");
        if (!res.ok) return;
        const json = await res.json();
        if (active && json?.ok) {
          setProfile({
            isAdmin: Boolean(json.isAdmin),
            permissions: Array.isArray(json.permissions) ? json.permissions : [],
          });
        }
      } catch {
        // Fallback cleanly to JWT info only
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPermissions();
    return () => {
      active = false;
    };
  }, []);

  const initials =
    initialUser.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <User className="h-7 w-7 text-primary shrink-0" />
            My Profile
          </h1>
          <p className="text-sm text-muted-foreground">
            View your active staff account details, assigned HOS access permissions, and account shortcuts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/hos/settings">
              <Settings className="h-4 w-4" />
              Appearance
            </Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/hos/change-password">
              <KeyRound className="h-4 w-4" />
              Change Password
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account Identity Card */}
        <Card className="md:col-span-2 rounded-2xl shadow-sm border-t-4 border-t-primary">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-lg font-extrabold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl truncate">{initialUser.name}</CardTitle>
                <CardDescription className="flex items-center gap-1.5 mt-1 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {initialUser.email || "No email on session"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2 border-t text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl bg-muted/40 border p-3.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Staff User ID
                </span>
                <p className="font-bold text-foreground mt-1">{initialUser.userId || "—"}</p>
              </div>

              <div className="rounded-xl bg-muted/40 border p-3.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Access Level
                </span>
                <div className="mt-1.5">
                  {loading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : profile?.isAdmin ? (
                    <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                      Administrator
                    </Badge>
                  ) : (
                    <Badge variant="secondary">HOS Staff</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Assigned Module Slugs
              </div>
              {loading ? (
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-28" />
                </div>
              ) : profile?.isAdmin ? (
                <p className="text-xs text-muted-foreground">
                  Full subsystem &amp; module access granted (`*`).
                </p>
              ) : profile && profile.permissions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {profile.permissions.map((perm) => (
                    <Badge key={perm} variant="outline" className="text-xs font-medium">
                      {perm}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No explicit module slugs returned for this session.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Quick Navigation</CardTitle>
            <CardDescription className="text-xs">
              Jump directly to common staff operations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Button variant="outline" asChild className="w-full justify-start gap-2">
              <Link href="/hos/front-desk-dashboard">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                Front Desk Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full justify-start gap-2">
              <Link href="/hos/change-password">
                <KeyRound className="h-4 w-4 text-amber-600" />
                Update Password
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full justify-start gap-2">
              <Link href="/hos/settings">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Display Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
