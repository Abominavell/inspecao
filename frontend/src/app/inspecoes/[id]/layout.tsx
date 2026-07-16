export function generateStaticParams() {
  return [{ id: "local" }];
}

export default function InspectionIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
