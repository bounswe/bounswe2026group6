import * as React from "react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { PageContainer } from "@/components/layout/PageContainer";

type AppShellProps = {
    title?: string;
    children: React.ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
    return (
        <div className="min-h-screen bg-gray-50">
            <TopNavbar />
            <main className="py-8">
                <PageContainer>
                    {title ? (
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
                        </div>
                    ) : null}
                    {children}
                </PageContainer>
            </main>
        </div>
    );
}