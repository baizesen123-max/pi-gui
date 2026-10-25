# Cross-project thread messages

A root thread can find and contact a thread in another registered workspace when the user explicitly requests it. Each recipient keeps its own workspace, history, model and execution boundaries.

## Tools

- `list_threads` remains scoped to the current workspace by default. Set `workspace` to an exact registered workspace name/path or `*` to discover other workspaces. Cross-project lists return identities and status, without loading transcript bodies. Use exact thread IDs to distinguish duplicate project names.
- `read_thread` accepts an exact ID for another workspace's ordinary thread. Child visibility remains scoped to its parent. Archived threads and other parents' children are not cross-project recipients.
- `send_message_to_thread` requires `user_request` for cross-project sends: quote the latest actual user message exactly and name the recipient project or thread. Tool guidance requires explicit contact intent. The additional text checks reject missing intent, mismatched quotations/targets and common prohibitions; they are not a general natural-language authorization system. Ambiguous requests should be clarified rather than interpreted as permission.
- Delivery returns a `messageId` without waiting for the recipient's task to finish. Busy receivers use the existing Pi queue; drafts, attachments and unrelated queued messages are preserved. Retries with the same sender, recipient, human message ID and body reuse the receipt.
- `get_thread_message` reads only the caller's receipts: submitting, queued, running, turn finished, failed, cancelled or unverified, plus the corresponding reply when available. A finished turn is not proof that the requested business work is complete.
- `cancel_thread_message` removes only the caller's still-pending message using the same serialized queue operation as consumption. Started work is never reported as cancelled or stopped.

## Avoiding feedback loops

Incoming messages retain a provenance envelope in history, with a compact project label in the UI. A turn initiated by another thread cannot automatically reply or forward through these tools, including through an intermediate same-workspace thread. Children report to their parent instead of contacting other threads. The sender explicitly queries the receipt; no background poller or automatic wake-up is added. A subsequent direct human instruction may authorize a new collaboration.

The same-workspace send path acknowledges delivery rather than waiting for the receiver's entire model turn. Its wait is bounded and cancellable; releasing it does not cancel the recipient.

## Persistence and uncertain delivery

Receipts are atomically saved in `thread-messages.json` under the application profile, without duplicating the message body. Corrupt receipts fail closed. Restart restores receipts and consults history; it never replays business messages. An in-memory queue lost across restart or a timed-out acknowledgement is reported as unverified. Inspect the receipt/recipient instead of automatically resending.

Validation uses isolated profiles, synthetic workspaces, deterministic local model responses, the real Pi runtime queue and Electron. These checks do not establish real-provider, native IME or packaged-production behavior for this standalone upstream patch.
