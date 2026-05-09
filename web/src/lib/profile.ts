import { apiRequest } from "@/lib/api";
import { countryCodeOptions } from "@/lib/countryCodes";
import { expertiseOptions } from "@/lib/profileOptions";

export type BackendProfileResponse = {
    profile: {
        profileId: string;
        userId: string;
        firstName: string;
        lastName: string;
        phoneNumber: string | null;
    };
    privacySettings: {
        profileVisibility: string;
        healthInfoVisibility: string;
        locationVisibility: string;
        locationVisibilityInitialized?: boolean;
        locationSharingEnabled: boolean;
    };
    healthInfo: {
        medicalConditions: string[];
        chronicDiseases: string[];
        allergies: string[];
        medications: string[];
        bloodType: string | null;
    };
    physicalInfo: {
        age: number | null;
        dateOfBirth?: string | null;
        gender: string | null;
        height: number | null;
        weight: number | null;
    };
    locationProfile: {
        address: string | null;
        displayAddress?: string | null;
        city: string | null;
        country: string | null;
        placeId?: string | null;
        latitude: number | null;
        longitude: number | null;
        administrative?: {
            countryCode?: string | null;
            country?: string | null;
            city?: string | null;
            district?: string | null;
            neighborhood?: string | null;
            extraAddress?: string | null;
            postalCode?: string | null;
        };
        coordinate?: {
            latitude?: number | null;
            longitude?: number | null;
            accuracyMeters?: number | null;
            source?: string | null;
            capturedAt?: string | null;
        } | null;
        lastUpdated: string | null;
    };
    expertise: Array<{
        expertiseId: string;
        profession: string | null;
        expertiseArea: string | null;
        expertiseAreas: string[];
        isVerified: boolean;
    }>;
};

export type EditableProfileData = {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    countryCode: string;
    profession: string;
    expertise: string[];
    height: string;
    weight: string;
    bloodType: string;
    gender: string;
    dateOfBirth: string;
    medicalHistory: string;
    chronicDiseases: string;
    allergies: string;
    country: string;
    city: string;
    district: string;
    neighborhood: string;
    extraAddress: string;
    shareLocation: boolean;
};

const availableCountryCodes = countryCodeOptions
    .map((option) => option.value)
    .filter((value): value is string => typeof value === "string" && value.startsWith("+"))
    .sort((a, b) => b.length - a.length);

function normalizePhoneParts(phoneNumber?: string | null) {
    if (!phoneNumber) {
        return {
            countryCode: "",
            phone: "",
        };
    }

    const normalized = phoneNumber.trim().replace(/[\s()-]/g, "");

    if (!normalized.startsWith("+")) {
        return {
            countryCode: "",
            phone: normalized,
        };
    }

    const matchedCountryCode = availableCountryCodes.find((code) =>
        normalized.startsWith(code)
    );

    if (!matchedCountryCode) {
        return {
            countryCode: "",
            phone: normalized,
        };
    }

    return {
        countryCode: matchedCountryCode,
        phone: normalized.slice(matchedCountryCode.length),
    };
}

export function joinFullName(firstName?: string | null, lastName?: string | null) {
    return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function normalizeDateOnly(value?: string | null) {
    if (!value) {
        return "";
    }

    const normalized = value.trim();
    if (!normalized) {
        return "";
    }

    const parsed = Date.parse(normalized);
    if (Number.isNaN(parsed)) {
        return "";
    }

    return new Date(parsed).toISOString().slice(0, 10);
}

export function parseListField(value: string) {
    return value
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export function validateExpertiseAreas(expertiseAreas: string[]) {
    if (expertiseAreas.length > 5) {
        return "You can add at most 5 expertise areas.";
    }

    const normalized = expertiseAreas.map((area) => area.toLocaleLowerCase());
    if (new Set(normalized).size !== normalized.length) {
        return "Expertise areas must be unique.";
    }

    if (expertiseAreas.some((area) => area.length > 35)) {
        return "Each expertise area must be 35 characters or fewer.";
    }

    return null;
}

export function serializeListField(values?: string[] | null) {
    return (values || []).join(", ");
}

export function buildAddress(parts: {
    district: string;
    neighborhood: string;
    extraAddress: string;
}) {
    return [parts.neighborhood, parts.district, parts.extraAddress]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ");
}

export function mapBackendProfileToEditableProfile(
    profile: BackendProfileResponse,
    email: string
): EditableProfileData {
    const phoneParts = normalizePhoneParts(profile.profile.phoneNumber);
    const expertise = profile.expertise[0];
    const normalizedProfession = expertise?.profession === "Volunteer" ? "" : (expertise?.profession || "");

    return {
        firstName: profile.profile.firstName || "",
        lastName: profile.profile.lastName || "",
        email,
        phone: phoneParts.phone,
        countryCode: phoneParts.countryCode,
        profession: normalizedProfession,
        expertise: (expertise?.expertiseAreas || [])
            .map((area) => area.trim())
            .filter((area) =>
                expertiseOptions.some((allowed) => allowed.toLocaleLowerCase() === area.toLocaleLowerCase())
                || area.toLocaleLowerCase() === "first aid"
            )
            .map(() => expertiseOptions[0]),
        height:
            profile.physicalInfo.height !== null && profile.physicalInfo.height !== undefined
                ? String(profile.physicalInfo.height)
                : "",
        weight:
            profile.physicalInfo.weight !== null && profile.physicalInfo.weight !== undefined
                ? String(profile.physicalInfo.weight)
                : "",
        bloodType: profile.healthInfo.bloodType || "",
        gender: profile.physicalInfo.gender || "",
        dateOfBirth: normalizeDateOnly(profile.physicalInfo.dateOfBirth),
        medicalHistory: serializeListField(profile.healthInfo.medicalConditions),
        chronicDiseases: serializeListField(profile.healthInfo.chronicDiseases),
        allergies: serializeListField(profile.healthInfo.allergies),
        country: profile.locationProfile.country || "",
        city: profile.locationProfile.city || "",
        district: "",
        neighborhood: "",
        extraAddress: profile.locationProfile.address || "",
        shareLocation: profile.privacySettings.locationSharingEnabled,
    };
}

export async function fetchMyProfile(token: string) {
    return apiRequest<BackendProfileResponse>("/profiles/me", {
        token,
    });
}

export async function patchMyProfile(
    token: string,
    payload: { firstName: string; lastName: string; phoneNumber: string | null }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function patchMyPhysical(
    token: string,
    payload: {
        age?: number | null;
        dateOfBirth?: string | null;
        gender?: string | null;
        height?: number | null;
        weight?: number | null;
    }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/physical", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function patchMyHealth(
    token: string,
    payload: {
        medicalConditions?: string[];
        chronicDiseases?: string[];
        allergies?: string[];
        bloodType?: string | null;
    }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/health", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function patchMyLocation(
    token: string,
    payload: {
        address?: string | null;
        city?: string | null;
        country?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        displayAddress?: string | null;
        placeId?: string | null;
        administrative?: {
            countryCode?: string | null;
            country?: string | null;
            city?: string | null;
            district?: string | null;
            neighborhood?: string | null;
            extraAddress?: string | null;
            postalCode?: string | null;
        };
        coordinate?: {
            latitude?: number | null;
            longitude?: number | null;
            accuracyMeters?: number | null;
            source?: string | null;
            capturedAt?: string | null;
        };
    }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/location", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function patchMyPrivacy(
    token: string,
    payload: {
        profileVisibility?: string;
        healthInfoVisibility?: string;
        locationVisibility?: string;
        locationSharingEnabled?: boolean;
    }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/privacy", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function patchMyProfession(
    token: string,
    payload: { profession: string | null }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/profession", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function putMyExpertiseAreas(
    token: string,
    payload: { expertiseAreas: string[] }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/expertise-areas", {
        method: "PUT",
        token,
        body: payload,
    });
}
