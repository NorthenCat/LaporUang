import React from "react";
import { Input } from "../atoms/Input";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errorText?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  errorText,
  id,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={id} className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">
        {label}
      </label>
      <Input id={id} error={!!errorText} {...props} />
      {errorText ? (
        <span className="text-xs text-destructive mt-0.5">{errorText}</span>
      ) : null}
    </div>
  );
};
