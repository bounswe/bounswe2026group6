"use client";
import * as React from "react";
import Image from "next/image";
import { useTheme } from "@/components/theme/ThemeProvider";
import { AuthCard } from "@/components/ui/display/AuthCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { AuthShowcase } from "@/components/feature/auth/AuthShowcase";

type AuthLayoutProps = {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
};

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
    const { isDarkTheme } = useTheme();

    return (
        <div className="min-h-screen bg-[color:var(--background-page)]">
            <PageContainer className="py-10">
                <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
                    <div className="hidden lg:sticky lg:top-10 lg:block">
                        <AuthShowcase />
                    </div>

                    <div className="flex items-start justify-center">
                        <AuthCard className="w-full max-w-md">
                            <div className="mb-6 flex flex-col items-center text-center">
                                <Image
                                    src={isDarkTheme ? "/dark_neph_logo.png" : "/neph_logo.png"}
                                    alt="NEPH logo"
                                    width={180}
                                    height={52}
                                    className="mb-4 h-auto w-[180px] max-w-full"
                                    priority
                                />

                                {title ? (
                                    <h1 className="text-3xl font-bold text-[color:var(--text-primary)]">
                                        {title}
                                    </h1>
                                ) : null}

                                {subtitle ? (
                                    <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                                        {subtitle}
                                    </p>
                                ) : null}
                            </div>

                            {children}
                        </AuthCard>
                    </div>
                </div>
            </PageContainer>
        </div>
    );
}
