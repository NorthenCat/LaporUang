import React from "react";
import { CurrencyInput } from "../atoms/CurrencyInput";

interface CurrencyFormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  errorText?: string;
  value: string | number;
  onValueChange: (rawValue: string) => void;
}

export const CurrencyFormField: React.FC<CurrencyFormFieldProps> = ({
  label,
  errorText,
  id,
  value,
  onValueChange,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={id} className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">
        {label}
      </label>
      <CurrencyInput id={id} error={!!errorText} value={value} onValueChange={onValueChange} {...props} />
      {errorText ? (
        <span className="text-xs text-destructive mt-0.5">{errorText}</span>
      ) : null}
    </div>
  );
};
