"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { useAuthSession } from "@/lib/authSession";

type AdminRouteGateProps = {
    children: React.ReactNode;
};

export function AdminRouteGate({ children }: AdminRouteGateProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { state, refresh } = useAuthSession();

    React.useEffect(() => {
        if (state.phase === "guest") {
            router.replace(`/login?returnTo=${encodeURIComponent(pathname || "/admin")}`);
            return;
        }

        if (state.phase === "authenticated" && !state.user?.isAdmin) {
            router.replace("/home");
        }
    }, [pathname, router, state.phase, state.user?.isAdmin]);

    if (state.phase === "loading") {
        return (
            <div className="admin-empty-state">
                <p>Checking admin access...</p>
                <PrimaryButton onClick={() => void refresh({ force: true })}>
                    Retry Access Check
                </PrimaryButton>
            </div>
        );
    }

    if (state.phase === "error") {
        return (
            <div className="admin-empty-state">
                <p>{state.errorMessage || "Could not verify admin access right now."}</p>
                <PrimaryButton onClick={() => void refresh({ force: true })}>Retry</PrimaryButton>
            </div>
        );
    }

    if (state.phase !== "authenticated" || !state.user?.isAdmin) {
        return null;
    }

    return <>{children}</>;
}
