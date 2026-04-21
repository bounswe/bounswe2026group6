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
            <div className="h-[380px] w-full animate-pulse rounded-[10px] border border-[#e7e7ea] bg-[#f8f8f9] md:h-[500px]" />
        ),
    }
);

export { LeafletGatheringAreasMap as GatheringAreasMap };
