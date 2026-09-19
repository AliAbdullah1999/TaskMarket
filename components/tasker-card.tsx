import Link from "next/link";
import type { TaskerProfile } from "@prisma/client";
import { Avatar, Badge, Stars } from "@/components/ui";
import { formatPKR } from "@/lib/format";

type Props = {
  profile: TaskerProfile & { user: { id: string; fullName: string; businessName: string | null; city: string | null } };
};

export function TaskerCard({ profile }: Props) {
  const name = profile.user.businessName ?? profile.user.fullName;
  return (
    <Link
      href={`/taskers/${profile.user.id}`}
      className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <Avatar name={name} />
        {profile.ntinVerified ? <Badge tone="green">NTN verified</Badge> : <Badge tone="amber">Pending</Badge>}
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{name}</h3>
      <p className="mt-1 text-sm text-slate-500">
        {profile.categories.slice(0, 2).join(" · ") || "General services"} • {profile.serviceAreas.slice(0, 2).join(", ") || profile.user.city}
      </p>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <Stars value={profile.rating} count={profile.ratingCount} />
        <span>{profile.completedJobs} jobs</span>
      </div>
      <div className="flex-1" />
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Starting at</span>
        <span className="text-base font-black text-slate-900">{formatPKR(profile.priceFrom)}</span>
      </div>
    </Link>
  );
}
