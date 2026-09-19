import type { Metadata } from "next";
import { createTask } from "@/app/actions/tasks";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, PageHeader, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CATEGORIES, CITIES } from "@/lib/constants";

export const metadata: Metadata = { title: "Post a task" };

export default async function NewTaskPage() {
  const user = await requireUser(["CUSTOMER", "BUSINESS"]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        eyebrow="Post a task"
        title="What do you need done?"
        description="Verified taskers will send you quotes. You only pay once you pick one, and funds stay in escrow until the job is complete."
      />

      <ActionForm action={createTask} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Field label="Task title" hint="e.g. Deep cleaning for 2-bedroom flat">
          <input name="title" required minLength={8} maxLength={120} className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select name="category" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Select category
              </option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Service type" hint="e.g. Plumbing, O-Level maths, Logo design">
            <input name="serviceType" maxLength={60} className={inputClass} />
          </Field>
        </div>

        <Field label="Describe the work" hint="Scope, materials, access, anything a tasker needs to quote accurately.">
          <textarea name="description" required minLength={20} maxLength={3000} rows={5} className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City">
            <select name="city" required defaultValue={user.city ?? ""} className={inputClass}>
              <option value="" disabled>
                Select city
              </option>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Area / neighbourhood" hint="Shown publicly, e.g. Gulshan-e-Iqbal">
            <input name="neighborhood" maxLength={80} className={inputClass} />
          </Field>
        </div>

        <Field label="Full address" hint="Encrypted and only revealed to your chosen tasker after escrow is funded. Optional for remote work.">
          <textarea name="address" rows={2} maxLength={300} className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Min budget (PKR)">
            <input name="budgetMin" type="number" min={0} step={100} className={inputClass} />
          </Field>
          <Field label="Max budget (PKR)">
            <input name="budgetMax" type="number" required min={500} step={100} className={inputClass} />
          </Field>
          <Field label="Est. duration (hours)">
            <input name="durationHours" type="number" min={1} max={500} className={inputClass} />
          </Field>
        </div>

        <Field label="Preferred date & time" hint="Pakistan time">
          <input name="preferredDate" type="datetime-local" className={inputClass} />
        </Field>

        <div className="flex justify-end">
          <SubmitButton pendingLabel="Posting…">Post task</SubmitButton>
        </div>
      </ActionForm>
    </main>
  );
}
