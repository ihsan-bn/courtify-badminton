"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";
import { clearAccessToken, hasAccessToken } from "@/lib/auth";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function verifySession() {
      if (!hasAccessToken()) {
        router.replace("/login");
        return;
      }

      try {
        await apiFetch("/api/me", { auth: true });
        if (mounted) {
          setReady(true);
        }
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          clearAccessToken();
          router.replace("/login");
          return;
        }
        if (mounted) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to verify your session."
          );
        }
      }
    }

    void verifySession();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (error) {
    return (
      <p className="alert" role="alert">
        {error}
      </p>
    );
  }

  if (!ready) {
    return <p className="loading">Checking your session...</p>;
  }

  return children;
}
