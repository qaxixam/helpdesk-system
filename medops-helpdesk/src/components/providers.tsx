"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-right"
          closeButton
          toastOptions={{
            style: {
              fontFamily: "var(--font-sans)",
              borderRadius: "10px",
              border: "1px solid var(--color-line)",
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  );
}
