"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Ticket, X } from "lucide-react";
import { Suspense, useState } from "react";
import { Container } from "@/components/layout/container";
import { SITE } from "@/config/site";
import { useSession } from "@/features/auth/session-context";
import { cn } from "@/lib/utils/cn";

const links = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Explore" },
];

function isAuthed(user: { role: string } | null, roles: string[]): boolean {
  return !!user && roles.includes(user.role);
}

/**
 * Only this subtree reads the pathname, so only it suspends during
 * prerender — the brand, auth buttons, and menu toggle hydrate stably.
 */
function NavLinks() {
  const pathname = usePathname();
  const { user } = useSession();
  return (
    <div className="hidden items-center gap-1 lg:flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={pathname === l.href ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium text-[#687386] hover:bg-[#F8F8F5] hover:text-[#202B3C]",
            pathname === l.href && "bg-[#F8F8F5] text-[#202B3C]",
          )}
        >
          {l.label}
        </Link>
      ))}
      {user && (
        <Link
          href="/my-bookings"
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium text-[#687386] hover:bg-[#F8F8F5] hover:text-[#202B3C]",
            pathname.startsWith("/my-bookings") && "bg-[#F8F8F5] text-[#202B3C]",
          )}
        >
          My Bookings
        </Link>
      )}
      {(user?.role === "ORGANIZER" || user?.role === "ADMIN") && (
        <Link
          href="/organizer"
          className="rounded-lg px-3 py-2 text-sm font-medium text-[#687386] hover:bg-[#F8F8F5] hover:text-[#202B3C]"
        >
          Organizer
        </Link>
      )}
      {user?.role === "ADMIN" && (
        <Link
          href="/admin"
          className="rounded-lg px-3 py-2 text-sm font-medium text-[#687386] hover:bg-[#F8F8F5] hover:text-[#202B3C]"
        >
          Admin
        </Link>
      )}
    </div>
  );
}

export function Navbar() {
  const router = useRouter();
  const { user, loading, signOut } = useSession();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const showOrganizer = isAuthed(user, ["ORGANIZER", "ADMIN"]);

  return (
    <header className="sticky top-0 z-40 border-b border-[#E7E7E2] bg-white/95 backdrop-blur">
      <Container>
        <nav aria-label="Primary" className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#202B3C]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B95F43] text-white">
              <Ticket className="h-5 w-5" aria-hidden />
            </span>
            {SITE.name}
          </Link>

          <Suspense>
            <NavLinks />
          </Suspense>

          <div className="hidden items-center gap-2 lg:flex">
            {loading ? null : user ? (
              <>
                <span className="max-w-40 truncate text-sm text-[#687386]">{user.name}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-lg border border-[#E7E7E2] px-4 py-2 text-sm font-semibold text-[#202B3C] hover:bg-[#F8F8F5]"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
              >
                Log in
              </Link>
            )}
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-[#202B3C] hover:bg-[#F8F8F5] lg:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
        </nav>

        {open && (
          <div className="flex flex-col gap-1 border-t border-[#E7E7E2] py-3 lg:hidden">
            {[...links,
              ...(user ? [{ href: "/my-bookings", label: "My Bookings" }] : []),
              ...(showOrganizer ? [{ href: "/organizer", label: "Organizer" }] : []),
              ...(user?.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-[#202B3C] hover:bg-[#F8F8F5]"
              >
                {l.label}
              </Link>
            ))}
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-1 rounded-lg border border-[#E7E7E2] px-3 py-3 text-left text-base font-semibold"
              >
                Sign out ({user.name})
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-lg bg-[#B95F43] px-3 py-3 text-center text-base font-semibold text-white"
              >
                Log in
              </Link>
            )}
          </div>
        )}
      </Container>
    </header>
  );
}
