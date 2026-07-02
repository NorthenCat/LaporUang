import React from "react";
import { Input } from "./Input";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string | number;
  onValueChange: (rawValue: string) => void;
  error?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onValueChange,
  error,
  ...props
}) => {
  const displayValue = value ? `Rp ${Number(value).toLocaleString("id-ID")}` : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip everything except digits
    const rawVal = e.target.value.replace(/\D/g, "");
    onValueChange(rawVal);
  };

  return (
    <Input
      {...props}
      type="text"
      value={displayValue}
      onChange={handleChange}
      error={error}
    />
  );
};
