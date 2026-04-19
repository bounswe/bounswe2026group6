"use client";

import dynamic from "next/dynamic";

const LeafletLocationMap = dynamic(
    () => import("@/components/feature/location/LeafletLocationMap").then((mod) => mod.LeafletLocationMap),
    {
        ssr: false,
        loading: () => (
            <div className="h-72 w-full animate-pulse rounded-[10px] border border-[#e7e7ea] bg-[#f8f8f9]" />
        ),
    }
);

export { LeafletLocationMap as LocationPickerMap };
