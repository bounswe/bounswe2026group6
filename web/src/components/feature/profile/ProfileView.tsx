"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/media/Avatar";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { SelectInput } from "@/components/ui/inputs/SelectInput";
import { TextArea } from "@/components/ui/inputs/TextArea";
import { ToggleSwitch } from "@/components/ui/selection/ToggleSwitch";
import { Checkbox } from "@/components/ui/selection/Checkbox";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { HelperText } from "@/components/ui/display/HelperText";
import {
    LocationPicker,
    LocationPickerValue,
    StreetAddressInput,
} from "@/components/feature/location";
import { bloodTypeOptions } from "@/lib/bloodTypes";
import { countryCodeOptions } from "@/lib/countryCodes";
import { expertiseOptions, professionOptions } from "@/lib/profileOptions";
import { clearAccessToken, fetchCurrentUser, getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { fetchLocationTree, searchLocations } from "@/lib/location";
import {
    findCityKeyByLabel,
    findCountryKeyByLabel,
    findDistrictKeyByLabel,
    findNeighborhoodValueByLabel,
    LocationTreeByCountry,
    parseLocationAddress,
    resolvePickerLocation,
} from "@/lib/locationTree";
import {
    BackendProfileResponse,
    EditableProfileData,
    buildAddress,
    fetchMyProfile,
    mapBackendProfileToEditableProfile,
    parseListField,
    patchMyProfile,
    patchMyHealth,
    patchMyLocation,
    patchMyPhysical,
    patchMyPrivacy,
    patchMyProfession,
    validateExpertiseAreas,
    putMyExpertiseAreas,
} from "@/lib/profile";
type EmptyStateAction = "login" | "complete-profile" | null;
type ProfileData = EditableProfileData;

const FRESH_DEVICE_CAPTURE_MAX_AGE_MS = 5 * 60 * 1000;

function isFreshCurrentDeviceSelection(value: LocationPickerValue | null) {
    if (!value || value.source !== "current_device") {
        return false;
    }

    if (!value.capturedAt) {
        return false;
    }

    const capturedAtMs = Date.parse(value.capturedAt);
    if (Number.isNaN(capturedAtMs)) {
        return false;
    }

    return Date.now() - capturedAtMs <= FRESH_DEVICE_CAPTURE_MAX_AGE_MS;
}

function toPickerValueFromSearchItem(item: {
    placeId: string;
    displayName: string;
    latitude: number;
    longitude: number;
    administrative: LocationPickerValue["administrative"];
}): LocationPickerValue {
    return {
        placeId: item.placeId,
        displayName: item.displayName,
        latitude: item.latitude,
        longitude: item.longitude,
        source: "dropdown_sync",
        capturedAt: new Date().toISOString(),
        accuracyMeters: null,
        administrative: item.administrative,
    };
}


function toProfileData(
    backendProfile: BackendProfileResponse,
    email: string,
    locationTree: LocationTreeByCountry
): ProfileData {
    const mapped = mapBackendProfileToEditableProfile(backendProfile, email);
    const countryKey = findCountryKeyByLabel(locationTree, mapped.country);
    const cityKey = countryKey
        ? findCityKeyByLabel(locationTree, countryKey, mapped.city)
        : "";
    const parsedAddress = parseLocationAddress(
        locationTree,
        countryKey,
        cityKey,
        mapped.extraAddress
    );

    return {
        ...mapped,
        country: countryKey || mapped.country,
        city: cityKey || mapped.city,
        district: parsedAddress.district,
        neighborhood: parsedAddress.neighborhood,
        extraAddress: parsedAddress.extraAddress,
    };
}

export default function ProfileView() {
    const router = useRouter();
    const [profile, setProfile] = React.useState<ProfileData | null>(null);
    const [locationTree, setLocationTree] = React.useState<LocationTreeByCountry>({});
    const [locationTreeError, setLocationTreeError] = React.useState("");
    const [locationPickerValue, setLocationPickerValue] =
        React.useState<LocationPickerValue | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");
    const [initialShareLocation, setInitialShareLocation] =
        React.useState(false);
    const [emptyStateAction, setEmptyStateAction] =
        React.useState<EmptyStateAction>(null);
    const dropdownSyncRequestIdRef = React.useRef(0);

    const refreshProfileFromBackend = React.useCallback(
        async (token: string, activeLocationTree: LocationTreeByCountry) => {
            const [user, backendProfile] = await Promise.all([
                fetchCurrentUser(token),
                fetchMyProfile(token),
            ]);

            setInitialShareLocation(
                backendProfile.privacySettings.locationSharingEnabled
            );

            setProfile((currentProfile) => {
                const refreshedProfile = toProfileData(
                    backendProfile,
                    user.email,
                    activeLocationTree
                );

                if (
                    backendProfile.locationProfile.latitude !== null &&
                    backendProfile.locationProfile.longitude !== null
                ) {
                    setLocationPickerValue({
                        placeId:
                            backendProfile.locationProfile.placeId ??
                            "profile:location",
                        displayName:
                            backendProfile.locationProfile.displayAddress ??
                            ([
                                backendProfile.locationProfile.city,
                                backendProfile.locationProfile.country,
                            ]
                                .filter(Boolean)
                                .join(", ") || "Current profile location"),
                        latitude: backendProfile.locationProfile.latitude,
                        longitude: backendProfile.locationProfile.longitude,
                        administrative: {
                            country: backendProfile.locationProfile.country,
                            city: backendProfile.locationProfile.city,
                            district: refreshedProfile.district,
                            neighborhood: refreshedProfile.neighborhood,
                            extraAddress: refreshedProfile.extraAddress,
                            postalCode:
                                backendProfile.locationProfile.administrative?.postalCode ??
                                null,
                        },
                        source:
                            backendProfile.locationProfile.coordinate?.source ??
                            "profile_saved",
                        capturedAt:
                            backendProfile.locationProfile.coordinate?.capturedAt ??
                            backendProfile.locationProfile.lastUpdated,
                        accuracyMeters:
                            backendProfile.locationProfile.coordinate?.accuracyMeters ??
                            null,
                    });
                }

                return currentProfile
                    ? {
                        ...refreshedProfile,
                    }
                    : refreshedProfile;
            });
        },
        []
    );

    React.useEffect(() => {
        async function loadProfile() {
            const token = getAccessToken();

            if (!token) {
                setError("Please log in to view your profile.");
                setEmptyStateAction("login");
                setLoading(false);
                return;
            }

            try {
                const [user, backendProfile] = await Promise.all([
                    fetchCurrentUser(token),
                    fetchMyProfile(token),
                ]);

                const mappedProfile = toProfileData(
                    backendProfile,
                    user.email,
                    {}
                );

                setProfile(mappedProfile);
                setInitialShareLocation(
                    backendProfile.privacySettings.locationSharingEnabled
                );
                if (
                    backendProfile.locationProfile.latitude !== null &&
                    backendProfile.locationProfile.longitude !== null
                ) {
                    setLocationPickerValue({
                        placeId:
                            backendProfile.locationProfile.placeId ??
                            "profile:location",
                        displayName:
                            backendProfile.locationProfile.displayAddress ??
                            ([
                                backendProfile.locationProfile.city,
                                backendProfile.locationProfile.country,
                            ]
                                .filter(Boolean)
                                .join(", ") || "Current profile location"),
                        latitude: backendProfile.locationProfile.latitude,
                        longitude: backendProfile.locationProfile.longitude,
                        administrative: {
                            country: backendProfile.locationProfile.country,
                            city: backendProfile.locationProfile.city,
                            district: mappedProfile.district,
                            neighborhood: mappedProfile.neighborhood,
                            extraAddress: mappedProfile.extraAddress,
                            postalCode:
                                backendProfile.locationProfile.administrative?.postalCode ??
                                null,
                        },
                        source:
                            backendProfile.locationProfile.coordinate?.source ??
                            "profile_saved",
                        capturedAt:
                            backendProfile.locationProfile.coordinate?.capturedAt ??
                            backendProfile.locationProfile.lastUpdated,
                        accuracyMeters:
                            backendProfile.locationProfile.coordinate?.accuracyMeters ??
                            null,
                    });
                }

                setEmptyStateAction(null);

                try {
                    const treeResponse = await fetchLocationTree("TR");
                    const nextLocationTree = {
                        [treeResponse.countryCode.toLowerCase()]: treeResponse.tree,
                    };

                    setLocationTree(nextLocationTree);
                    setLocationTreeError("");

                    // Rehydrate picker+form location state after the tree is available
                    // so district/neighborhood keys are resolved consistently.
                    await refreshProfileFromBackend(token, nextLocationTree);
                } catch (treeError) {
                    setLocationTree({});
                    setLocationTreeError(
                        treeError instanceof Error
                            ? treeError.message
                            : "Could not load location tree."
                    );
                }
            } catch (err) {
                if (err instanceof ApiError && err.status === 401) {
                    clearAccessToken();
                    setError("Your session has expired. Please log in again.");
                    setEmptyStateAction("login");
                } else if (err instanceof ApiError && err.status === 404) {
                    setProfile(null);
                    setError("");
                    setEmptyStateAction("complete-profile");
                } else {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Could not load your profile."
                    );
                    setEmptyStateAction(null);
                }
            } finally {
                setLoading(false);
            }
        }

        void loadProfile();
    }, []);

    const applyPickerToProfile = React.useCallback(
        (picker: LocationPickerValue) => {
            if (!Object.keys(locationTree).length) {
                return;
            }

            const resolved = resolvePickerLocation(
                locationTree,
                picker.administrative,
                picker.displayName || ""
            );

            setProfile((currentProfile) => {
                if (!currentProfile) {
                    return currentProfile;
                }

                return {
                    ...currentProfile,
                    country: resolved.countryKey || currentProfile.country,
                    city: resolved.cityKey || currentProfile.city,
                    district: resolved.districtKey || currentProfile.district,
                    neighborhood:
                        resolved.neighborhoodValue || currentProfile.neighborhood,
                    extraAddress: resolved.extraAddress || currentProfile.extraAddress,
                };
            });
        },
        [locationTree]
    );

    const handleLocationPickerChange = React.useCallback(
        (next: LocationPickerValue | null) => {
            setLocationPickerValue(next);

            if (!next) {
                return;
            }

            applyPickerToProfile(next);
        },
        [applyPickerToProfile]
    );

    const syncPickerFromProfile = React.useCallback(
        (nextProfile: ProfileData) => {
            const countryKey = findCountryKeyByLabel(locationTree, nextProfile.country);
            const cityKey = findCityKeyByLabel(
                locationTree,
                countryKey,
                nextProfile.city
            );

            if (!countryKey || !cityKey) {
                return;
            }

            const selectedCountry = locationTree[countryKey];
            const selectedCity = selectedCountry?.cities[cityKey];

            if (!selectedCountry || !selectedCity) {
                return;
            }

            const districtKey = findDistrictKeyByLabel(
                locationTree,
                countryKey,
                cityKey,
                nextProfile.district
            );
            const selectedDistrict = districtKey
                ? selectedCity.districts[districtKey]
                : undefined;
            const selectedNeighborhood =
                nextProfile.neighborhood && selectedDistrict
                    ? selectedDistrict.neighborhoods.find(
                        (item) => item.value === nextProfile.neighborhood
                    )
                    : undefined;

            const query = [
                selectedNeighborhood?.label,
                selectedDistrict?.label,
                selectedCity.label,
                selectedCountry.label,
            ]
                .filter(Boolean)
                .join(", ");

            if (!query) {
                return;
            }

            const currentRequestId = ++dropdownSyncRequestIdRef.current;

            void (async () => {
                try {
                    const response = await searchLocations({
                        q: query,
                        countryCode: countryKey.toUpperCase() || "TR",
                        limit: 1,
                    });

                    if (currentRequestId !== dropdownSyncRequestIdRef.current) {
                        return;
                    }

                    const first = response.items[0];
                    if (!first) {
                        return;
                    }

                    setLocationPickerValue(toPickerValueFromSearchItem(first));
                } catch {
                    // Keep current picker; dropdown selection still wins on save.
                }
            })();
        },
        [locationTree]
    );

    const updateLocationField = React.useCallback(
        (patch: Partial<ProfileData>) => {
            setProfile((currentProfile) => {
                if (!currentProfile) {
                    return currentProfile;
                }

                const nextProfile = { ...currentProfile, ...patch };
                syncPickerFromProfile(nextProfile);
                return nextProfile;
            });
        },
        [syncPickerFromProfile]
    );

    const handleSave = async () => {
        if (!profile) {
            return;
        }

        const normalizedFirstName = profile.firstName.trim();
        const normalizedLastName = profile.lastName.trim();
        const normalizedPhone = profile.phone.trim().replace(/\D/g, "");

        if (!normalizedFirstName) {
            setError("Please enter your first name.");
            return;
        }

        if (!normalizedLastName) {
            setError("Please enter your last name.");
            return;
        }

        const expertiseAreas = profile.expertise.filter((area) =>
            expertiseOptions.includes(area)
        );
        const expertiseValidationError = validateExpertiseAreas(expertiseAreas);

        if (expertiseValidationError) {
            setError(expertiseValidationError);
            return;
        }

        if (
            !initialShareLocation &&
            profile.shareLocation &&
            !isFreshCurrentDeviceSelection(locationPickerValue)
        ) {
            setError(
                "To enable Share Current Location, click Use Current Location first so we can save a fresh device location."
            );
            return;
        }

        const token = getAccessToken();

        if (!token) {
            setError("Please log in to save your profile.");
            router.push("/login");
            return;
        }

        try {
            setSaving(true);
            setError("");
            setInfo("");

            await patchMyProfile(token, {
                firstName: normalizedFirstName,
                lastName: normalizedLastName,
                phoneNumber: normalizedPhone
                    ? `${(profile.countryCode || "").trim()}${normalizedPhone}`
                    : null,
            });

            const saveCountryKey = findCountryKeyByLabel(locationTree, profile.country);
            const saveCityKey = findCityKeyByLabel(
                locationTree,
                saveCountryKey,
                profile.city
            );
            const saveDistrictKey = findDistrictKeyByLabel(
                locationTree,
                saveCountryKey,
                saveCityKey,
                profile.district
            );

            const countryData = saveCountryKey ? locationTree[saveCountryKey] : undefined;
            const districtLabel =
                countryData?.cities[saveCityKey]?.districts[saveDistrictKey]?.label ||
                locationPickerValue?.administrative.district ||
                profile.district;
            const neighborhoodLabel =
                countryData?.cities[saveCityKey]?.districts[saveDistrictKey]?.neighborhoods.find(
                    (item) => item.value === profile.neighborhood
                )?.label ||
                locationPickerValue?.administrative.neighborhood ||
                profile.neighborhood;
            const hasCoordinateSelection =
                typeof locationPickerValue?.latitude === "number" &&
                typeof locationPickerValue?.longitude === "number";
            const resolvedCountryLabel =
                countryData?.label ||
                locationPickerValue?.administrative.country ||
                profile.country ||
                null;
            const resolvedCityLabel =
                countryData?.cities[saveCityKey]?.label ||
                locationPickerValue?.administrative.city ||
                profile.city ||
                null;
            const resolvedExtraAddress =
                profile.extraAddress ||
                locationPickerValue?.administrative.extraAddress ||
                "";
            const resolvedCountryCode =
                (locationPickerValue?.administrative.countryCode || "").trim().toUpperCase() ||
                (saveCountryKey || "").trim().toUpperCase() ||
                null;
            const resolvedAddress =
                buildAddress({
                    district: districtLabel,
                    neighborhood: neighborhoodLabel,
                    extraAddress: resolvedExtraAddress,
                }) || null;

            await patchMyPhysical(token, {
                dateOfBirth: profile.dateOfBirth || null,
                gender: profile.gender || null,
                height: profile.height ? Number(profile.height) : undefined,
                weight: profile.weight ? Number(profile.weight) : undefined,
            });

            await patchMyHealth(token, {
                medicalConditions: parseListField(profile.medicalHistory),
                chronicDiseases: parseListField(profile.chronicDiseases),
                allergies: parseListField(profile.allergies),
                bloodType: profile.bloodType || null,
            });

            await patchMyLocation(token, {
                country: resolvedCountryLabel,
                city: resolvedCityLabel,
                address: resolvedAddress,
                latitude: hasCoordinateSelection
                    ? locationPickerValue.latitude
                    : undefined,
                longitude: hasCoordinateSelection
                    ? locationPickerValue.longitude
                    : undefined,
                displayAddress: locationPickerValue?.displayName ?? undefined,
                placeId: locationPickerValue?.placeId ?? undefined,
                administrative: {
                    countryCode: resolvedCountryCode,
                    country: resolvedCountryLabel,
                    city: resolvedCityLabel,
                    district: districtLabel || null,
                    neighborhood: neighborhoodLabel || null,
                    extraAddress: resolvedExtraAddress || null,
                    postalCode: locationPickerValue?.administrative.postalCode ?? null,
                },
                coordinate: hasCoordinateSelection
                    ? {
                        latitude: locationPickerValue.latitude,
                        longitude: locationPickerValue.longitude,
                        accuracyMeters: locationPickerValue.accuracyMeters ?? null,
                        source: locationPickerValue.source ?? "profile_form",
                        capturedAt:
                            locationPickerValue.capturedAt ??
                            new Date().toISOString(),
                    }
                    : undefined,
            });

            await patchMyPrivacy(token, {
                locationSharingEnabled: profile.shareLocation,
            });

            await patchMyProfession(token, {
                profession: profile.profession.trim() || null,
            });

            await putMyExpertiseAreas(token, {
                expertiseAreas,
            });

            await refreshProfileFromBackend(token, locationTree);

            setInfo("Profile updated successfully.");
        } catch (err) {
            try {
                await refreshProfileFromBackend(token, locationTree);
            } catch {
            }

            const baseMessage =
                err instanceof Error && err.message
                    ? err.message
                    : "Could not save your profile.";

            setError(
                `${baseMessage} Some sections may already be saved because the backend currently updates profile data in separate requests. Please review your profile and try again.`
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <p className="text-sm text-gray-500">Loading...</p>;
    }

    if (!profile) {
        return (
            <div className="flex max-w-md flex-col gap-4">
                <HelperText className="text-sm text-gray-500">
                    {error || "No profile data found."}
                </HelperText>

                {emptyStateAction === "login" ? (
                    <PrimaryButton onClick={() => router.push("/login")}>
                        Log In
                    </PrimaryButton>
                ) : null}

                {emptyStateAction === "complete-profile" ? (
                    <PrimaryButton onClick={() => router.push("/complete-profile")}>
                        Complete Profile
                    </PrimaryButton>
                ) : null}
            </div>
        );
    }

    const resolvedCountryKey = findCountryKeyByLabel(locationTree, profile.country);
    const resolvedCityKey = findCityKeyByLabel(
        locationTree,
        resolvedCountryKey,
        profile.city
    );
    const resolvedDistrictKey = findDistrictKeyByLabel(
        locationTree,
        resolvedCountryKey,
        resolvedCityKey,
        profile.district
    );

    const countryData = resolvedCountryKey ? locationTree[resolvedCountryKey] : undefined;

    const countryOptions = Object.entries(locationTree).map(([key, value]) => ({
        label: value.label,
        value: key,
    }));

    const cityOptions = countryData
        ? Object.entries(countryData.cities).map(([key, value]) => ({
            label: value.label,
            value: key,
        }))
        : [];

    const districtOptions =
        resolvedCityKey && countryData?.cities[resolvedCityKey]
            ? Object.entries(countryData.cities[resolvedCityKey].districts).map(
                ([key, value]) => ({
                    label: value.label,
                    value: key,
                })
            )
            : [];

    const neighborhoodOptions =
        resolvedCityKey &&
            resolvedDistrictKey &&
            countryData?.cities[resolvedCityKey]?.districts[resolvedDistrictKey]
            ? countryData.cities[resolvedCityKey].districts[resolvedDistrictKey].neighborhoods
            : [];

    const resolvedNeighborhoodValue = findNeighborhoodValueByLabel(
        neighborhoodOptions,
        profile.neighborhood
    );

    return (
        <div className="flex gap-10">
            <div className="flex w-64 flex-col items-center gap-4">
                <Avatar size="lg" />
                <div className="text-center">
                    <h2 className="text-lg font-semibold">
                        {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "User"}
                    </h2>
                    <p className="text-sm text-gray-500">{profile.email || "No email"}</p>
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-6">
                <SectionCard>
                    <SectionHeader title="Account Information" />
                    <p className="mb-3 text-xs text-gray-400">
                        Your contact details are used for account access and emergency
                        communication.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <TextInput
                            id="firstName"
                            label="First Name"
                            value={profile.firstName}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, firstName: e.target.value }
                                        : currentProfile
                                )
                            }
                        />
                        <TextInput
                            id="lastName"
                            label="Last Name"
                            value={profile.lastName}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, lastName: e.target.value }
                                        : currentProfile
                                )
                            }
                        />
                    </div>

                    <div className="mt-4 grid grid-cols-[120px_1fr] gap-3">
                        <SelectInput
                            id="profile-country-code"
                            label="Code"
                            value={profile.countryCode}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, countryCode: e.target.value }
                                        : currentProfile
                                )
                            }
                            options={countryCodeOptions}
                        />

                        <TextInput
                            id="phone"
                            label="Phone Number"
                            type="tel"
                            inputMode="numeric"
                            value={profile.phone}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? {
                                            ...currentProfile,
                                            phone: e.target.value.replace(/\D/g, ""),
                                        }
                                        : currentProfile
                                )
                            }
                        />
                    </div>

                    <div className="mt-4 flex justify-between text-sm">
                        <span className="text-gray-500">Email</span>
                        <span>{profile.email || "-"}</span>
                    </div>
                </SectionCard>

                <SectionCard>
                    <SectionHeader title="Physical Information" />
                    <p className="mb-3 text-xs text-gray-400">
                        This information helps responders assess your physical condition in
                        emergencies.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <TextInput
                            id="height"
                            label="Height (cm)"
                            value={profile.height}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, height: e.target.value }
                                        : currentProfile
                                )
                            }
                        />
                        <TextInput
                            id="weight"
                            label="Weight (kg)"
                            value={profile.weight}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, weight: e.target.value }
                                        : currentProfile
                                )
                            }
                        />
                        <SelectInput
                            id="gender"
                            label="Gender"
                            value={profile.gender}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, gender: e.target.value }
                                        : currentProfile
                                )
                            }
                            options={[
                                { label: "Select", value: "" },
                                { label: "Male", value: "male" },
                                { label: "Female", value: "female" },
                                { label: "Other", value: "other" },
                            ]}
                        />
                        <div>
                            <TextInput
                                id="dateOfBirth"
                                label="Date of Birth"
                                type="date"
                                max={new Date().toISOString().slice(0, 10)}
                                value={profile.dateOfBirth}
                                onChange={(e) =>
                                    setProfile((currentProfile) =>
                                        currentProfile
                                            ? {
                                                ...currentProfile,
                                                dateOfBirth: e.target.value,
                                            }
                                            : currentProfile
                                    )
                                }
                            />
                        </div>
                    </div>
                </SectionCard>

                <SectionCard>
                    <SectionHeader title="Profession" />
                    <p className="mb-3 text-xs text-gray-400">
                        Your profession and expertise help with community coordination.
                    </p>

                    <div className="flex flex-col gap-4">
                        <SelectInput
                            id="profession"
                            label="Profession"
                            value={profile.profession}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, profession: e.target.value }
                                        : currentProfile
                                )
                            }
                            options={professionOptions}
                        />

                        <div className="flex flex-col gap-3">
                            <p className="text-sm font-medium text-gray-800">
                                Expertise (optional)
                            </p>
                            {expertiseOptions.map((option) => (
                                <Checkbox
                                    key={option}
                                    id={`profile-expertise-${option}`}
                                    label={option}
                                    checked={profile.expertise.includes(option)}
                                    onCheckedChange={(checked) =>
                                        setProfile((currentProfile) =>
                                            currentProfile
                                                ? {
                                                    ...currentProfile,
                                                    expertise: checked
                                                        ? [...currentProfile.expertise, option]
                                                        : currentProfile.expertise.filter(
                                                            (item) => item !== option
                                                        ),
                                                }
                                                : currentProfile
                                        )
                                    }
                                />
                            ))}
                        </div>
                    </div>
                </SectionCard>

                <SectionCard>
                    <SectionHeader title="Medical Information" />
                    <p className="mb-3 text-xs text-gray-400">
                        In emergency situations, this information may help responders make
                        faster and safer medical decisions.
                    </p>

                    <div className="flex flex-col gap-4">
                        <SelectInput
                            id="bloodType"
                            label="Blood Type"
                            value={profile.bloodType}
                            options={bloodTypeOptions}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, bloodType: e.target.value }
                                        : currentProfile
                                )
                            }
                        />

                        <TextArea
                            id="medicalHistory"
                            label="Medical History"
                            value={profile.medicalHistory}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, medicalHistory: e.target.value }
                                        : currentProfile
                                )
                            }
                        />

                        <div className="mt-4">
                            <div className="mb-1 flex justify-between">
                                <span className="whitespace-nowrap">Chronic Diseases</span>
                            </div>

                            <TextInput
                                id="chronic"
                                value={profile.chronicDiseases}
                                onChange={(e) =>
                                    setProfile((currentProfile) =>
                                        currentProfile
                                            ? {
                                                ...currentProfile,
                                                chronicDiseases: e.target.value,
                                            }
                                            : currentProfile
                                    )
                                }
                            />
                        </div>

                        <div className="mt-4">
                            <div className="mb-1 flex justify-between">
                                <span>Allergies</span>
                            </div>

                            <TextInput
                                id="allergy"
                                value={profile.allergies}
                                onChange={(e) =>
                                    setProfile((currentProfile) =>
                                        currentProfile
                                            ? { ...currentProfile, allergies: e.target.value }
                                            : currentProfile
                                    )
                                }
                            />
                        </div>
                    </div>
                </SectionCard>

                <SectionCard>
                    <SectionHeader title="Location" />
                    <p className="mb-3 text-xs text-gray-400">
                        Your location may help emergency services reach you faster.
                    </p>

                    <div className="mb-4">
                        <LocationPicker
                            value={locationPickerValue}
                            onChange={handleLocationPickerChange}
                            label="Select location from map or search"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <SelectInput
                            id="country"
                            label="Country"
                            value={resolvedCountryKey}
                            options={[{ label: "Select Country", value: "" }, ...countryOptions]}
                            onChange={(e) =>
                                updateLocationField({
                                    country: e.target.value,
                                    city: "",
                                    district: "",
                                    neighborhood: "",
                                })
                            }
                        />

                        <SelectInput
                            id="city"
                            label="City"
                            value={resolvedCityKey}
                            disabled={!resolvedCountryKey}
                            options={[{ label: "Select City", value: "" }, ...cityOptions]}
                            onChange={(e) =>
                                updateLocationField({
                                    city: e.target.value,
                                    district: "",
                                    neighborhood: "",
                                })
                            }
                        />

                        <SelectInput
                            id="district"
                            label="District"
                            value={resolvedDistrictKey}
                            disabled={!resolvedCityKey}
                            options={[
                                { label: "Select District", value: "" },
                                ...districtOptions,
                            ]}
                            onChange={(e) =>
                                updateLocationField({
                                    district: e.target.value,
                                    neighborhood: "",
                                })
                            }
                        />

                        <SelectInput
                            id="neighborhood"
                            label="Neighborhood"
                            value={resolvedNeighborhoodValue}
                            disabled={!resolvedDistrictKey}
                            options={[
                                { label: "Select Neighborhood", value: "" },
                                ...neighborhoodOptions,
                            ]}
                            onChange={(e) =>
                                updateLocationField({
                                    neighborhood: e.target.value,
                                })
                            }
                        />

                        <div className="col-span-2">
                            <StreetAddressInput
                                id="extraAddress"
                                label="Extra Address"
                                placeholder="Start typing a street name"
                                value={profile.extraAddress}
                                countryCode={(resolvedCountryKey || "TR").toUpperCase()}
                                scope={{
                                    country: countryData?.label,
                                    city: countryData?.cities[resolvedCityKey]?.label,
                                    district:
                                        countryData?.cities[resolvedCityKey]?.districts[
                                            resolvedDistrictKey
                                        ]?.label,
                                    neighborhood: neighborhoodOptions.find(
                                        (item) =>
                                            item.value === resolvedNeighborhoodValue
                                    )?.label,
                                }}
                                onChange={(next) =>
                                    setProfile((currentProfile) =>
                                        currentProfile
                                            ? {
                                                ...currentProfile,
                                                extraAddress: next,
                                            }
                                            : currentProfile
                                    )
                                }
                                onSelectSuggestion={(item) => {
                                    setLocationPickerValue(
                                        toPickerValueFromSearchItem(item)
                                    );
                                }}
                            />
                            <HelperText>
                                Pick a spot on the map or start typing a street to see
                                suggestions in your selected area. Selecting a
                                suggestion moves the map pin.
                            </HelperText>
                            {locationTreeError ? (
                                <HelperText className="text-red-500">
                                    {locationTreeError}
                                </HelperText>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm">Share Current Location</span>
                        <ToggleSwitch
                            aria-label="Share Current Location"
                            checked={profile.shareLocation}
                            onCheckedChange={(value) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? { ...currentProfile, shareLocation: value }
                                        : currentProfile
                                )
                            }
                        />
                    </div>
                </SectionCard>

                {error ? <HelperText className="text-red-500">{error}</HelperText> : null}
                {info ? <HelperText>{info}</HelperText> : null}

                <div className="flex justify-end">
                    <PrimaryButton onClick={handleSave} loading={saving}>
                        Save Changes
                    </PrimaryButton>
                </div>
            </div>
        </div>
    );
}
