import * as React from "react";
import { cn } from "@/lib/cn";

type SectionHeaderProps = {
    title: string;
    subtitle?: string;
    className?: string;
};

export function SectionHeader({
    title,
    subtitle,
    className,
}: SectionHeaderProps) {
    return (
        <div className={cn("mb-4 flex flex-col gap-1", className)}>
            <h2 className="text-xl font-semibold text-[#2B2B33]">{title}</h2>
            {subtitle ? (
                <p className="text-sm text-[#737380]">{subtitle}</p>
            ) : null}
        </div>
    );
}