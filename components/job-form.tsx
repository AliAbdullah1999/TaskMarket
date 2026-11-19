import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { CITIES, JOB_CATEGORIES } from "@/lib/constants";
import { employmentLabels, workplaceLabels } from "@/lib/format";

type JobDefaults = {
  id?: string;
  title?: string;
  description?: string;
  requirements?: string | null;
  category?: string;
  city?: string;
  employmentType?: string;
  workplaceType?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
};

/** The job create/edit form. Validation is repeated on the server in lib/services/jobs.ts. */
export function JobForm({
  action,
  job = {},
  submitLabel,
  pendingLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  job?: JobDefaults;
  submitLabel: string;
  pendingLabel: string;
}) {
  return (
    <ActionForm action={action} className="space-y-6 rounded-[24px] border border-[#e7eae5] bg-white p-6 shadow-[0_8px_28px_rgba(23,35,31,0.045)] sm:p-8">
      {job.id ? <input type="hidden" name="jobId" value={job.id} /> : null}
      <Field label="Job title" hint="8–120 characters">
        <input name="title" required minLength={8} maxLength={120} defaultValue={job.title} placeholder="e.g. Senior Frontend Engineer" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <select name="category" required defaultValue={job.category ?? ""} className={inputClass}>
            <option value="" disabled>Select a category</option>
            {JOB_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </Field>
        <Field label="City">
          <select name="city" required defaultValue={job.city ?? ""} className={inputClass}>
            <option value="" disabled>Select a location</option>
            {CITIES.map((city) => <option key={city}>{city}</option>)}
          </select>
        </Field>
        <Field label="Employment type">
          <select name="employmentType" required defaultValue={job.employmentType ?? "FULL_TIME"} className={inputClass}>
            {Object.entries(employmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Workplace type">
          <select name="workplaceType" required defaultValue={job.workplaceType ?? "ONSITE"} className={inputClass}>
            {Object.entries(workplaceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Minimum monthly salary (PKR)" hint="Optional">
          <input name="salaryMin" type="number" min="1" step="1" inputMode="numeric" defaultValue={job.salaryMin ?? ""} className={inputClass} />
        </Field>
        <Field label="Maximum monthly salary (PKR)" hint="Optional. Must not be lower than the minimum.">
          <input name="salaryMax" type="number" min="1" step="1" inputMode="numeric" defaultValue={job.salaryMax ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Role description" hint="At least 50 characters. Include responsibilities, schedule, and what success looks like.">
        <textarea name="description" required minLength={50} maxLength={10000} rows={8} defaultValue={job.description} className={inputClass} />
      </Field>
      <Field label="Requirements" hint="Optional. List the experience, qualifications, or skills candidates should have.">
        <textarea name="requirements" maxLength={5000} rows={5} defaultValue={job.requirements ?? ""} className={inputClass} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
