import Link from "next/link";
import { HelperText } from "@/components/ui/display/HelperText";

type AuthFooterLinksProps = {
    mode: "login" | "signup" | "verify-email";
};

export function AuthFooterLinks({ mode }: AuthFooterLinksProps) {
    if (mode === "login") {
        return (
            <div className="text-center">
                <HelperText className="leading-6">
                    Don&apos;t have an account?{" "}
                    <Link
                        href="/signup"
                        className="font-semibold text-[#D84A4A] hover:underline"
                    >
                        Create one
                    </Link>
                </HelperText>
            </div>
        );
    }

    if (mode === "signup") {
        return (
            <div className="text-center">
                <HelperText className="leading-6">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="font-semibold text-[#D84A4A] hover:underline"
                    >
                        Log in
                    </Link>
                </HelperText>
            </div>
        );
    }

return (
    <div className="text-center">
        <HelperText className="leading-6">
            Wrong email address?{" "}
            <Link
                href="/signup?restore=1"
                className="font-semibold text-[#D84A4A] hover:underline"
            >
                Go back
            </Link>
        </HelperText>
    </div>
);
}