"use client";

import { useSession } from "next-auth/react";
import { AppShell } from "@/components/app-shell";
import { ActivityFeed } from "@/components/activity-feed";
import { Panel, RowsSkeleton } from "@/components/ui/primitives";

export default function ActivityPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  return (
    <AppShell
      title="Activity"
      description={
        role === "agent"
          ? "Everything that happened on tickets assigned to you."
          : "Everything that happened on the tickets you raised."
      }
    >
      {role ? (
        <ActivityFeed role={role} />
      ) : (
        <Panel>
          <RowsSkeleton />
        </Panel>
      )}
    </AppShell>
  );
}
