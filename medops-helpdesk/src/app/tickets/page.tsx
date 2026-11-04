"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TicketList } from "@/components/ticket-list";
import { CreateTicketModal } from "@/components/create-ticket-modal";
import { Button } from "@/components/ui/button";
import { Panel, RowsSkeleton } from "@/components/ui/primitives";

export default function TicketsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [creating, setCreating] = useState(false);

  // /tickets?new=1 (sidebar "New ticket") opens the form directly
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setCreating(true);
      window.history.replaceState(null, "", "/tickets");
    }
  }, []);

  return (
    <AppShell
      title={role === "agent" ? "My queue" : "My tickets"}
      description={
        role === "agent"
          ? "Tickets assigned to you. Filter by status, priority or category, or search by number."
          : "Every ticket you’ve raised, newest first."
      }
      actions={
        role === "user" ? (
          <Button onClick={() => setCreating(true)}>
            <Plus /> New ticket
          </Button>
        ) : null
      }
    >
      {role ? (
        <TicketList
          role={role}
          emptyAction={
            role === "user" ? (
              <Button onClick={() => setCreating(true)}>
                <Plus /> Raise a ticket
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Panel>
          <RowsSkeleton />
        </Panel>
      )}
      <CreateTicketModal open={creating} onClose={() => setCreating(false)} />
    </AppShell>
  );
}
