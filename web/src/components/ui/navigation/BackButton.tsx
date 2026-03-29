"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type BackButtonProps = {
    className?: string;
    fallbackHref?: string;
};

export function BackButton({ className, fallbackHref = "/home" }: BackButtonProps) {
    const router = useRouter();

    const handleBack = React.useCallback(() => {
        if (typeof window !== "undefined") {
            const referrer = document.referrer;

            if (referrer) {
                try {
                    const referrerUrl = new URL(referrer);

                    if (referrerUrl.origin === window.location.origin) {
                        router.back();
                        return;
                    }
                } catch {
                    // Ignore invalid referrer and use fallback route.
                }
            }
        }

        router.push(fallbackHref);
    }, [fallbackHref, router]);

    return (
        <button type="button" className={className} onClick={handleBack}>
            ← Back
        </button>
    );
}
