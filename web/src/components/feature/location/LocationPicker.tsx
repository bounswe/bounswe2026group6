"use client";

import * as React from "react";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { HelperText } from "@/components/ui/display/HelperText";
import { LocationPickerMap } from "@/components/feature/location/LocationPickerMap";
import { reverseLocation, searchLocations } from "@/lib/location";
import { LocationSearchItem } from "@/types/location";

type LocationPickerValue = {
    placeId: string;
    displayName: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    source?: string | null;
    capturedAt?: string | null;
    administrative: LocationSearchItem["administrative"];
};

type LocationPickerProps = {
    countryCode?: string;
    value: LocationPickerValue | null;
    onChange: (value: LocationPickerValue | null) => void;
    label?: string;
};

const DEFAULT_CENTER = {
    latitude: 39.0,
    longitude: 35.0,
};

function toPickerValue(item: LocationSearchItem): LocationPickerValue {
    return {
        placeId: item.placeId,
        displayName: item.displayName,
        latitude: item.latitude,
        longitude: item.longitude,
        accuracyMeters: null,
        source: "search",
        capturedAt: new Date().toISOString(),
        administrative: item.administrative,
    };
}

function toManualPickerValue(latitude: number, longitude: number): LocationPickerValue {
    const normalizedLatitude = latitude.toFixed(6);
    const normalizedLongitude = longitude.toFixed(6);

    return {
        placeId: `manual:${normalizedLatitude},${normalizedLongitude}`,
        displayName: `Pinned location (${normalizedLatitude}, ${normalizedLongitude})`,
        latitude,
        longitude,
        accuracyMeters: null,
        source: "map_pin",
        capturedAt: new Date().toISOString(),
        administrative: {},
    };
}

function mapGeolocationError(geoError: GeolocationPositionError) {
    switch (geoError.code) {
        case geoError.PERMISSION_DENIED:
            return "Location permission was denied. Enable location access in your browser settings.";
        case geoError.POSITION_UNAVAILABLE:
            return "Current location is unavailable right now. Please try again or select from map.";
        case geoError.TIMEOUT:
            return "Location request timed out. Please try again.";
        default:
            return geoError.message || "Could not access current location.";
    }
}

export function LocationPicker({
    countryCode = "TR",
    value,
    onChange,
    label = "Select location from map",
}: LocationPickerProps) {
    const searchInputId = React.useId();
    const [query, setQuery] = React.useState("");
    const [searching, setSearching] = React.useState(false);
    const [resolving, setResolving] = React.useState(false);
    const [results, setResults] = React.useState<LocationSearchItem[]>([]);
    const [error, setError] = React.useState("");
    const skipNextSearchRef = React.useRef(false);
    const searchRequestIdRef = React.useRef(0);
    const reverseRequestIdRef = React.useRef(0);

    const center = value
        ? { latitude: value.latitude, longitude: value.longitude }
        : DEFAULT_CENTER;

    const handleSearch = React.useCallback(async () => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }

        if (skipNextSearchRef.current) {
            skipNextSearchRef.current = false;
            return;
        }

        const currentSearchRequestId = ++searchRequestIdRef.current;

        try {
            setSearching(true);
            setError("");

            const response = await searchLocations({
                q: query.trim(),
                countryCode,
                limit: 10,
            });

            if (currentSearchRequestId !== searchRequestIdRef.current) {
                return;
            }

            setResults(response.items);
        } catch (err) {
            if (currentSearchRequestId !== searchRequestIdRef.current) {
                return;
            }

            setError(err instanceof Error ? err.message : "Could not search locations.");
        } finally {
            if (currentSearchRequestId === searchRequestIdRef.current) {
                setSearching(false);
            }
        }
    }, [countryCode, query]);

    const handleResolveCoordinates = React.useCallback(
        async (
            latitude: number,
            longitude: number,
            metadata?: {
                source?: string | null;
                accuracyMeters?: number | null;
                capturedAt?: string | null;
            }
        ) => {
            const currentReverseRequestId = ++reverseRequestIdRef.current;

            try {
                setResolving(true);
                setError("");

                const response = await reverseLocation({ latitude, longitude });

                if (currentReverseRequestId !== reverseRequestIdRef.current) {
                    return;
                }

                onChange({
                    ...toPickerValue(response.item),
                    source: metadata?.source ?? "map_pin",
                    accuracyMeters: metadata?.accuracyMeters ?? null,
                    capturedAt: metadata?.capturedAt ?? new Date().toISOString(),
                });
            } catch (err) {
                if (currentReverseRequestId !== reverseRequestIdRef.current) {
                    return;
                }

                setError(err instanceof Error ? err.message : "Could not resolve selected location.");
                onChange({
                    ...toManualPickerValue(latitude, longitude),
                    source: metadata?.source ?? "map_pin",
                    accuracyMeters: metadata?.accuracyMeters ?? null,
                    capturedAt: metadata?.capturedAt ?? new Date().toISOString(),
                });
            } finally {
                if (currentReverseRequestId === reverseRequestIdRef.current) {
                    setResolving(false);
                }
            }
        },
        [onChange]
    );

    const handleUseCurrentLocation = React.useCallback(() => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported in this browser.");
            return;
        }

        const requestLocation = () => {
            setError("");
            setResolving(true);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    onChange({
                        ...toManualPickerValue(
                            position.coords.latitude,
                            position.coords.longitude
                        ),
                        source: "current_device",
                        accuracyMeters:
                            typeof position.coords.accuracy === "number"
                                ? position.coords.accuracy
                                : null,
                        capturedAt: new Date(position.timestamp).toISOString(),
                    });

                    void handleResolveCoordinates(
                        position.coords.latitude,
                        position.coords.longitude,
                        {
                            source: "current_device",
                            accuracyMeters:
                                typeof position.coords.accuracy === "number"
                                    ? position.coords.accuracy
                                    : null,
                            capturedAt: new Date(position.timestamp).toISOString(),
                        }
                    );
                },
                (geoError) => {
                    setResolving(false);
                    setError(mapGeolocationError(geoError));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                }
            );
        };

        if (!navigator.permissions?.query) {
            requestLocation();
            return;
        }

        void navigator.permissions
            .query({ name: "geolocation" })
            .then((permissionStatus) => {
                if (permissionStatus.state === "denied") {
                    setError(
                        "Location permission is denied. Enable location access in your browser settings."
                    );
                    return;
                }

                requestLocation();
            })
            .catch(() => {
                requestLocation();
            });
    }, [handleResolveCoordinates]);

    React.useEffect(() => {
        const timeout = setTimeout(() => {
            void handleSearch();
        }, 350);

        return () => clearTimeout(timeout);
    }, [handleSearch]);

    return (
        <div className="location-picker-wrap flex flex-col gap-3">
            <HelperText className="text-sm text-[#2b2b33]">{label}</HelperText>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <TextInput
                    id={searchInputId}
                    label="Search location"
                    placeholder="Search location"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />

                <PrimaryButton
                    type="button"
                    className="sm:w-52"
                    onClick={handleUseCurrentLocation}
                    loading={resolving}
                >
                    Use Current Location
                </PrimaryButton>
            </div>

            {results.length > 0 ? (
                <div className="max-h-44 overflow-auto rounded-[10px] border border-[#e7e7ea] bg-white">
                    {results.map((item) => (
                        <button
                            key={`${item.placeId}-${item.latitude}-${item.longitude}`}
                            type="button"
                            className="w-full border-b border-[#f0f0f2] px-3 py-2 text-left text-sm text-[#2b2b33] transition-colors hover:bg-[#fafafa]"
                            onClick={() => {
                                onChange({
                                    ...toPickerValue(item),
                                    source: "search",
                                    capturedAt: new Date().toISOString(),
                                });
                                skipNextSearchRef.current = true;
                                setResults([]);
                                setQuery(item.displayName);
                            }}
                        >
                            {item.displayName}
                        </button>
                    ))}
                </div>
            ) : null}

            <LocationPickerMap
                center={center}
                selectedPosition={
                    value
                        ? {
                            latitude: value.latitude,
                            longitude: value.longitude,
                        }
                        : null
                }
                onSelectPosition={(position) => {
                    onChange({
                        ...toManualPickerValue(position.latitude, position.longitude),
                        source: "map_pin",
                        accuracyMeters: null,
                        capturedAt: new Date().toISOString(),
                    });

                    void handleResolveCoordinates(position.latitude, position.longitude, {
                        source: "map_pin",
                        accuracyMeters: null,
                    });
                }}
            />

            {searching ? <HelperText>Searching locations...</HelperText> : null}
            {resolving ? <HelperText>Resolving selected coordinates...</HelperText> : null}

            {value ? (
                <HelperText>
                    Selected: {value.displayName || `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}`}
                </HelperText>
            ) : null}

            {error ? <HelperText className="text-red-500">{error}</HelperText> : null}
        </div>
    );
}

export type { LocationPickerValue };
