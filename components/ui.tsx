import Link from "next/link";
import { initials, toneClasses } from "@/lib/format";

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none placeholder:text-slate-400 transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100/70";

export const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Badge({ tone, children }: { tone: keyof typeof toneClasses; children: React.ReactNode }) {
  const dotClasses = {
    green: "bg-emerald-600",
    amber: "bg-amber-600",
    red: "bg-rose-600",
    blue: "bg-sky-600",
    slate: "bg-slate-500",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${toneClasses[tone]}`}>
      <span aria-hidden="true" className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dotClasses}`} />
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[24px] border border-[#e7eae5] bg-white p-6 shadow-[0_8px_28px_rgba(23,35,31,0.045)] ${className}`}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-[2.15rem]">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-9 w-9 text-xs", md: "h-12 w-12 text-sm", lg: "h-16 w-16 text-lg" }[size];
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold text-white ${sizes}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export function EmptyState({ title, description, href, cta }: { title: string; description: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/75 px-6 py-12 text-center">
      <h3 className="text-lg font-bold tracking-tight text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {href && cta ? (
        <Link href={href} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#176b52] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#10543f]">
          {cta}
        </Link>
      ) : null}
    </div>
  );
}

const noticeTones = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
};

export function Notice({ tone = "info", title, children, className = "" }: { tone?: keyof typeof noticeTones; title?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm leading-6 ${noticeTones[tone]} ${className}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export const buttonClass = {
  primary: "inline-flex min-h-11 items-center justify-center rounded-full bg-[#176b52] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#10543f]",
  secondary: "inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50",
};

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[22px] border border-[#e7eae5] bg-white p-5 shadow-[0_5px_20px_rgba(23,35,31,0.035)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      {hint ? <p className="mt-1.5 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}
