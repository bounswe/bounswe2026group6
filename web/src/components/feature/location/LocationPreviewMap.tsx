"use client";

import dynamic from "next/dynamic";

const LeafletLocationMap = dynamic(
    () => import("@/components/feature/location/LeafletLocationMap").then((mod) => mod.LeafletLocationMap),
    {
        ssr: false,
        loading: () => (
            <div className="h-56 w-full animate-pulse rounded-[10px] border border-[color:var(--border-subtle)] bg-[color:var(--surface-soft)]" />
        ),
    }
);

export { LeafletLocationMap as LocationPreviewMap };
