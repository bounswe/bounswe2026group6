"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { Divider } from "@/components/ui/display/Divider";
import { HelperText } from "@/components/ui/display/HelperText";
import { isValidEmail } from "@/lib/validators/email";

export function ForgotPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialEmail = searchParams.get("email") || "";

    const [email, setEmail] = React.useState(initialEmail);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");
    const [success, setSuccess] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setInfo("");

        if (!email.trim()) {
            setError("Please enter your email address.");
            return;
        }

        if (!isValidEmail(email)) {
    setError("Please enter a valid email address.");
    return;
}

        try {
            setLoading(true);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            setSuccess(true);
        } catch {
            setError("We could not start the password reset flow. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <>
                <div className="rounded-[14px] border border-[#E7E7EA] bg-[#FAFAFB] p-5 text-center">
                    <h3 className="text-lg font-semibold text-[#2B2B33]">
                        Reset email sent
                    </h3>

                    <p className="mt-2 text-sm text-[#737380]">
                        If an account exists for <span className="font-medium">{email}</span>,
                        a password reset link will be sent.
                    </p>

                    <div className="mt-5 flex flex-col gap-3">
                        <PrimaryButton onClick={() => router.push("/login")}>
                            Back to Log In
                        </PrimaryButton>

                        <SecondaryButton
                            type="button"
                            onClick={() => {
                                setSuccess(false);
                                setInfo("You can try again with another email address.");
                            }}
                        >
                            Use Another Email
                        </SecondaryButton>
                    </div>
                </div>

                <Divider className="my-6" />

                <div className="text-center">
                    <HelperText className="leading-6">
                        Remembered your password?{" "}
                        <Link
                            href="/login"
                            className="font-semibold text-[#D84A4A] hover:underline"
                        >
                            Go back to log in
                        </Link>
                    </HelperText>
                </div>
            </>
        );
    }

    return (
        <>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <TextInput
                    id="forgot-password-email"
                    label="Email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

               

                {error ? (
                    <HelperText className="text-[#D84A4A]">{error}</HelperText>
                ) : null}

                {info ? <HelperText>{info}</HelperText> : null}

                <PrimaryButton type="submit" loading={loading}>
                    Send Reset Link
                </PrimaryButton>
            </form>

            <Divider className="my-6" />

            <div className="text-center">
                <HelperText className="leading-6">
                    Remembered your password?{" "}
                    <Link
                        href="/login"
                        className="font-semibold text-[#D84A4A] hover:underline"
                    >
                        Go back to log in
                    </Link>
                </HelperText>
            </div>
        </>
    );
}