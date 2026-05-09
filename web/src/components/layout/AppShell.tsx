"use client";

import * as React from "react";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAuthSession } from "@/lib/authSession";
import { WEB_TUTORIAL_PENDING_KEY } from "@/lib/auth";

type AppShellProps = {
    title?: string;
    titleClassName?: string;
    containerClassName?: string;
    children: React.ReactNode;
};

const tutorialSteps = [
    {
        title: "Home Overview",
        subtitle: "Start here for the fastest snapshot.",
        description:
            "Use Home to see key updates quickly and jump to emergency tools without searching the full app.",
    },
    {
        title: "News and Announcements",
        subtitle: "Follow verified updates.",
        description:
            "Open News to track emergency announcements, preparedness notes, and community communication in one feed.",
    },
    {
        title: "Emergency Tools",
        subtitle: "Map and contacts in one flow.",
        description:
            "Emergency Numbers gives direct hotline access for urgent contact scenarios.",
    },
    {
        title: "Help Request Map",
        subtitle: "See active help context on the map.",
        description:
            "Use Help Request Map to view location-based emergency request activity and understand where support may be needed.",
    },
    {
        title: "Gathering Areas",
        subtitle: "Find nearby safe assembly points.",
        description:
            "Use Gathering Areas to locate assembly and support points around your area and review available map context quickly.",
    },
    {
        title: "Your Profile and Privacy",
        subtitle: "Keep coordination data accurate.",
        description:
            "Update Profile with contact and location details, then review Privacy & Security settings to control what is shared.",
    },
] as const;

export function AppShell({
    title,
    titleClassName,
    containerClassName,
    children,
}: AppShellProps) {
    const { state } = useAuthSession();
    const [showTutorial, setShowTutorial] = React.useState(false);
    const [stepIndex, setStepIndex] = React.useState(0);

    React.useEffect(() => {
        if (state.phase !== "authenticated" || !state.user?.userId) {
            return;
        }

        const pending = window.localStorage.getItem(WEB_TUTORIAL_PENDING_KEY) === "1";
        if (!pending) {
            return;
        }

        const seenKey = `neph_web_tutorial_seen_${state.user.userId}`;
        const hasSeen = window.localStorage.getItem(seenKey) === "1";

        if (hasSeen) {
            window.localStorage.removeItem(WEB_TUTORIAL_PENDING_KEY);
            return;
        }

        setShowTutorial(true);
        setStepIndex(0);
    }, [state.phase, state.user?.userId]);

    const isLastStep = stepIndex === tutorialSteps.length - 1;
    const progress = ((stepIndex + 1) / tutorialSteps.length) * 100;
    const currentStep = tutorialSteps[stepIndex];

    const closeTutorial = React.useCallback(() => {
        if (state.user?.userId) {
            const seenKey = `neph_web_tutorial_seen_${state.user.userId}`;
            window.localStorage.setItem(seenKey, "1");
        }
        window.localStorage.removeItem(WEB_TUTORIAL_PENDING_KEY);
        setShowTutorial(false);
    }, [state.user?.userId]);

    return (
        <div className="app-shell">
            <TopNavbar />
            <main className="app-shell-main">
                <PageContainer className={containerClassName}>
                    {title ? (
                        <div className="app-shell-title-wrap">
                            <h1 className={`app-shell-title${titleClassName ? ` ${titleClassName}` : ""}`}>
                                {title}
                            </h1>
                        </div>
                    ) : null}
                    {children}
                </PageContainer>
            </main>
            {showTutorial ? (
                <div className="web-tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="web-tutorial-title">
                    <div className="web-tutorial-modal">
                        <div className="web-tutorial-head">
                            <p className="web-tutorial-kicker">Welcome to NEPH</p>
                            <button
                                type="button"
                                className="web-tutorial-skip"
                                onClick={closeTutorial}
                            >
                                Skip
                            </button>
                        </div>

                        <h2 id="web-tutorial-title" className="web-tutorial-title">
                            {currentStep.title}
                        </h2>
                        <p className="web-tutorial-copy">{currentStep.subtitle}</p>

                        <div className="web-tutorial-progress-track" aria-hidden="true">
                            <span className="web-tutorial-progress-fill" style={{ width: `${progress}%` }} />
                        </div>

                        <div className="web-tutorial-dots" aria-hidden="true">
                            {tutorialSteps.map((step, index) => (
                                <span
                                    key={step.title}
                                    className={`web-tutorial-dot${index === stepIndex ? " is-active" : ""}`}
                                />
                            ))}
                        </div>

                        <div className="web-tutorial-list">
                            <p>{currentStep.description}</p>
                        </div>

                        <div className="web-tutorial-actions">
                            <button
                                type="button"
                                className="web-tutorial-ghost"
                                onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                                disabled={stepIndex === 0}
                            >
                                Back
                            </button>
                            {isLastStep ? (
                                <button
                                    type="button"
                                    className="web-tutorial-close"
                                    onClick={closeTutorial}
                                >
                                    Finish
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="web-tutorial-close"
                                    onClick={() =>
                                        setStepIndex((prev) => Math.min(prev + 1, tutorialSteps.length - 1))
                                    }
                                >
                                    Next
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
