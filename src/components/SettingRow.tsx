import { type ReactNode } from "react";
import { Toggle } from "./Toggle";

interface SettingRowProps {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
}

export function SettingRow({
  id,
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
  children,
}: SettingRowProps) {
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 flex-shrink-0 text-gray-900">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <label id={titleId} htmlFor={id} className="text-sm font-semibold text-gray-900 cursor-pointer">
              {title}
            </label>
            <Toggle
              id={id}
              checked={checked}
              onChange={onChange}
              disabled={disabled}
              aria-labelledby={titleId}
              aria-describedby={descId}
            />
          </div>
          <p id={descId} className="mt-1 text-sm text-gray-600 pr-14">
            {description}
          </p>
          {children && (
            <div
              className={`overflow-hidden transition-all duration-200 ${
                checked ? "mt-3 max-h-40 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
