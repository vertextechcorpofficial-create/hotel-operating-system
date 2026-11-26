"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Info, KeyRound, Laptop, ShieldCheck, User } from "lucide-react";

interface LoginActivityProps {
  session: {
    name: string;
    email: string;
    userId: string;
    issuedAt: string | null;
    expiresAt: string | null;
    userAgent: string;
  };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Unavailable";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unavailable";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function LoginActivityModule({ session }: LoginActivityProps) {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldCheck className="h-7 w-7 text-primary shrink-0" />
            Login Activity
          </h1>
          <p className="text-sm text-muted-foreground">
            Inspect your current authenticated HOS session and account security status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/hos/my-profile">
              <User className="h-4 w-4" />
              My Profile
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

      {/* Current Active Session Card */}
      <Card className="rounded-2xl shadow-sm border-t-4 border-t-emerald-500">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Laptop className="h-5 w-5 text-emerald-600" />
                Current Active Session
              </CardTitle>
              <CardDescription className="mt-1">
                Signed in as <span className="font-semibold text-foreground">{session.name}</span>{" "}
                ({session.email || "No email"})
              </CardDescription>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
              Active Now
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 border-t text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="rounded-xl bg-muted/40 border p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Staff User ID
              </span>
              <p className="font-bold text-foreground mt-1">{session.userId || "—"}</p>
            </div>
            <div className="rounded-xl bg-muted/40 border p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Session Issued
              </span>
              <p className="font-bold text-foreground mt-1">{formatDateTime(session.issuedAt)}</p>
            </div>
            <div className="rounded-xl bg-muted/40 border p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Token Expires
              </span>
              <p className="font-bold text-foreground mt-1">{formatDateTime(session.expiresAt)}</p>
            </div>
          </div>

          <div className="rounded-xl bg-muted/30 border p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current Client / Browser
            </span>
            <p className="text-xs font-mono text-foreground mt-1 break-all">
              {session.userAgent || "Unknown client"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Historical Audit Note */}
      <div className="flex items-start gap-3 rounded-xl border bg-blue-50/70 border-blue-200 p-4 text-sm text-blue-900">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Historical Multi-Device Login Logs</p>
          <p className="text-xs text-blue-800 leading-relaxed">
            This session panel displays live metadata from your active JWT cookie. Historical IP and past-device login logs will appear here once a dedicated authentication audit endpoint is enabled on Spring Boot or Directus.
          </p>
        </div>
      </div>
    </div>
  );
}
