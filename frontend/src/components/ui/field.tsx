import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
  useRef,
} from "react";

import { useDictation } from "#app/components/ui/dictation";
import { cx } from "#app/utils/format";

type Ids = { id: string; describedBy: string | undefined; invalid: boolean };

type ShellProps = {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  required?: boolean;
  className?: string | undefined;
  children: (ids: Ids) => ReactNode;
};

/** Rótulo, dica e erro — um dono só para a mobília de todo campo. */
export function FieldShell({ label, hint, error, required, className, children }: ShellProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-h` : null, error ? `${id}-e` : null].filter(Boolean).join(" ");
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {" *"}
          </span>
        ) : null}
      </label>
      {children({ id, describedBy: describedBy || undefined, invalid: Boolean(error) })}
      {hint ? (
        <p id={`${id}-h`} className="text-xs/relaxed text-muted max-sm:text-sm/relaxed">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-e`} className="text-xs font-semibold text-danger max-sm:text-sm">
          ⚠ {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-field border-[1.5px] bg-surface px-4 py-3 text-[15px] text-text max-sm:text-base transition-colors placeholder:text-muted/70 focus:outline-none disabled:bg-bg disabled:text-muted";

const border = (invalid: boolean) =>
  invalid ? "border-danger focus:border-danger" : "border-border focus:border-brand";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
};

export function Input({ label, hint, error, required, className, ...rest }: InputProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required ?? false} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cx(CONTROL, border(invalid))}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  /** Texto livre ganha o ditado por voz; desligue só onde não faz sentido. */
  dictation?: boolean;
};

export function Textarea({
  label,
  hint,
  error,
  required,
  rows = 3,
  dictation = true,
  className,
  ...rest
}: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const d = useDictation({
    target: ref,
    label,
    enabled: dictation && !rest.readOnly && !rest.disabled,
    className: "absolute right-2 bottom-2",
  });
  return (
    <FieldShell label={label} hint={hint} error={error} required={required ?? false} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <textarea
            ref={ref}
            id={id}
            rows={rows}
            maxLength={4000}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            required={required}
            className={cx(CONTROL, border(invalid), "resize-y", d.offered && "pb-12")}
            {...rest}
          />
          {d.button}
        </div>
      )}
    </FieldShell>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  children: ReactNode;
};

export function Select({ label, hint, error, required, className, children, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required ?? false} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cx(CONTROL, border(invalid), "appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10")}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b6158' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          }}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
