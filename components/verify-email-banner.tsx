import { resendVerificationEmail } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";

/** Shown on every signed-in page until the member confirms their email address. */
export function VerifyEmailBanner({ email, userType }: { email: string; userType: "CANDIDATE" | "EMPLOYER" }) {
  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-5 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-sm leading-6 text-amber-950">
          <span className="font-semibold">Confirm your email address.</span> We sent a link to {email}. You need to confirm it before you can{" "}
          {userType === "CANDIDATE" ? "apply for jobs" : "publish jobs or invite candidates"}.
        </p>
        <ActionForm action={resendVerificationEmail} className="flex flex-wrap items-center gap-3 [&>p]:mt-0">
          <SubmitButton variant="secondary" className="px-4 py-2" pendingLabel="Sending…">Resend email</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
