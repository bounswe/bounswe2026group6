"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { getAccessToken } from "@/lib/auth";

type AdminRouteGateProps = {
    children: React.ReactNode;
};

export function AdminRouteGate({ children }: AdminRouteGateProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [hasToken, setHasToken] = React.useState<boolean | null>(null);

    const refreshTokenState = React.useCallback(() => {
        setHasToken(Boolean(getAccessToken()));
    }, []);

    React.useEffect(() => {
        refreshTokenState();
    }, [refreshTokenState]);

    React.useEffect(() => {
        if (hasToken === false) {
            router.replace(`/login?returnTo=${encodeURIComponent(pathname || "/admin")}`);
        }
    }, [hasToken, pathname, router]);

    if (hasToken === null) {
        return (
            <div className="admin-empty-state">
                <p>Checking admin access...</p>
                <PrimaryButton onClick={refreshTokenState}>
                    Retry Access Check
                </PrimaryButton>
            </div>
        );
    }

    if (!hasToken) {
        return null;
    }

    return <>{children}</>;
}
