import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Spinner } from "#app/components/ui/spinner";
import { cx } from "#app/utils/format";

type Variant = "primary" | "green" | "outline" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "border-transparent bg-brand text-white outline-brand hover:bg-brand-deep",
  green: "border-transparent bg-field-green text-white outline-field-green hover:bg-field-green-deep",
  outline: "border-brand text-brand outline-brand hover:bg-brand hover:text-white",
  ghost: "border-transparent text-brand outline-brand hover:bg-brand-soft",
  danger: "border-danger text-danger outline-danger hover:bg-danger hover:text-white",
};

const SIZE = {
  md: "px-6 py-3 text-[15px]",
  sm: "px-4 py-2 text-sm max-sm:py-2.5",
  xs: "h-8 px-3 text-xs",
} as const;

const BASE =
  "items-center justify-center gap-2 rounded-full border-[1.5px] font-bold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-45";

export function buttonClasses(variant: Variant = "primary", size: keyof typeof SIZE = "md") {
  return cx("inline-flex", BASE, VARIANT[variant], SIZE[size]);
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: keyof typeof SIZE;
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClasses(variant, size), className)}
      {...rest}
    >
      {loading ? <Spinner size="sm" label={null} /> : null}
      {children}
    </button>
  );
}
