"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { PasswordInput } from "@/components/ui/inputs/PasswordInput";
import { Checkbox } from "@/components/ui/selection/Checkbox";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { Divider } from "@/components/ui/display/Divider";
import { HelperText } from "@/components/ui/display/HelperText";
import { AuthFooterLinks } from "@/components/feature/auth/AuthFooterLinks";
import { SocialAuthButtons } from "@/components/feature/auth/SocialAuthButtons";
import { ApiError } from "@/lib/api";
import { login, resendVerification, setAccessToken } from "@/lib/auth";
import { fetchMyProfile } from "@/lib/profile";
import { isValidEmail } from "@/lib/validators/email";

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [showEmailForm, setShowEmailForm] = React.useState(false);
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [rememberMe, setRememberMe] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [resendingVerification, setResendingVerification] = React.useState(false);
    const [showResendVerification, setShowResendVerification] = React.useState(false);
    const [resendEmail, setResendEmail] = React.useState("");
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");

    const safeReturnTo = React.useMemo(() => {
        const returnTo = searchParams.get("returnTo");

        if (!returnTo) {
            return null;
        }

        if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
            return null;
        }

        const pathnameOnly = returnTo.split("#")[0].split("?")[0] || "/";
        const blockedRoutes = new Set(["/", "/login", "/signup", "/forgot-password", "/verify-email"]);
        if (blockedRoutes.has(pathnameOnly)) {
            return null;
        }

        return returnTo;
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setInfo("");

        if (!email.trim() || !password.trim()) {
            setError("Please fill in both email and password.");
            return;
        }

        if (!isValidEmail(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        try {
            setLoading(true);

            const response = await login({ email, password });
            setAccessToken(response.accessToken, { rememberMe });

            try {
                await fetchMyProfile(response.accessToken);
                router.push(safeReturnTo || "/home");
            } catch (profileError) {
                if (profileError instanceof ApiError && profileError.status === 404) {
                    router.push("/complete-profile");
                    return;
                }

                router.push(safeReturnTo || "/home");
                return;
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Login failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        const target = email.trim()
            ? `/forgot-password?email=${encodeURIComponent(email)}`
            : "/forgot-password";

        router.push(target);
    };

    const handleSocialAuth = (provider: "Google" | "Facebook" | "Apple") => {
        setError("");
        setInfo(
            `${provider} sign-in UI is ready. Real OAuth login will be connected after provider credentials and backend callback setup are completed.`
        );
    };

    const handleResendVerification = async () => {
        setError("");
        setInfo("");

        const targetEmail = resendEmail.trim() || email.trim();

        if (!targetEmail) {
            setError("Please enter your email address to resend verification.");
            return;
        }

        if (!isValidEmail(targetEmail)) {
            setError("Please enter a valid email address.");
            return;
        }

        try {
            setResendingVerification(true);
            const response = await resendVerification(targetEmail);
            setInfo(response.message || "Verification email sent. Please check your inbox.");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Could not resend verification email."
            );
        } finally {
            setResendingVerification(false);
        }
    };

    return (
        <>
            <SocialAuthButtons mode="login" onProviderClick={handleSocialAuth} />

            <div className="my-5 flex items-center gap-3">
                <Divider className="flex-1" />
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                    or
                </span>
                <Divider className="flex-1" />
            </div>

            {!showEmailForm ? (
                <SecondaryButton
                    type="button"
                    onClick={() => {
                        setInfo("");
                        setError("");
                        setShowEmailForm(true);
                    }}
                >
                    Continue with Email
                </SecondaryButton>
            ) : (
                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                    <TextInput
                        id="login-email"
                        label="Email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <PasswordInput
                        id="login-password"
                        label="Password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <div className="flex items-center justify-between gap-4">
                        <Checkbox
                            id="remember-me"
                            label="Remember me"
                            checked={rememberMe}
                            onCheckedChange={setRememberMe}
                        />

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleForgotPassword}
                                className="text-sm font-medium text-[color:var(--primary-500)] hover:underline"
                            >
                                Forgot password?
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowResendVerification((prev) => !prev);
                                    setResendEmail(email);
                                    setError("");
                                    setInfo("");
                                }}
                                className="text-sm font-medium text-[color:var(--primary-500)] hover:underline"
                            >
                                Verify email?
                            </button>
                        </div>
                    </div>

                    {showResendVerification ? (
                        <div className="rounded-[10px] border border-[color:var(--border-subtle)] p-3">
                            <TextInput
                                id="resend-verification-email"
                                label="Email for verification"
                                type="email"
                                placeholder="Enter your email"
                                value={resendEmail}
                                onChange={(e) => setResendEmail(e.target.value)}
                            />

                            <div className="mt-2">
                                <button
                                    type="button"
                                    onClick={handleResendVerification}
                                    disabled={resendingVerification}
                                    className="text-sm font-medium text-[color:var(--primary-500)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {resendingVerification ? "Sending..." : "Resend verification email"}
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {error ? (
                        <HelperText className="text-[color:var(--primary-500)]">
                            {error}
                        </HelperText>
                    ) : null}

                    {info ? <HelperText>{info}</HelperText> : null}

                    <PrimaryButton type="submit" loading={loading}>
                        Log In
                    </PrimaryButton>
                </form>
            )}

            {!showEmailForm && info ? (
                <div className="mt-4">
                    <HelperText>{info}</HelperText>
                </div>
            ) : null}

            <Divider className="my-6" />

            <AuthFooterLinks mode="login" />
        </>
    );
}