"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { apiFetch, ApiError, type UserProfile } from "@/lib/api";
import { clearAccessToken } from "@/lib/auth";

export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function verifyAdmin() {
      try {
        const result = await apiFetch<{ user: UserProfile }>("/api/me", {
          auth: true
        });
        if (result.user.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
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
              : "Unable to verify administrator access."
          );
        }
      }
    }

    void verifyAdmin();
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
    return <p className="loading">Checking administrator access...</p>;
  }

  return children;
}
