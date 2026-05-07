import * as React from "react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { PageContainer } from "@/components/layout/PageContainer";

type AppShellProps = {
    title?: string;
    titleClassName?: string;
    containerClassName?: string;
    children: React.ReactNode;
};

export function AppShell({
    title,
    titleClassName,
    containerClassName,
    children,
}: AppShellProps) {
    return (
        <div className="app-shell">
            <TopNavbar />
            <main className="app-shell-main">
                <PageContainer className={containerClassName}>
                    {title ? (
                        <div className="app-shell-title-wrap">
                            <h1 className={`app-shell-title${titleClassName ? ` ${titleClassName}` : ""}`}>
                                {title}
                            </h1>
                        </div>
                    ) : null}
                    {children}
                </PageContainer>
            </main>
        </div>
    );
}