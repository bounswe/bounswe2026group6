import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";

type TermsOfServicePageProps = {
    searchParams?: Promise<{
        from?: string;
    }>;
};

export default async function TermsOfServicePage({
    searchParams,
}: TermsOfServicePageProps) {
    const params = await searchParams;
    const backHref = params?.from === "signup" ? "/signup?restore=1" : "/signup";

    return (
        <div className="min-h-screen bg-[#F8F8F9] py-10">
            <PageContainer>
                <div className="mx-auto max-w-3xl">
                    <Link
                        href={backHref}
                        className="text-sm font-medium text-[#D84A4A] hover:underline"
                    >
                        ← Back to Sign Up
                    </Link>

                    <SectionCard className="mt-4">
                        <SectionHeader
                            title="Terms of Service"
                            subtitle="Last updated: March 2026"
                        />

                        <div className="space-y-5 text-sm leading-7 text-[#2B2B33]">
                            <p>
                                This page is a placeholder Terms of Service for the
                                NEPH MVP. It explains the general expectations for using
                                the platform during the early development phase.
                            </p>

                            <div>
                                <h3 className="text-base font-semibold">
                                    1. Use of the platform
                                </h3>
                                <p className="mt-2">
                                    NEPH is intended to support emergency preparedness and
                                    neighborhood coordination. Users should provide
                                    accurate information and use the platform responsibly.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-base font-semibold">
                                    2. Account responsibility
                                </h3>
                                <p className="mt-2">
                                    Users are responsible for maintaining the accuracy of
                                    their account information and keeping their credentials
                                    secure.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-base font-semibold">
                                    3. Platform limitations
                                </h3>
                                <p className="mt-2">
                                    NEPH is an academic MVP and may not include full
                                    production-grade guarantees, legal protections, or
                                    emergency service integration at this stage.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-base font-semibold">
                                    4. Future updates
                                </h3>
                                <p className="mt-2">
                                    These terms may be revised as the project evolves and
                                    more complete platform policies are defined.
                                </p>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </PageContainer>
        </div>
    );
}