import { sendMessage } from "@/app/actions/tasks";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, inputClass } from "@/components/ui";
import { formatDate } from "@/lib/format";

type ThreadMessage = {
  id: string;
  body: string;
  channelType: "IN_APP" | "VOICE_PROXY" | "SYSTEM";
  flagged: boolean;
  createdAt: Date;
  sender: { id: string; fullName: string; userType: string };
};

export function MessageThread({
  taskId,
  messages,
  viewerId,
  open,
}: {
  taskId: string;
  messages: ThreadMessage[];
  viewerId: string;
  open: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Messages</h2>
        <span className="text-xs text-slate-500">Contact details are masked to keep payments in escrow</span>
      </div>

      <ol className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? <li className="text-sm text-slate-500">No messages yet. Say salaam 👋</li> : null}
        {messages.map((message) => {
          if (message.channelType === "SYSTEM") {
            return (
              <li key={message.id} className="rounded-xl bg-slate-100 px-3 py-2 text-center text-xs text-slate-600">
                {message.body} <span className="text-slate-400">· {formatDate(message.createdAt, true)}</span>
              </li>
            );
          }
          const mine = message.sender.id === viewerId;
          return (
            <li key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                {!mine ? <p className="mb-0.5 text-xs font-semibold text-slate-500">{message.sender.fullName}</p> : null}
                <p className="whitespace-pre-line">{message.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-emerald-100" : "text-slate-400"}`}>
                  {formatDate(message.createdAt, true)}
                  {message.flagged ? " · contact info hidden" : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {open ? (
        <ActionForm action={sendMessage} resetOnSuccess className="mt-4">
          <input type="hidden" name="taskId" value={taskId} />
          <div className="flex gap-2">
            <input name="body" required maxLength={2000} placeholder="Write a message…" className={inputClass} autoComplete="off" />
            <SubmitButton pendingLabel="…">Send</SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <p className="mt-4 text-xs text-slate-500">This conversation is read-only.</p>
      )}
    </Card>
  );
}
