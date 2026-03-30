import { PageContainer } from "@/components/layout/PageContainer";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { BackButton } from "@/components/ui/navigation/BackButton";

export default function PrivacyPolicyPage() {

    return (
        <div className="policy-page">
            <PageContainer>
                <div className="policy-content-wrap">
                    <BackButton className="policy-back-link" />

                    <SectionCard className="policy-card">
                        <SectionHeader
                            title="Privacy Policy"
                            subtitle="Last updated: March 2026"
                        />

                        <div className="policy-body">
                            <p>
                                This page is a placeholder Privacy Policy for the NEPH MVP.
                                It describes how user-provided information may be handled
                                within the project’s early development scope.
                            </p>

                            <div>
                                <h3 className="policy-section-title">
                                    1. Information collected
                                </h3>
                                <p className="policy-section-text">
                                    NEPH may collect information such as name, email,
                                    phone number, and emergency-related profile details
                                    entered by the user.
                                </p>
                            </div>

                            <div>
                                <h3 className="policy-section-title">
                                    2. Purpose of use
                                </h3>
                                <p className="policy-section-text">
                                    This information is used to support account creation,
                                    emergency preparedness features, and user coordination
                                    flows within the MVP.
                                </p>
                            </div>

                            <div>
                                <h3 className="policy-section-title">
                                    3. Data protection
                                </h3>
                                <p className="policy-section-text">
                                    As an academic MVP, NEPH is still under development.
                                    Full production-grade privacy safeguards may not yet be
                                    fully implemented.
                                </p>
                            </div>

                            <div>
                                <h3 className="policy-section-title">
                                    4. Policy updates
                                </h3>
                                <p className="policy-section-text">
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