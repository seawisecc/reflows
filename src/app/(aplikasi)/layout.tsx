export default function LayoutAplikasi({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-dvh lg:pl-60">{children}</div>;
}
