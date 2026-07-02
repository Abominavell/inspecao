import { inspectionStatusClass, INSPECTION_STATUS_LABEL } from "@/lib/status";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${inspectionStatusClass(status)}`}
    >
      {INSPECTION_STATUS_LABEL[status] || status}
    </span>
  );
}
