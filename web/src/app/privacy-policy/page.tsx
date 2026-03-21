import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";

type PrivacyPolicyPageProps = {
    searchParams?: Promise<{
        from?: string;
    }>;
};

export default async function PrivacyPolicyPage({
    searchParams,
}: PrivacyPolicyPageProps) {
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
                            title="Privacy Policy"
                            subtitle="Last updated: March 2026"
                        />

                        <div className="space-y-5 text-sm leading-7 text-[#2B2B33]">
                            <p>
                                This page is a placeholder Privacy Policy for the NEPH MVP.
                                It describes how user-provided information may be handled
                                within the project’s early development scope.
                            </p>

                            <div>
                                <h3 className="text-base font-semibold">
                                    1. Information collected
                                </h3>
                                <p className="mt-2">
                                    NEPH may collect information such as name, email,
                                    phone number, and emergency-related profile details
                                    entered by the user.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-base font-semibold">
                                    2. Purpose of use
                                </h3>
                                <p className="mt-2">
                                    This information is used to support account creation,
                                    emergency preparedness features, and user coordination
                                    flows within the MVP.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-base font-semibold">
                                    3. Data protection
                                </h3>
                                <p className="mt-2">
                                    As an academic MVP, NEPH is still under development.
                                    Full production-grade privacy safeguards may not yet be
                                    fully implemented.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-base font-semibold">
                                    4. Policy updates
                                </h3>
                                <p className="mt-2">
                                    This privacy policy may be updated in later project
                                    phases as the platform and backend capabilities evolve.
                                </p>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </PageContainer>
        </div>
    );
}