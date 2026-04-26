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
import { LocationPicker, LocationPickerValue } from "@/components/feature/location";
import { bloodTypeOptions } from "@/lib/bloodTypes";
import { expertiseOptions, professionOptions } from "@/lib/profileOptions";
import { clearAccessToken, fetchCurrentUser, getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { fetchLocationTree } from "@/lib/location";
import {
    findCityKeyByLabel,
    findCountryKeyByLabel,
    findDistrictKeyByLabel,
    findNeighborhoodValueByLabel,
    LocationTreeByCountry,
    parseLocationAddress,
} from "@/lib/locationTree";
import {
    BackendProfileResponse,
    EditableProfileData,
    buildAddress,
    fetchMyProfile,
    mapBackendProfileToEditableProfile,
    parseListField,
    patchMyHealth,
    patchMyLocation,
    patchMyPhysical,
    patchMyPrivacy,
    patchMyProfession,
    validateExpertiseAreas,
    putMyExpertiseAreas,
} from "@/lib/profile";
type UploadedFile = { name: string; data: string };
type UploadField = "chronicDiseasesFiles" | "allergiesFiles";
type EmptyStateAction = "login" | "complete-profile" | null;

type ProfileData = EditableProfileData & {
    chronicDiseasesFiles: UploadedFile[];
    chronicDiseasesVerified: boolean;
    allergiesFiles: UploadedFile[];
    allergiesVerified: boolean;
};

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
        chronicDiseasesFiles: [],
        chronicDiseasesVerified: false,
        allergiesFiles: [],
        allergiesVerified: false,
    };
}

export default function ProfileView() {
    const router = useRouter();
    const [profile, setProfile] = React.useState<ProfileData | null>(null);
    const [locationTree, setLocationTree] = React.useState<LocationTreeByCountry>({});
    const [locationTreeError, setLocationTreeError] = React.useState("");
    const [locationPickerValue, setLocationPickerValue] =
        React.useState<LocationPickerValue | null>(null);
    const [uploading, setUploading] = React.useState<string | null>(null);
    const [progress] = React.useState<number>(100);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");
    const [initialShareLocation, setInitialShareLocation] =
        React.useState(false);
    const [emptyStateAction, setEmptyStateAction] =
        React.useState<EmptyStateAction>(null);

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
                        chronicDiseasesFiles: currentProfile.chronicDiseasesFiles,
                        chronicDiseasesVerified:
                            currentProfile.chronicDiseasesVerified,
                        allergiesFiles: currentProfile.allergiesFiles,
                        allergiesVerified: currentProfile.allergiesVerified,
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

    React.useEffect(() => {
        if (!locationPickerValue) {
            return;
        }

        const countryKey = findCountryKeyByLabel(
            locationTree,
            locationPickerValue.administrative.country || ""
        );
        const cityKey = findCityKeyByLabel(
            locationTree,
            countryKey,
            locationPickerValue.administrative.city || ""
        );
        const districtKey = findDistrictKeyByLabel(
            locationTree,
            countryKey,
            cityKey,
            locationPickerValue.administrative.district || ""
        );
        const neighborhoods =
            locationTree[countryKey]?.cities[cityKey]?.districts[districtKey]?.neighborhoods ||
            [];
        const neighborhoodValue = findNeighborhoodValueByLabel(
            neighborhoods,
            locationPickerValue.administrative.neighborhood || ""
        );

        setProfile((currentProfile) => {
            if (!currentProfile) {
                return currentProfile;
            }

            return {
                ...currentProfile,
                country: countryKey || currentProfile.country,
                city: cityKey || currentProfile.city,
                district: districtKey || currentProfile.district,
                neighborhood: neighborhoodValue || currentProfile.neighborhood,
                extraAddress:
                    locationPickerValue.administrative.extraAddress ||
                    currentProfile.extraAddress,
            };
        });
    }, [locationPickerValue, locationTree]);

    const handleSave = async () => {
        if (!profile) {
            return;
        }

        const expertiseAreas = profile.expertise;
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
                age: profile.age ? Number(profile.age) : undefined,
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

    const handleFileUpload = (field: UploadField, file: File) => {
        setUploading(field);

        setProfile((prev) => {
            if (!prev) {
                return prev;
            }

            if (field === "chronicDiseasesFiles") {
                return {
                    ...prev,
                    chronicDiseasesFiles: [
                        ...prev.chronicDiseasesFiles,
                        { name: file.name, data: "" },
                    ],
                    chronicDiseasesVerified: false,
                };
            }

            return {
                ...prev,
                allergiesFiles: [...prev.allergiesFiles, { name: file.name, data: "" }],
                allergiesVerified: false,
            };
        });

        setUploading(null);
        setInfo(
            "Document uploads are not connected yet because the backend upload endpoint is not available."
        );
    };

    const removeFile = (field: UploadField, index: number) => {
        setProfile((prev) => {
            if (!prev) {
                return prev;
            }

            if (field === "chronicDiseasesFiles") {
                const updated = [...prev.chronicDiseasesFiles];
                updated.splice(index, 1);

                return { ...prev, chronicDiseasesFiles: updated };
            }

            const updated = [...prev.allergiesFiles];
            updated.splice(index, 1);

            return { ...prev, allergiesFiles: updated };
        });
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
                    <h2 className="text-lg font-semibold">{profile.fullName || "User"}</h2>
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
                    <div className="flex flex-col gap-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Email</span>
                            <span>{profile.email || "-"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Phone</span>
                            <span>
                                {[profile.countryCode, profile.phone]
                                    .filter(Boolean)
                                    .join(" ") || "-"}
                            </span>
                        </div>
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
                                id="age"
                                label="Age"
                                type="number"
                                inputMode="numeric"
                                value={profile.age}
                                onChange={(e) =>
                                    setProfile((currentProfile) =>
                                        currentProfile
                                            ? {
                                                ...currentProfile,
                                                age: e.target.value.replace(/\D/g, "").slice(0, 3),
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
                                <div className="flex items-center gap-2 text-xs">
                                    <p className="text-xs text-gray-400">
                                        Upload is shown in the UI, but backend document storage is
                                        not available yet.
                                    </p>
                                    <input
                                        type="file"
                                        id="chronic-upload"
                                        className="hidden"
                                        onChange={(e) =>
                                            e.target.files?.[0] &&
                                            handleFileUpload(
                                                "chronicDiseasesFiles",
                                                e.target.files[0]
                                            )
                                        }
                                    />
                                    <label
                                        htmlFor="chronic-upload"
                                        className="cursor-pointer text-blue-600"
                                    >
                                        Upload
                                    </label>
                                </div>
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

                            {uploading === "chronicDiseasesFiles" ? (
                                <div className="mt-2 text-xs">Uploading... {progress}%</div>
                            ) : null}

                            {profile.chronicDiseasesFiles.map((file, index) => (
                                <div
                                    key={`${file.name}-${index}`}
                                    className="mt-2 flex justify-between text-xs text-gray-600"
                                >
                                    <div className="flex flex-col">
                                        <span>📄 {file.name}</span>
                                        <span className="mt-1 text-xs text-red-500">
                                            Pending Verification
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeFile("chronicDiseasesFiles", index)
                                        }
                                        className="text-red-500"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4">
                            <div className="mb-1 flex justify-between">
                                <span>Allergies</span>
                                <div className="flex items-center gap-2 text-xs">
                                    <p className="text-xs text-gray-400">
                                        Verification is not connected yet because the backend upload
                                        flow is still missing.
                                    </p>
                                    <input
                                        type="file"
                                        id="allergy-upload"
                                        className="hidden"
                                        onChange={(e) =>
                                            e.target.files?.[0] &&
                                            handleFileUpload(
                                                "allergiesFiles",
                                                e.target.files[0]
                                            )
                                        }
                                    />
                                    <label
                                        htmlFor="allergy-upload"
                                        className="cursor-pointer text-blue-600"
                                    >
                                        Upload
                                    </label>
                                </div>
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

                            {uploading === "allergiesFiles" ? (
                                <div className="mt-2 text-xs">Uploading... {progress}%</div>
                            ) : null}

                            {profile.allergiesFiles.map((file, index) => (
                                <div
                                    key={`${file.name}-${index}`}
                                    className="mt-2 flex justify-between text-xs text-gray-600"
                                >
                                    <div className="flex flex-col">
                                        <span>📄 {file.name}</span>
                                        <span className="mt-1 text-xs text-red-500">
                                            Pending Verification
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFile("allergiesFiles", index)}
                                        className="text-red-500"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
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
                            onChange={setLocationPickerValue}
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
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? {
                                            ...currentProfile,
                                            country: e.target.value,
                                            city: "",
                                            district: "",
                                            neighborhood: "",
                                        }
                                        : currentProfile
                                )
                            }
                        />

                        <SelectInput
                            id="city"
                            label="City"
                            value={resolvedCityKey}
                            disabled={!resolvedCountryKey}
                            options={[{ label: "Select City", value: "" }, ...cityOptions]}
                            onChange={(e) =>
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? {
                                            ...currentProfile,
                                            city: e.target.value,
                                            district: "",
                                            neighborhood: "",
                                        }
                                        : currentProfile
                                )
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
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? {
                                            ...currentProfile,
                                            district: e.target.value,
                                            neighborhood: "",
                                        }
                                        : currentProfile
                                )
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
                                setProfile((currentProfile) =>
                                    currentProfile
                                        ? {
                                            ...currentProfile,
                                            neighborhood: e.target.value,
                                        }
                                        : currentProfile
                                )
                            }
                        />

                        <div className="col-span-2">
                            <TextInput
                                id="extraAddress"
                                label="Extra Address"
                                value={profile.extraAddress}
                                onChange={(e) =>
                                    setProfile((currentProfile) =>
                                        currentProfile
                                            ? {
                                                ...currentProfile,
                                                extraAddress: e.target.value,
                                            }
                                            : currentProfile
                                    )
                                }
                            />
                            <HelperText>
                                District and neighborhood are sent with their labels and
                                merged into the backend address field for compatibility.
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
