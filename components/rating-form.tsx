import { rateTask } from "@/app/actions/tasks";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputClass } from "@/components/ui";

const CRITERIA = [
  { name: "overall", label: "Overall" },
  { name: "punctuality", label: "Punctuality" },
  { name: "professionalism", label: "Professionalism" },
  { name: "communication", label: "Communication" },
];

export function RatingForm({ taskId, subject }: { taskId: string; subject: string }) {
  return (
    <ActionForm action={rateTask} className="space-y-3">
      <input type="hidden" name="taskId" value={taskId} />
      <p className="text-sm font-semibold text-slate-900">Rate {subject}</p>
      {CRITERIA.map((criterion) => (
        <fieldset key={criterion.name} className="flex items-center justify-between gap-3">
          <legend className="sr-only">{criterion.label}</legend>
          <span className="text-sm text-slate-600">{criterion.label}</span>
          <span className="star-rating flex flex-row-reverse gap-0.5">
            {[5, 4, 3, 2, 1].map((score) => (
              <label key={score} className="cursor-pointer text-xl">
                <input type="radio" name={criterion.name} value={score} required defaultChecked={score === 5} className="sr-only" />
                <span aria-label={`${score} stars`}>★</span>
              </label>
            ))}
          </span>
        </fieldset>
      ))}
      <textarea name="comment" rows={2} maxLength={1000} placeholder="Share a few words (optional)" className={inputClass} />
      <SubmitButton pendingLabel="Submitting…">Submit review</SubmitButton>
    </ActionForm>
  );
}
