import * as React from "react";
import { cn } from "@/lib/utils";

const DASAR =
  "kotak fokus-pixel w-full border-2 border-garis bg-permukaan-2 px-3 py-2 text-sm text-teks placeholder:text-redup/70 disabled:opacity-40";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("pixel-sm block uppercase text-redup", className)}
      {...props}
    />
  );
}

export const Bidang = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Bidang({ className, ...props }, ref) {
  return <input ref={ref} className={cn(DASAR, "h-10", className)} {...props} />;
});

export const AreaTeks = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AreaTeks({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(DASAR, "min-h-24 resize-y leading-relaxed", className)}
      {...props}
    />
  );
});

export const Pilih = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Pilih({ className, ...props }, ref) {
  return (
    <select ref={ref} className={cn(DASAR, "h-10 pr-8", className)} {...props} />
  );
});

export function Kolom({
  label,
  petunjuk,
  children,
}: {
  label: string;
  petunjuk?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {petunjuk ? (
        <p className="text-xs leading-relaxed text-redup">{petunjuk}</p>
      ) : null}
    </div>
  );
}
