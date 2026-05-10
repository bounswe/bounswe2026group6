"use client";

import { useAuthSession } from "@/lib/authSession";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function GuestThemeToggle() {
    const { state } = useAuthSession();
    const isAuthenticated = state.phase === "authenticated";

    if (isAuthenticated) {
        return null;
    }

    return <ThemeToggle variant="corner" />;
}
