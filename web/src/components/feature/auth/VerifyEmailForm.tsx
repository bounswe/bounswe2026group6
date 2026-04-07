"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { HelperText } from "@/components/ui/display/HelperText";
import { Divider } from "@/components/ui/display/Divider";
import { AuthFooterLinks } from "@/components/feature/auth/AuthFooterLinks";
import { resendVerification, setAccessToken, verifyEmail } from "@/lib/auth";

export function VerifyEmailForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const emailFromQuery = searchParams.get("email") || "";
    const tokenFromQuery = searchParams.get("token") || "";

    const [loading, setLoading] = React.useState(false);
    const [resending, setResending] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");
    const [success, setSuccess] = React.useState(false);
    const [shouldAutoVerify, setShouldAutoVerify] = React.useState(false);

    const verificationStartedRef = React.useRef(false);
    const deepLinkAttemptedRef = React.useRef(false);

    React.useEffect(() => {
        if (!tokenFromQuery) {
            setShouldAutoVerify(false);
            return;
        }

        if (typeof window === "undefined") {
            setShouldAutoVerify(true);
            return;
        }

        const userAgent = window.navigator.userAgent || "";
        const isAndroidDevice = /Android/i.test(userAgent);

        if (!isAndroidDevice || deepLinkAttemptedRef.current) {
            setShouldAutoVerify(true);
            return;
        }

        deepLinkAttemptedRef.current = true;
        setInfo("Opening the app to continue verification...");

        const deepLinkToken = encodeURIComponent(tokenFromQuery);
        window.location.href = `neph://verify-email?token=${deepLinkToken}`;

        const timeoutId = window.setTimeout(() => {
            setShouldAutoVerify(true);
            setInfo("App was not opened. Continuing verification on web...");
        }, 1200);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [tokenFromQuery]);

    React.useEffect(() => {
        if (!tokenFromQuery || !shouldAutoVerify || verificationStartedRef.current) {
            return;
        }

        verificationStartedRef.current = true;
        setError("");
        setInfo("");

        const runAutoVerification = async () => {
            try {
                setLoading(true);
                const response = await verifyEmail(tokenFromQuery);

                if (response.accessToken) {
                    setAccessToken(response.accessToken, { rememberMe: true });
                    router.replace("/complete-profile");
                    return;
                }

                setSuccess(true);
                setInfo(response.message || "Email verified successfully.");
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Verification failed. Please try again."
                );
            } finally {
                setLoading(false);
            }
        };

        void runAutoVerification();
    }, [router, shouldAutoVerify, tokenFromQuery]);

    const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setInfo("");

        if (!tokenFromQuery) {
            setError(
                "Email verification currently uses the link sent to your inbox."
            );
            return;
        }

        try {
            setLoading(true);

            const response = await verifyEmail(tokenFromQuery);

            if (response.accessToken) {
                setAccessToken(response.accessToken, { rememberMe: true });
                router.replace("/complete-profile");
                return;
            }

            setSuccess(true);
            setInfo(response.message || "Email verified successfully.");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Verification failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setInfo("");

        try {
            setResending(true);

            if (!emailFromQuery) {
                setError("Email address is required to resend verification.");
                return;
            }

            const response = await resendVerification(emailFromQuery);

            setInfo(response.message);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not resend the code.");
        } finally {
            setResending(false);
        }
    };

    if (success) {
        return (
            <>
                <div className="rounded-[14px] border border-[color:var(--border-subtle)] bg-[color:var(--background-page)] p-5 text-center">
                    <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">
                        Email verified successfully
                    </h3>

                    <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                        Your account is now verified.
                    </p>

                    <div className="mt-5">
                        <PrimaryButton onClick={() => router.push("/login")}>
                            Continue to Log In
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
                <div className="rounded-[14px] border border-[color:var(--border-subtle)] bg-[color:var(--background-page)] p-4">
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                        {tokenFromQuery
                            ? "Your verification link is ready. We will verify automatically."
                            : emailFromQuery
                                ? `We sent a verification link to ${emailFromQuery}.`
                                : "Open the verification link from your email, or resend it below."}
                    </p>
                </div>

                {!tokenFromQuery ? (
                    <HelperText className="text-center">
                        The current backend verifies email through a tokenized link, not a
                        6-digit code.
                    </HelperText>
                ) : null}

                {error ? (
                    <HelperText className="text-center text-[color:var(--primary-500)]">
                        {error}
                    </HelperText>
                ) : null}

                {info ? (
                    <HelperText className="text-center">{info}</HelperText>
                ) : null}

                {tokenFromQuery ? (
                    <PrimaryButton type="submit" loading={loading} disabled={loading}>
                        Verify Email
                    </PrimaryButton>
                ) : null}

                {emailFromQuery ? (
                    <SecondaryButton
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                    >
                        {resending ? "Sending..." : "Resend Verification Email"}
                    </SecondaryButton>
                ) : null}

                <SecondaryButton
                    type="button"
                    onClick={() => router.push("/login")}
                    disabled={loading || resending}
                >
                    Go to Log In
                </SecondaryButton>
            </form>

            <Divider className="my-6" />

            <AuthFooterLinks mode="verify-email" />
        </>
    );
}