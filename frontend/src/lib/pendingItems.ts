export function isChecklistPending(item: string): boolean {
  return (
    item.startsWith("Responder item") ||
    item.includes("item NC") ||
    item.startsWith("Checklist:")
  );
}

export function splitChecklistPending(pending: string[]): {
  checklist: string[];
  all: string[];
} {
  const checklist = pending.filter(isChecklistPending);
  return { checklist, all: pending };
}
