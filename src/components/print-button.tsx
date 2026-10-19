"use client";

// The browser's print dialog also offers "Save as PDF", which keeps Urdu shaping intact.
export function PrintButton({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <button type="button" onClick={() => print()} className={className}>
      {children}
    </button>
  );
}
