import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createJob } from "@/app/actions/jobs";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, PageHeader, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CITIES, JOB_CATEGORIES } from "@/lib/constants";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage() {
  const user = await requireUser();
  if (user.userType !== "EMPLOYER") redirect("/dashboard");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader eyebrow="For employers" title="Post a job" description="Write a clear, inclusive listing so candidates understand the role and expectations." />
      <ActionForm action={createJob} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Field label="Job title">
          <input name="title" required minLength={8} maxLength={120} placeholder="e.g. Senior Frontend Engineer" className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select name="category" required defaultValue="" className={inputClass}>
              <option value="" disabled>Select a category</option>
              {JOB_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </Field>
          <Field label="City">
            <select name="city" required defaultValue="" className={inputClass}>
              <option value="" disabled>Select a location</option>
              {CITIES.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </Field>
          <Field label="Employment type">
            <select name="employmentType" required defaultValue="FULL_TIME" className={inputClass}>
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="TEMPORARY">Temporary</option>
            </select>
          </Field>
          <Field label="Workplace type">
            <select name="workplaceType" required defaultValue="ONSITE" className={inputClass}>
              <option value="ONSITE">On-site</option>
              <option value="HYBRID">Hybrid</option>
              <option value="REMOTE">Remote</option>
            </select>
          </Field>
          <Field label="Minimum monthly salary (PKR)" hint="Optional">
            <input name="salaryMin" type="number" min="0" step="1000" className={inputClass} />
          </Field>
          <Field label="Maximum monthly salary (PKR)" hint="Optional">
            <input name="salaryMax" type="number" min="0" step="1000" className={inputClass} />
          </Field>
        </div>
        <Field label="Role description" hint="At least 50 characters. Include responsibilities, schedule, and what success looks like.">
          <textarea name="description" required minLength={50} maxLength={10000} rows={8} className={inputClass} />
        </Field>
        <Field label="Requirements" hint="Optional. List the experience, qualifications, or skills candidates should have.">
          <textarea name="requirements" maxLength={5000} rows={5} className={inputClass} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Publishing…">Publish job</SubmitButton>
        </div>
      </ActionForm>
    </main>
  );
}
