import Link from "next/link";

interface ErrorStateProps {
  title?: string;
  message: string;
  backHref?: string;
  backLabel?: string;
}

export default function ErrorState({
  title = "Error",
  message,
  backHref = "/",
  backLabel = "← Back to Traffic & Spot Bookings",
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
      <p className="font-medium text-destructive">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{message}</p>
      {backHref && (
        <Link href={backHref} className="text-sm text-primary hover:underline mt-2 inline-block">
          {backLabel}
        </Link>
      )}
    </div>
  );
}
