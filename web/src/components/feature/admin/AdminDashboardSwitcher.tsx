"use client";

import * as React from "react";
import AdminEmergencyOverviewView from "@/components/feature/admin/AdminEmergencyOverviewView";
import AdminEmergencyHistoryView from "@/components/feature/admin/AdminEmergencyHistoryView";
import AdminEmergencyInsightsView from "@/components/feature/admin/AdminEmergencyInsightsView";
import AdminDeploymentMonitoringView from "@/components/feature/admin/AdminDeploymentMonitoringView";

type AdminSectionKey = "overview" | "history" | "insights" | "monitoring";

const SECTIONS: Array<{ key: AdminSectionKey; label: string }> = [
    { key: "overview", label: "Emergency Overview" },
    { key: "history", label: "Emergency History" },
    { key: "insights", label: "Emergency Insights" },
    { key: "monitoring", label: "Deployment Monitoring" },
];

export default function AdminDashboardSwitcher() {
    const [activeSection, setActiveSection] = React.useState<AdminSectionKey>("overview");
    const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

    const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
            return;
        }

        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (index + delta + SECTIONS.length) % SECTIONS.length;
        const nextSection = SECTIONS[nextIndex];
        setActiveSection(nextSection.key);
        tabRefs.current[nextIndex]?.focus();
    };

    return (
        <div className="grid gap-5">
            <div className="admin-dashboard-nav" role="tablist" aria-label="Admin dashboard sections">
                {SECTIONS.map((section, index) => (
                    <button
                        key={section.key}
                        type="button"
                        id={`admin-tab-${section.key}`}
                        role="tab"
                        aria-controls={`admin-panel-${section.key}`}
                        aria-selected={activeSection === section.key}
                        tabIndex={activeSection === section.key ? 0 : -1}
                        ref={(node) => {
                            tabRefs.current[index] = node;
                        }}
                        className={`admin-dashboard-tab${activeSection === section.key ? " is-active" : ""}`}
                        onClick={() => setActiveSection(section.key)}
                        onKeyDown={(event) => handleTabKeyDown(event, index)}
                    >
                        {section.label}
                    </button>
                ))}
            </div>

            {activeSection === "overview" ? (
                <div
                    id="admin-panel-overview"
                    role="tabpanel"
                    aria-labelledby="admin-tab-overview"
                >
                    <AdminEmergencyOverviewView />
                </div>
            ) : activeSection === "history" ? (
                <div
                    id="admin-panel-history"
                    role="tabpanel"
                    aria-labelledby="admin-tab-history"
                >
                    <AdminEmergencyHistoryView />
                </div>
            ) : activeSection === "insights" ? (
                <div
                    id="admin-panel-insights"
                    role="tabpanel"
                    aria-labelledby="admin-tab-insights"
                >
                    <AdminEmergencyInsightsView />
                </div>
            ) : (
                <div
                    id="admin-panel-monitoring"
                    role="tabpanel"
                    aria-labelledby="admin-tab-monitoring"
                >
                    <AdminDeploymentMonitoringView />
                </div>
            )}
        </div>
    );
}
