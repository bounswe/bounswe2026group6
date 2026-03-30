"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clearAccessToken, fetchCurrentUser, getAccessToken } from "@/lib/auth";

type AuthRouteGateProps = {
    children: React.ReactNode;
    mode: "protected" | "guest-only";
    defaultAuthenticatedRoute?: string;
};

const AUTH_ROUTES = new Set(["/", "/login", "/signup", "/forgot-password", "/verify-email"]);
type AuthStatus = "checking" | "authenticated" | "guest";

function getPathnameOnly(path: string) {
    const noHash = path.split("#")[0];
    return noHash.split("?")[0] || "/";
}

function getSafeInternalPath(candidate: string | null): string | null {
    if (!candidate) {
        return null;
    }

    if (!candidate.startsWith("/") || candidate.startsWith("//")) {
        return null;
    }

    return candidate;
}

function isAuthRoute(pathname: string) {
    return AUTH_ROUTES.has(getPathnameOnly(pathname));
}

function buildReturnTo(pathname: string, searchParams: URLSearchParams) {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
}

export function AuthRouteGate({
    children,
    mode,
    defaultAuthenticatedRoute = "/home",
}: AuthRouteGateProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [authStatus, setAuthStatus] = React.useState<AuthStatus>("checking");

    React.useEffect(() => {
        let cancelled = false;

        async function resolveAuthStatus() {
            setAuthStatus("checking");

            const token = getAccessToken();
            if (!token || !token.trim()) {
                if (!cancelled) {
                    setAuthStatus("guest");
                }
                return;
            }

            try {
                await fetchCurrentUser(token);
                if (!cancelled) {
                    setAuthStatus("authenticated");
                }
            } catch {
                clearAccessToken();
                if (!cancelled) {
                    setAuthStatus("guest");
                }
            }
        }

        resolveAuthStatus();

        return () => {
            cancelled = true;
        };
    }, [mode, pathname, searchParams]);

    React.useEffect(() => {
        if (authStatus === "checking") {
            return;
        }

        if (mode === "protected" && authStatus === "guest") {
            const returnTo = buildReturnTo(pathname, searchParams);
            router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
            return;
        }

        if (mode === "guest-only" && authStatus === "authenticated") {
            const requestedReturnTo = getSafeInternalPath(searchParams.get("returnTo"));
            const target =
                requestedReturnTo && !isAuthRoute(requestedReturnTo)
                    ? requestedReturnTo
                    : defaultAuthenticatedRoute;

            router.replace(target);
        }
    }, [authStatus, defaultAuthenticatedRoute, mode, pathname, router, searchParams]);

    if (authStatus === "checking") {
        return null;
    }

    if (mode === "protected" && authStatus !== "authenticated") {
        return null;
    }

    if (mode === "guest-only" && authStatus !== "guest") {
        return null;
    }

    return <>{children}</>;
}