"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TicketList } from "@/components/ticket-list";
import { CreateTicketModal } from "@/components/create-ticket-modal";
import { Button } from "@/components/ui/button";

export default function AdminTicketsPage() {
  const [creating, setCreating] = useState(false);
  const [initial, setInitial] = useState<{ assignedAgent?: string; breached?: boolean } | null>(null);

  // Dashboard links pass ?assignedAgent=unassigned or ?breached=true
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setInitial({
      assignedAgent: q.get("assignedAgent") ?? "",
      breached: q.get("breached") === "true",
    });
  }, []);

  return (
    <AppShell
      title="All tickets"
      description="Assign tickets to agents from the Assignee column. Use filters to find unassigned or breached work."
      actions={
        <Button variant="secondary" onClick={() => setCreating(true)}>
          <Plus /> New ticket
        </Button>
      }
    >
      {initial && <TicketList role="admin" initial={initial} pageSize={12} />}
      <CreateTicketModal open={creating} onClose={() => setCreating(false)} />
    </AppShell>
  );
}
