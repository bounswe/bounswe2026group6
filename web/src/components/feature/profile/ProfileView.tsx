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
import { bloodTypeOptions } from "@/lib/bloodTypes";
import { expertiseOptions, professionOptions } from "@/lib/profileOptions";
import { clearAccessToken, fetchCurrentUser, getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api";
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

type Neighborhood = { label: string; value: string };
type District = { label: string; neighborhoods: Neighborhood[] };
type City = { label: string; districts: Record<string, District> };
type Country = { label: string; cities: Record<string, City> };
type LocationData = Record<string, Country>;
type UploadedFile = { name: string; data: string };
type UploadField = "chronicDiseasesFiles" | "allergiesFiles";
type EmptyStateAction = "login" | "complete-profile" | null;

type ProfileData = EditableProfileData & {
    chronicDiseasesFiles: UploadedFile[];
    chronicDiseasesVerified: boolean;
    allergiesFiles: UploadedFile[];
    allergiesVerified: boolean;
};

const locationData: LocationData = {
    tr: {
        label: "Turkey",
        cities: {
            istanbul: {
                label: "Istanbul",
                districts: {
                    kadikoy: {
                        label: "Kadıköy",
                        neighborhoods: [
                            { label: "Bostancı", value: "bostanci" },
                            { label: "Erenköy", value: "erenkoy" },
                        ],
                    },
                    besiktas: {
                        label: "Beşiktaş",
                        neighborhoods: [
                            { label: "Balmumcu", value: "balmumcu" },
                            { label: "Kuruçeşme", value: "kurucesme" },
                        ],
                    },
                },
            },
            ankara: {
                label: "Ankara",
                districts: {
                    cankaya: {
                        label: "Çankaya",
                        neighborhoods: [{ label: "Anıttepe", value: "anittepe" }],
                    },
                },
            },
        },
    },
};

function findCountryKeyByLabel(label: string) {
    return (
        Object.entries(locationData).find(([, country]) => country.label === label)?.[0] ||
        ""
    );
}

function findCityKeyByLabel(countryKey: string, label: string) {
    const country = locationData[countryKey];

    if (!country) {
        return "";
    }

    return (
        Object.entries(country.cities).find(([, city]) => city.label === label)?.[0] ||
        ""
    );
}

function normalizeAddressPart(value: string) {
    return value
        .toLocaleLowerCase("tr")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function parseLocationAddress(countryKey: string, cityKey: string, address: string) {
    const tokens = address
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    if (!countryKey || !cityKey || tokens.length === 0) {
        return {
            district: "",
            neighborhood: "",
            extraAddress: address,
        };
    }

    const city = locationData[countryKey]?.cities[cityKey];
    if (!city) {
        return {
            district: "",
            neighborhood: "",
            extraAddress: address,
        };
    }

    const remainingTokens = new Map(
        tokens.map((token) => [normalizeAddressPart(token), token])
    );

    let district = "";
    let neighborhood = "";

    for (const [districtKey, districtValue] of Object.entries(city.districts)) {
        const matchedDistrict = [districtKey, districtValue.label]
            .map(normalizeAddressPart)
            .find((candidate) => remainingTokens.has(candidate));

        if (!matchedDistrict) {
            continue;
        }

        district = districtKey;
        remainingTokens.delete(matchedDistrict);

        const matchedNeighborhood = districtValue.neighborhoods.find((item) =>
            [item.value, item.label]
                .map(normalizeAddressPart)
                .some((candidate) => remainingTokens.has(candidate))
        );

        if (matchedNeighborhood) {
            neighborhood = matchedNeighborhood.value;
            for (const candidate of [matchedNeighborhood.value, matchedNeighborhood.label].map(
                normalizeAddressPart
            )) {
                remainingTokens.delete(candidate);
            }
        }

        break;
    }

    return {
        district,
        neighborhood,
        extraAddress: Array.from(remainingTokens.values()).join(", "),
    };
}

function toProfileData(
    backendProfile: BackendProfileResponse,
    email: string
): ProfileData {
    const mapped = mapBackendProfileToEditableProfile(backendProfile, email);
    const countryKey = findCountryKeyByLabel(mapped.country);
    const cityKey = countryKey ? findCityKeyByLabel(countryKey, mapped.city) : "";
    const parsedAddress = parseLocationAddress(countryKey, cityKey, mapped.extraAddress);

    return {
        ...mapped,
        country: countryKey,
        city: cityKey,
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
    const [uploading, setUploading] = React.useState<string | null>(null);
    const [progress] = React.useState<number>(100);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");
    const [emptyStateAction, setEmptyStateAction] =
        React.useState<EmptyStateAction>(null);

    const refreshProfileFromBackend = React.useCallback(
        async (token: string) => {
            const [user, backendProfile] = await Promise.all([
                fetchCurrentUser(token),
                fetchMyProfile(token),
            ]);

            setProfile((currentProfile) => {
                const refreshedProfile = toProfileData(backendProfile, user.email);

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

                setProfile(toProfileData(backendProfile, user.email));
                setEmptyStateAction(null);
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
    }, [refreshProfileFromBackend]);

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

            const districtLabel =
                locationData[profile.country]?.cities[profile.city]?.districts[profile.district]
                    ?.label || profile.district;
            const neighborhoodLabel =
                locationData[profile.country]?.cities[profile.city]?.districts[
                    profile.district
                ]?.neighborhoods.find((item) => item.value === profile.neighborhood)
                    ?.label || profile.neighborhood;

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
                country: locationData[profile.country]?.label || profile.country || null,
                city:
                    locationData[profile.country]?.cities[profile.city]?.label ||
                    profile.city ||
                    null,
                address:
                    buildAddress({
                        district: districtLabel,
                        neighborhood: neighborhoodLabel,
                        extraAddress: profile.extraAddress,
                    }) || null,
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

            await refreshProfileFromBackend(token);

            setInfo("Profile updated successfully.");
        } catch (err) {
            try {
                await refreshProfileFromBackend(token);
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

    const countryData = profile.country ? locationData[profile.country] : undefined;

    const countryOptions = Object.entries(locationData).map(([key, value]) => ({
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
        profile.city && countryData?.cities[profile.city]
            ? Object.entries(countryData.cities[profile.city].districts).map(
                ([key, value]) => ({
                    label: value.label,
                    value: key,
                })
            )
            : [];

    const neighborhoodOptions =
        profile.city &&
            profile.district &&
            countryData?.cities[profile.city]?.districts[profile.district]
            ? countryData.cities[profile.city].districts[profile.district].neighborhoods
            : [];

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
                                setProfile({ ...profile, height: e.target.value })
                            }
                        />
                        <TextInput
                            id="weight"
                            label="Weight (kg)"
                            value={profile.weight}
                            onChange={(e) =>
                                setProfile({ ...profile, weight: e.target.value })
                            }
                        />
                        <SelectInput
                            id="gender"
                            label="Gender"
                            value={profile.gender}
                            onChange={(e) =>
                                setProfile({ ...profile, gender: e.target.value })
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
                                    setProfile({
                                        ...profile,
                                        age: e.target.value.replace(/\D/g, "").slice(0, 3),
                                    })
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
                                setProfile({ ...profile, profession: e.target.value })
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
                                        setProfile({
                                            ...profile,
                                            expertise: checked
                                                ? [...profile.expertise, option]
                                                : profile.expertise.filter(
                                                    (item) => item !== option
                                                ),
                                        })
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
                                setProfile({ ...profile, bloodType: e.target.value })
                            }
                        />

                        <TextArea
                            id="medicalHistory"
                            label="Medical History"
                            value={profile.medicalHistory}
                            onChange={(e) =>
                                setProfile({ ...profile, medicalHistory: e.target.value })
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
                                    setProfile({
                                        ...profile,
                                        chronicDiseases: e.target.value,
                                    })
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
                                    setProfile({ ...profile, allergies: e.target.value })
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

                    <div className="grid grid-cols-2 gap-4">
                        <SelectInput
                            id="country"
                            label="Country"
                            value={profile.country}
                            options={[{ label: "Select Country", value: "" }, ...countryOptions]}
                            onChange={(e) =>
                                setProfile({
                                    ...profile,
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
                            value={profile.city}
                            disabled={!profile.country}
                            options={[{ label: "Select City", value: "" }, ...cityOptions]}
                            onChange={(e) =>
                                setProfile({
                                    ...profile,
                                    city: e.target.value,
                                    district: "",
                                    neighborhood: "",
                                })
                            }
                        />

                        <SelectInput
                            id="district"
                            label="District"
                            value={profile.district}
                            disabled={!profile.city}
                            options={[
                                { label: "Select District", value: "" },
                                ...districtOptions,
                            ]}
                            onChange={(e) =>
                                setProfile({
                                    ...profile,
                                    district: e.target.value,
                                    neighborhood: "",
                                })
                            }
                        />

                        <SelectInput
                            id="neighborhood"
                            label="Neighborhood"
                            value={profile.neighborhood}
                            disabled={!profile.district}
                            options={[
                                { label: "Select Neighborhood", value: "" },
                                ...neighborhoodOptions,
                            ]}
                            onChange={(e) =>
                                setProfile({
                                    ...profile,
                                    neighborhood: e.target.value,
                                })
                            }
                        />

                        <div className="col-span-2">
                            <TextInput
                                id="extraAddress"
                                label="Extra Address"
                                value={profile.extraAddress}
                                onChange={(e) =>
                                    setProfile({
                                        ...profile,
                                        extraAddress: e.target.value,
                                    })
                                }
                            />
                            <HelperText>
                                District and neighborhood are flattened into a single backend
                                address field for now.
                            </HelperText>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm">Share Current Location</span>
                        <ToggleSwitch
                            aria-label="Share Current Location"
                            checked={profile.shareLocation}
                            onCheckedChange={(value) =>
                                setProfile({ ...profile, shareLocation: value })
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
