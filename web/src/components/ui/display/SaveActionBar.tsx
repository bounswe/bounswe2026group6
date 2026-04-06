"use client";

import * as React from "react";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";

type Props = {
  onSave: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function SaveActionBar({ onSave, loading, disabled }: Props) {
  return (
    <div className="mt-4">
      <PrimaryButton
        onClick={onSave}
        loading={loading}
        disabled={disabled}
      >
        Save
      </PrimaryButton>
    </div>
  );
}
