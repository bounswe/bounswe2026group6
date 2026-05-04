import dynamic from "next/dynamic";

const LeafletCrisisMap = dynamic(
    () =>
        import("@/components/feature/location/LeafletCrisisMap").then(
            (mod) => mod.LeafletCrisisMap
        ),
    {
        ssr: false,
        loading: () => <div className="h-[380px] w-full animate-pulse rounded-[10px] bg-[#eef0f3] md:h-[500px]" />,
    }
);

export { LeafletCrisisMap as CrisisMap };

