"use client";

import * as React from "react";
import Link from "next/link";
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
import { SIGNUP_DRAFT_KEY, signup } from "@/lib/auth";
import { isValidEmail } from "@/lib/validators/email";

export function SignupForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const shouldRestoreDraft = searchParams.get("restore") === "1";
    const redirectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const [showEmailForm, setShowEmailForm] = React.useState(false);
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [acceptedTerms, setAcceptedTerms] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");

    React.useEffect(() => {
        if (!shouldRestoreDraft) {
            sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
            return;
        }

        const savedDraft = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
        if (!savedDraft) return;

        try {
            const parsed = JSON.parse(savedDraft);

            setEmail(parsed.email || "");
            setAcceptedTerms(parsed.acceptedTerms || false);
            setShowEmailForm(true);
        } catch {
            // ignore invalid draft
        }
    }, [shouldRestoreDraft]);

    React.useEffect(() => {
        return () => {
            if (redirectTimeoutRef.current) {
                clearTimeout(redirectTimeoutRef.current);
            }
        };
    }, []);

    const saveSignupDraft = () => {
        sessionStorage.setItem(
            SIGNUP_DRAFT_KEY,
            JSON.stringify({
                email,
                acceptedTerms,
            })
        );
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setInfo("");

        if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
            setError("Please fill in all required fields.");
            return;
        }

        if (!isValidEmail(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!acceptedTerms) {
            setError("You must accept the terms to continue.");
            return;
        }

        try {
            setLoading(true);

            sessionStorage.setItem(
                SIGNUP_DRAFT_KEY,
                JSON.stringify({
                    email,
                    acceptedTerms,
                })
            );

            await signup({
                email,
                password,
                acceptedTerms,
            });

            setInfo(
                "Account created successfully. Check your email for the verification link."
            );

            redirectTimeoutRef.current = setTimeout(() => {
                router.push(`/verify-email?email=${encodeURIComponent(email)}`);
            }, 700);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Signup failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSocialAuth = (provider: "Google" | "Facebook" | "Apple") => {
        setError("");
        setInfo(
            `${provider} sign-up UI is ready. Real OAuth registration will be connected after provider credentials and backend callback setup are completed.`
        );
    };

    return (
        <>
            <SocialAuthButtons mode="signup" onProviderClick={handleSocialAuth} />

            <div className="my-5 flex items-center gap-3">
                <Divider className="flex-1" />
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#A3A3AD]">
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
                        id="signup-email"
                        label="Email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <PasswordInput
                        id="signup-password"
                        label="Password"
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <PasswordInput
                        id="signup-confirm-password"
                        label="Confirm Password"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    <Checkbox
                        id="signup-terms"
                        checked={acceptedTerms}
                        onCheckedChange={setAcceptedTerms}
                        label={
                            <span>
                                I agree to the{" "}
                                <Link
                                    href="/terms-of-service?from=signup"
                                    onClick={saveSignupDraft}
                                    className="font-semibold text-[#D84A4A] hover:underline"
                                >
                                    Terms of Service
                                </Link>{" "}
                                and{" "}
                                <Link
                                    href="/privacy-policy?from=signup"
                                    onClick={saveSignupDraft}
                                    className="font-semibold text-[#D84A4A] hover:underline"
                                >
                                    Privacy Policy
                                </Link>
                                .
                            </span>
                        }
                    />

                    {error ? (
                        <HelperText className="text-[#D84A4A]">
                            {error}
                        </HelperText>
                    ) : null}

                    {info ? <HelperText>{info}</HelperText> : null}

                    <PrimaryButton type="submit" loading={loading}>
                        Create Account
                    </PrimaryButton>
                </form>
            )}

            {!showEmailForm && info ? (
                <div className="mt-4">
                    <HelperText>{info}</HelperText>
                </div>
            ) : null}

            <Divider className="my-6" />

            <AuthFooterLinks mode="signup" />
        </>
    );
}
