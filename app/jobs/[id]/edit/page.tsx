import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateJob } from "@/app/actions/jobs";
import { JobForm } from "@/components/job-form";
import { Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jobStatusMeta } from "@/lib/format";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage(props: PageProps<"/jobs/[id]/edit">) {
  const user = await requireUser(["EMPLOYER"]);
  const { id } = await props.params;
  // Scoped to the signed-in employer: another employer's job is simply "not found".
  const job = await prisma.job.findFirst({ where: { id, employerId: user.id, status: { not: "ARCHIVED" } } });
  if (!job) notFound();
  const status = jobStatusMeta(job);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-6 sm:py-10">
      <Link href={`/jobs/${job.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 hover:text-emerald-950">← Back to listing</Link>
      <PageHeader eyebrow="Edit listing" title={job.title} description="Changes apply immediately. Editing does not change the listing's status or closing date." />
      {status.label !== "Open" ? (
        <Notice tone="info" className="mb-6">This listing is {status.label.toLowerCase()}. You can update its details, but it will not accept new applications.</Notice>
      ) : null}
      <JobForm action={updateJob} job={job} submitLabel="Save changes" pendingLabel="Saving…" />
    </main>
  );
}
