"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getAccessToken, clearAccessToken } from "@/lib/auth";
import {
    fetchAdminDeploymentMonitoring,
    type DeploymentMonitoring,
    type DeploymentMonitoringConflictGroup,
    type DeploymentMonitoringItem,
} from "@/lib/admin";
import { formatOperationalLabel } from "@/lib/formatters";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";

type MonitoringControls = {
    waitThresholdHours: number;
    neglectThresholdHours: number;
    listLimit: number;
};

const DEFAULT_MONITORING_CONTROLS: MonitoringControls = {
    waitThresholdHours: 6,
    neglectThresholdHours: 12,
    listLimit: 10,
};

function formatHours(value: number | null | undefined) {
    if (value === null || value === undefined) {
        return "-";
    }
    if (value < 1) {
        return "<1h";
    }
    return `${value}h`;
}

function formatCity(value: string) {
    if (!value) return "Unknown";
    return formatOperationalLabel(value);
}

function ItemRow({ item }: { item: DeploymentMonitoringItem }) {
    return (
        <tr>
            <td>{item.requestId}</td>
            <td>{formatOperationalLabel(item.needType || "-")}</td>
            <td>{formatCity(item.location.city)}</td>
            <td>{formatOperationalLabel(item.location.district)}</td>
            <td>{item.urgencyLevel}</td>
            <td>{item.status}</td>
            <td>{formatHours(item.ageHours)}</td>
            <td>{formatHours(item.assignedHoursAgo)}</td>
            <td>{item.volunteerId || "-"}</td>
        </tr>
    );
}

function ItemsTable({
    items,
    emptyText,
}: {
    items: DeploymentMonitoringItem[];
    emptyText: string;
}) {
    if (items.length === 0) {
        return <p className="admin-subtle">{emptyText}</p>;
    }

    return (
        <div className="admin-region-table-wrap">
            <table className="admin-region-table admin-history-table">
                <thead>
                    <tr>
                        <th>Request</th>
                        <th>Type</th>
                        <th>City</th>
                        <th>District</th>
                        <th>Urgency</th>
                        <th>Status</th>
                        <th>Open</th>
                        <th>Assigned</th>
                        <th>Volunteer</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <ItemRow key={item.requestId} item={item} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ConflictGroupCard({ group }: { group: DeploymentMonitoringConflictGroup }) {
    return (
        <div className="admin-conflict-group">
            <p className="admin-recent-line">
                <strong>
                    {formatCity(group.groupKey.city)} ·{" "}
                    {formatOperationalLabel(group.groupKey.needType)}
                </strong>{" "}
                · Contact {group.groupKey.contactKey}{" "}
                · {group.duplicateCount} duplicate reports
            </p>
            <ItemsTable
                items={group.items}
                emptyText="No duplicate reports for this group."
            />
        </div>
    );
}

function SummaryTile({
    label,
    value,
    tone,
    description,
}: {
    label: string;
    value: number;
    tone: "default" | "warning" | "danger" | "success";
    description: string;
}) {
    return (
        <article className={`admin-metric-tile tone-${tone}`}>
            <p className="admin-metric-label">{label}</p>
            <p className="admin-metric-value">{value}</p>
            <p className="admin-recent-line">{description}</p>
        </article>
    );
}

export default function AdminDeploymentMonitoringView() {
    const router = useRouter();
    const pathname = usePathname();
    const [monitoring, setMonitoring] = React.useState<DeploymentMonitoring | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [controls, setControls] = React.useState<MonitoringControls>(
        DEFAULT_MONITORING_CONTROLS
    );
    const [pendingControls, setPendingControls] = React.useState<MonitoringControls>(
        DEFAULT_MONITORING_CONTROLS
    );
    const latestRequestIdRef = React.useRef(0);

    const redirectToLogin = React.useCallback(() => {
        clearAccessToken();
        const returnTo = pathname || "/admin";
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }, [pathname, router]);

    const loadMonitoring = React.useCallback(
        async (options: MonitoringControls) => {
            const token = getAccessToken();
            if (!token) {
                setLoading(false);
                redirectToLogin();
                return;
            }

            setLoading(true);
            setError("");
            const requestId = latestRequestIdRef.current + 1;
            latestRequestIdRef.current = requestId;

            try {
                const result = await fetchAdminDeploymentMonitoring(token, options);
                if (requestId !== latestRequestIdRef.current) {
                    return;
                }
                setMonitoring(result);
            } catch (err) {
                if (requestId !== latestRequestIdRef.current) {
                    return;
                }
                if (err instanceof ApiError && err.status === 401) {
                    redirectToLogin();
                    return;
                }
                if (err instanceof ApiError && err.status === 403) {
                    router.replace("/home");
                    return;
                }
                const message =
                    err instanceof Error
                        ? err.message
                        : "Could not load deployment monitoring.";
                setError(message);
            } finally {
                if (requestId === latestRequestIdRef.current) {
                    setLoading(false);
                }
            }
        },
        [redirectToLogin, router]
    );

    React.useEffect(() => {
        void loadMonitoring(controls);
    }, [controls, loadMonitoring]);

    React.useEffect(() => {
        if (!loading) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setLoading(false);
            setError((current) => current || "Request timed out. Please try again.");
        }, 16_000);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [loading]);

    if (loading) {
        return (
            <SectionCard>
                <SectionHeader
                    title="Deployment Monitoring"
                    subtitle="Loading deployment monitoring signals..."
                />
                <div className="admin-empty-state">
                    <p className="admin-subtle">
                        If this takes too long, retry the monitoring request.
                    </p>
                    <PrimaryButton onClick={() => void loadMonitoring(controls)}>
                        Retry Monitoring
                    </PrimaryButton>
                </div>
            </SectionCard>
        );
    }

    if (!monitoring) {
        return (
            <SectionCard>
                <SectionHeader
                    title="Deployment Monitoring"
                    subtitle="Could not load deployment monitoring data."
                />
                <div className="admin-empty-state">
                    <p>{error || "No deployment monitoring data available right now."}</p>
                    <PrimaryButton onClick={() => void loadMonitoring(controls)}>
                        Retry Monitoring
                    </PrimaryButton>
                </div>
            </SectionCard>
        );
    }

    const { summary, unassigned, longWaiting, inProgress, neglected, conflicts } =
        monitoring;

    const hasAnySignal =
        summary.unassigned > 0 ||
        summary.longWaiting > 0 ||
        summary.inProgress > 0 ||
        summary.neglected > 0 ||
        summary.conflicts > 0;

    const applyControls = () => {
        setControls(pendingControls);
    };

    const resetControls = () => {
        setPendingControls(DEFAULT_MONITORING_CONTROLS);
        setControls(DEFAULT_MONITORING_CONTROLS);
    };

    return (
        <div className="admin-overview-grid">
            {error ? (
                <SectionCard>
                    <p className="admin-error-text">
                        Showing previous data. Latest refresh failed: {error}
                    </p>
                </SectionCard>
            ) : null}

            <SectionCard>
                <SectionHeader
                    title="Monitoring Controls"
                    subtitle="Tune the wait and neglect thresholds used to flag deployment issues."
                />
                <div className="admin-history-filter-grid">
                    <label
                        className="admin-history-filter-label"
                        htmlFor="monitoring-wait-threshold"
                    >
                        Long-waiting threshold
                        <select
                            id="monitoring-wait-threshold"
                            className="admin-history-filter-input"
                            value={pendingControls.waitThresholdHours}
                            onChange={(event) =>
                                setPendingControls((current) => ({
                                    ...current,
                                    waitThresholdHours: Number(event.target.value),
                                }))
                            }
                        >
                            <option value={1}>1 hour</option>
                            <option value={3}>3 hours</option>
                            <option value={6}>6 hours</option>
                            <option value={12}>12 hours</option>
                            <option value={24}>24 hours</option>
                        </select>
                    </label>

                    <label
                        className="admin-history-filter-label"
                        htmlFor="monitoring-neglect-threshold"
                    >
                        Neglect threshold
                        <select
                            id="monitoring-neglect-threshold"
                            className="admin-history-filter-input"
                            value={pendingControls.neglectThresholdHours}
                            onChange={(event) =>
                                setPendingControls((current) => ({
                                    ...current,
                                    neglectThresholdHours: Number(event.target.value),
                                }))
                            }
                        >
                            <option value={6}>6 hours</option>
                            <option value={12}>12 hours</option>
                            <option value={24}>24 hours</option>
                            <option value={48}>48 hours</option>
                            <option value={72}>72 hours</option>
                        </select>
                    </label>

                    <label
                        className="admin-history-filter-label"
                        htmlFor="monitoring-list-limit"
                    >
                        List size
                        <select
                            id="monitoring-list-limit"
                            className="admin-history-filter-input"
                            value={pendingControls.listLimit}
                            onChange={(event) =>
                                setPendingControls((current) => ({
                                    ...current,
                                    listLimit: Number(event.target.value),
                                }))
                            }
                        >
                            <option value={5}>Top 5</option>
                            <option value={10}>Top 10</option>
                            <option value={20}>Top 20</option>
                        </select>
                    </label>
                </div>

                <div className="admin-history-actions">
                    <PrimaryButton onClick={applyControls} loading={loading}>
                        Apply Controls
                    </PrimaryButton>
                    <SecondaryButton onClick={resetControls} disabled={loading}>
                        Reset Defaults
                    </SecondaryButton>
                </div>
            </SectionCard>

            {!hasAnySignal ? (
                <SectionCard>
                    <SectionHeader
                        title="Deployment Monitoring"
                        subtitle="No deployment issues detected for the selected thresholds."
                    />
                    <p className="admin-subtle">
                        All active emergencies appear assigned within healthy time bounds.
                    </p>
                </SectionCard>
            ) : (
                <>
                    <SectionCard>
                        <SectionHeader
                            title="Signal Summary"
                            subtitle="Counts use the thresholds above. Lists below show the top items."
                        />
                        <div className="admin-metric-grid">
                            <SummaryTile
                                label="Unassigned"
                                value={summary.unassigned}
                                tone={summary.unassigned > 0 ? "warning" : "default"}
                                description="Pending without an active assignment"
                            />
                            <SummaryTile
                                label="Long-waiting"
                                value={summary.longWaiting}
                                tone={summary.longWaiting > 0 ? "danger" : "default"}
                                description={`Pending older than ${monitoring.thresholds.waitThresholdHours}h`}
                            />
                            <SummaryTile
                                label="In progress"
                                value={summary.inProgress}
                                tone="default"
                                description="Active assignments right now"
                            />
                            <SummaryTile
                                label="Neglected"
                                value={summary.neglected}
                                tone={summary.neglected > 0 ? "danger" : "default"}
                                description={`Assigned more than ${monitoring.thresholds.neglectThresholdHours}h ago`}
                            />
                            <SummaryTile
                                label="Possible duplicates"
                                value={summary.conflicts}
                                tone={summary.conflicts > 0 ? "warning" : "default"}
                                description="Conflicting / duplicate active reports"
                            />
                        </div>
                    </SectionCard>

                    <SectionCard>
                        <SectionHeader
                            title="Unassigned Emergencies"
                            subtitle="Pending requests that have not been assigned to a volunteer yet."
                        />
                        <ItemsTable
                            items={unassigned}
                            emptyText="No unassigned pending emergencies."
                        />
                    </SectionCard>

                    <SectionCard>
                        <SectionHeader
                            title="Long-waiting Emergencies"
                            subtitle={`Pending emergencies older than ${monitoring.thresholds.waitThresholdHours} hours.`}
                        />
                        <ItemsTable
                            items={longWaiting}
                            emptyText="No long-waiting emergencies for this threshold."
                        />
                    </SectionCard>

                    <SectionCard>
                        <SectionHeader
                            title="Assigned / In-progress Emergencies"
                            subtitle="Active assignments ordered by oldest assignment first."
                        />
                        <ItemsTable
                            items={inProgress}
                            emptyText="No active assignments right now."
                        />
                    </SectionCard>

                    <SectionCard>
                        <SectionHeader
                            title="Potentially Neglected Emergencies"
                            subtitle={`Active assignments untouched for more than ${monitoring.thresholds.neglectThresholdHours} hours.`}
                        />
                        <ItemsTable
                            items={neglected}
                            emptyText="No neglected assignments for this threshold."
                        />
                    </SectionCard>

                    <SectionCard>
                        <SectionHeader
                            title="Conflicting / Duplicate Reports"
                            subtitle="Active emergencies grouped by city, type and contact within the last 24 hours."
                        />
                        {conflicts.length === 0 ? (
                            <p className="admin-subtle">
                                No conflicting or duplicate reports detected.
                            </p>
                        ) : (
                            <div className="admin-conflict-list">
                                {conflicts.map((group) => (
                                    <ConflictGroupCard
                                        key={`${group.groupKey.city}-${group.groupKey.needType}-${group.groupKey.contactKey}`}
                                        group={group}
                                    />
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </>
            )}
        </div>
    );
}
