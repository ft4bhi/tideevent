import Link from "next/link";

export function MockBanner() {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "false") return null;
  return (
    <p className="bg-[#202B3C] px-4 py-2 text-center text-xs font-medium text-white">
      Demonstration data — backend not connected.{" "}
      <Link href="/events" className="underline underline-offset-2">
        Browse demo events
      </Link>
    </p>
  );
}
