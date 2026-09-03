"use client";

import { useState } from "react";
import { maskCnpj, validateCnpjInput } from "@/lib/fiscal/cnpj-formatter";

interface CnpjInputProps {
  name?: string;
  required?: boolean;
  placeholder?: string;
  onValueChange?: (value: string) => void;
}

export function CnpjInput({ name = "cnpj", required = true, onValueChange }: CnpjInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const masked = maskCnpj(input);
    setValue(masked);

    const validation = validateCnpjInput(masked);
    setError(!validation.isValid && masked.replace(/\D/g, "").length === 14 ? validation.error : undefined);
    onValueChange?.(validation.formatted);
  };

  const handleBlur = () => {
    if (value) {
      const validation = validateCnpjInput(value);
      setError(validation.error);
    }
  };

  return (
    <label className="block text-sm font-semibold">
      CNPJ{required && <span className="text-red-600">*</span>}
      <input
        type="text"
        name={name}
        required={required}
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-teal-600 transition-colors ${
          error ? "border-red-400 bg-red-50" : "border-slate-200 focus:border-teal-600"
        }`}
        placeholder="00.000.000/0000-00"
        maxLength={18}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {value && !error && <p className="mt-1 text-xs text-emerald-600">✓ CNPJ válido</p>}
    </label>
  );
}
