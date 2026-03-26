"use client";

import * as React from "react";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { SelectInput } from "@/components/ui/inputs/SelectInput";
import { TextArea } from "@/components/ui/inputs/TextArea";
import { ToggleSwitch } from "@/components/ui/selection/ToggleSwitch";
import { ProfileInfoRow } from "../../ui/display/ProfileInfoRow";
import { SaveActionBar } from "../../ui/display/SaveActionBar";
import { bloodTypeOptions } from "@/lib/bloodTypes";

type ProfileForm = {
  gender: string;
  height: string;
  weight: string;
  bloodType?: string;
  birthDate: string;
  medicalHistory: string;
  country: string;
  city: string;
  district: string;
  neighborhood: string;
  extraAddress: string;
  shareLocation: boolean;
};

type Neighborhood = {
  label: string;
  value: string;
};

type District = {
  label: string;
  neighborhoods: Neighborhood[];
};

type City = {
  label: string;
  districts: Record<string, District>;
};

type Country = {
  label: string;
  cities: Record<string, City>;
};

type LocationData = Record<string, Country>;

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
            neighborhoods: [
              { label: "Anıttepe", value: "anittepe" },
            ],
          },
        },
      },
    },
  },
};


  export default function CompleteProfileForm() {
    const [form, setForm] = React.useState<ProfileForm>({
    gender: "",
    height: "",
    weight: "",
    bloodType: "",
    birthDate: "",
    medicalHistory: "",
    country: "",
    city: "",
    district: "",
    neighborhood: "",
    extraAddress: "",
    shareLocation: false,
  });

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");


  const countryData = locationData[form.country] ?? undefined;

  const countryOptions = Object.entries(locationData).map(
    ([key, val]) => ({
      label: val.label,
      value: key,
    })
  );

  const cityOptions =
  form.country && countryData
    ? Object.entries(countryData.cities).map(([key, val]) => ({
        label: val.label,
        value: key,
      }))
    : [];

  const districtOptions =
  form.city && countryData?.cities?.[form.city]
    ? Object.entries(
        countryData.cities[form.city].districts
      ).map(([key, val]) => ({
        label: val.label,
        value: key,
      }))
    : [];

  const neighborhoodOptions =
  form.city &&
  form.district &&
  countryData?.cities?.[form.city]?.districts?.[form.district]
    ? countryData.cities[form.city].districts[form.district].neighborhoods
    : [];


  const handleSave = async () => {
  setError("");

  const isAddressIncomplete =
    !form.country || !form.city || !form.district || !form.neighborhood;

  if (!form.height || !form.weight || !form.birthDate || isAddressIncomplete) {
    setError("Please fill in all required fields.");
    return;
  }

  setLoading(true);
  await new Promise((r) => setTimeout(r, 600));

  const existingUser = localStorage.getItem("user");
  const parsed = existingUser ? JSON.parse(existingUser) : {};
  const finalData = { ...parsed, ...form };

  // TODO: localStorage is used temporarily for demo purposes.
  // Replace with a proper API call before production.
  localStorage.setItem("user", JSON.stringify(finalData));

  setLoading(false);
};

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5">

        {/* HEIGHT & WEIGHT */}
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            id="height"
            label="Height (cm)"
            value={form.height}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d{0,3}$/.test(val)) {
                setForm({ ...form, height: val });
              }
            }}
          />

          <TextInput
            id="weight"
            label="Weight (kg)"
            value={form.weight}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d{0,3}$/.test(val)) {
                setForm({ ...form, weight: val });
              }
            }}
          />
        </div>

        {/* GENDER */}
        <ProfileInfoRow label="Gender">
          <SelectInput
            id="gender"
            options={[
              { label: "Select Gender", value: "" },
              { label: "Male", value: "male" },
              { label: "Female", value: "female" },
              { label: "Other", value: "other" },
            ]}
            value={form.gender}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value })
            }
          />
        </ProfileInfoRow>

        {/* DATE */}
        <ProfileInfoRow label="Date of Birth">
          <TextInput
            id="birthDate"
            type="date"
            value={form.birthDate}
            onChange={(e) =>
              setForm({ ...form, birthDate: e.target.value })
            }
          />
        </ProfileInfoRow>

        {/* MEDICAL */}
        <ProfileInfoRow label="Blood Type">
  <SelectInput
    id="bloodType"
    options={bloodTypeOptions}
    value={form.bloodType ?? ""}
    onChange={(e) =>
      setForm({ ...form, bloodType: e.target.value })
    }
  />
</ProfileInfoRow>

<ProfileInfoRow label="Medical History">
  <TextArea
    id="medicalHistory"
    placeholder="Chronic diseases & allergies"
    value={form.medicalHistory}
    onChange={(e) =>
      setForm({ ...form, medicalHistory: e.target.value })
    }
  />
  <p className="text-xs text-gray-400">
    You may need to verify this information later
  </p>
</ProfileInfoRow>

        {/* ADDRESS */}
        <ProfileInfoRow label="Address">
          <SelectInput
            id="country"
            options={[
              { label: "Select Country", value: "" },
              ...countryOptions,
            ]}
            value={form.country}
            onChange={(e) =>
              setForm({
                ...form,
                country: e.target.value,
                city: "",
                district: "",
                neighborhood: "",
              })
            }
          />

          <SelectInput
            id="city"
            options={[
              { label: "Select City", value: "" },
              ...(cityOptions || []),
            ]}
            value={form.city}
            onChange={(e) =>
              setForm({
                ...form,
                city: e.target.value,
                district: "",
                neighborhood: "",
              })
            }
          />

          <SelectInput
            id="district"
            options={[
              { label: "Select District", value: "" },
              ...(districtOptions || []),
            ]}
            value={form.district}
            onChange={(e) =>
              setForm({
                ...form,
                district: e.target.value,
                neighborhood: "",
              })
            }
          />

          <SelectInput
            id="neighborhood"
            options={[
              { label: "Select Neighborhood", value: "" },
              ...(neighborhoodOptions || []),
            ]}
            value={form.neighborhood}
            onChange={(e) =>
              setForm({
                ...form,
                neighborhood: e.target.value,
              })
            }
          />

          <TextInput
            id="extraAddress"
            placeholder="Street, building, etc. (optional)"
            value={form.extraAddress}
            onChange={(e) =>
              setForm({
                ...form,
                extraAddress: e.target.value,
              })
            }
          />
        </ProfileInfoRow>

        {/* TOGGLE */}
        <div className="flex items-center justify-between">
          <span className="text-sm">
            Share Current Location
          </span>

          <ToggleSwitch
            checked={form.shareLocation ?? false}
            onCheckedChange={(val) =>
              setForm({ ...form, shareLocation: val })
            }
          />
        </div>

        {/* ERROR */}
        {error && (
          <p className="text-sm text-red-500">
            {error}
          </p>
        )}

        {/* SAVE */}
        <SaveActionBar onSave={handleSave} loading={loading} />
      </div>

  );
}