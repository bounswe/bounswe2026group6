"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VerificationCodeInput } from "@/components/ui/inputs/VerificationCodeInput";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { HelperText } from "@/components/ui/display/HelperText";
import { Divider } from "@/components/ui/display/Divider";
import { AuthFooterLinks } from "@/components/feature/auth/AuthFooterLinks";

const SIGNUP_DRAFT_KEY = "neph_signup_draft";

export function VerifyEmailForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const emailFromQuery = searchParams.get("email") || "";

    const [code, setCode] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [resending, setResending] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");
    const [success, setSuccess] = React.useState(false);

    const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setInfo("");

        if (code.trim().length !== 6) {
            setError("Please enter the 6-digit verification code.");
            return;
        }

        try {
            setLoading(true);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
            setSuccess(true);
        } catch {
            setError("Verification failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setInfo("");

        try {
            setResending(true);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            setInfo("A new verification code has been sent.");
        } catch {
            setError("Could not resend the code.");
        } finally {
            setResending(false);
        }
    };

    if (success) {
        return (
            <>
                <div className="rounded-[14px] border border-[#E7E7EA] bg-[#FAFAFB] p-5 text-center">
                    <h3 className="text-lg font-semibold text-[#2B2B33]">
                        Email verified successfully
                    </h3>

                    <p className="mt-2 text-sm text-[#737380]">
                        Your account is now verified. You can continue to the login
                        page.
                    </p>

                    <div className="mt-5">
                        <PrimaryButton onClick={() => router.push("/complete-profile")}>
                            Continue to Profile Setup
                        </PrimaryButton>
                    </div>
                </div>

                <Divider className="my-6" />

                <AuthFooterLinks mode="verify-email" />
            </>
        );
    }

    return (
        <>
            <form className="flex flex-col gap-4" onSubmit={handleVerify}>
                <div className="rounded-[14px] border border-[#E7E7EA] bg-[#FAFAFB] p-4">
                    <p className="text-sm font-medium text-[#2B2B33]">
                        Verification code
                    </p>

                    <p className="mt-1 text-sm text-[#737380]">
                        {emailFromQuery
                            ? `We sent a verification code to ${emailFromQuery}.`
                            : "Enter the code sent to your email address."}
                    </p>
                </div>

                <div className="flex flex-col items-center gap-3">
                    <VerificationCodeInput value={code} onChange={setCode} />
                    <HelperText className="text-center">
                        The code should contain 6 digits.
                    </HelperText>
                </div>

                {error ? (
                    <HelperText className="text-center text-[#D84A4A]">
                        {error}
                    </HelperText>
                ) : null}

                {info ? (
                    <HelperText className="text-center">{info}</HelperText>
                ) : null}

                <PrimaryButton type="submit" loading={loading}>
                    Verify Email
                </PrimaryButton>

                <SecondaryButton
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                >
                    {resending ? "Sending..." : "Resend Code"}
                </SecondaryButton>
            </form>

            <Divider className="my-6" />

            <AuthFooterLinks mode="verify-email" />
        </>
    );
}