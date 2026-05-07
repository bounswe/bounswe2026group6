"use client";

import dynamic from "next/dynamic";

const LeafletGatheringAreasMap = dynamic(
    () =>
        import("@/components/feature/location/LeafletGatheringAreasMap").then(
            (mod) => mod.LeafletGatheringAreasMap
        ),
    {
        ssr: false,
        loading: () => (
            <div className="h-[380px] w-full animate-pulse rounded-[10px] border border-[color:var(--border-subtle)] bg-[color:var(--surface-soft)] md:h-[500px]" />
        ),
    }
);

export { LeafletGatheringAreasMap as GatheringAreasMap };
