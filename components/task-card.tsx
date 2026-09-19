import Link from "next/link";
import type { Task } from "@prisma/client";
import { Badge } from "@/components/ui";
import { formatBudget, formatDate, formatRelative, taskStatusMeta } from "@/lib/format";

export function TaskCard({ task }: { task: Task & { _count: { quotes: number } } }) {
  const status = taskStatusMeta[task.status];
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <Badge tone="green">{task.category}</Badge>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{task.description}</p>

      <dl className="mt-5 space-y-2 text-sm text-slate-600">
        <div className="flex justify-between gap-4">
          <dt>Location</dt>
          <dd className="text-right font-semibold text-slate-900">
            {task.neighborhood ? `${task.neighborhood}, ` : ""}
            {task.city}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Budget</dt>
          <dd className="font-semibold text-slate-900">{formatBudget(task.budgetMin, task.budgetMax)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Quotes</dt>
          <dd className="font-semibold text-slate-900">{task._count.quotes}</dd>
        </div>
      </dl>

      <div className="flex-1" />
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">
          {task.preferredDate ? `Needed ${formatDate(task.preferredDate)}` : `Posted ${formatRelative(task.createdAt)}`}
        </span>
        <span className="text-sm font-semibold text-emerald-700 group-hover:text-emerald-800">View task →</span>
      </div>
    </Link>
  );
}
