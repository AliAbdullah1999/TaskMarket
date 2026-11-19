"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef } from "react";
import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

/**
 * Form bound to a server action that shows its error/success message.
 * Submits via a transition instead of `<form action>` so React does not wipe
 * the user's input when the server rejects it.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state && !state.error) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        // Pass the submitter so named buttons (e.g. outcome=release) are included.
        const formData = new FormData(event.currentTarget, event.nativeEvent.submitter);
        startTransition(() => formAction(formData));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      <FormMessage state={state} />
    </form>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.error && !state?.success) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`mt-3 rounded-xl px-3 py-2 text-sm ${
        state.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  pendingLabel,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "dark";
  className?: string;
  pendingLabel?: string;
}) {
  const pending = useContext(PendingContext);
  const styles = {
    primary: "bg-[#176b52] text-white shadow-emerald-950/10 hover:bg-[#10543f]",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
    danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
    dark: "bg-slate-900 text-white hover:bg-slate-700",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 ${styles} ${className}`}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}

export function ConfirmSubmitButton({
  children,
  title,
  message,
  confirmLabel,
  variant = "danger",
}: {
  children: React.ReactNode;
  title: string;
  message: string;
  confirmLabel: string;
  variant?: "danger" | "primary";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const pending = useContext(PendingContext);
  const confirmStyles = variant === "danger"
    ? "bg-rose-700 text-white hover:bg-rose-800"
    : "bg-[#176b52] text-white hover:bg-[#10543f]";

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => dialogRef.current?.showModal()}
        className={`inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 ${
          variant === "danger"
            ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="p-6">
          <h2 id={`${id}-title`} className="text-lg font-bold">{title}</h2>
          <p id={`${id}-message`} className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex min-h-10 items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              className={`inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${confirmStyles}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
