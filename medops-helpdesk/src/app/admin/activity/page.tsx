"use client";

import { AppShell } from "@/components/app-shell";
import { ActivityFeed } from "@/components/activity-feed";

export default function AdminActivityPage() {
  return (
    <AppShell
      title="Activity log"
      description="Audit trail across the whole desk: who changed what, and when."
    >
      <ActivityFeed role="admin" />
    </AppShell>
  );
}
