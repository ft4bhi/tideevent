import Link from "next/link";
import { Container } from "@/components/layout/container";
import { CATEGORIES, CATEGORY_LABELS } from "@/config/site";
import { SITE } from "@/config/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[#E7E7E2] bg-white">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:justify-between">
        <div>
          <p className="font-bold text-[#202B3C]">{SITE.name}</p>
          <p className="mt-1 max-w-xs text-sm text-[#687386]">{SITE.demoNote}</p>
        </div>
        <nav aria-label="Categories" className="flex flex-wrap gap-x-4 gap-y-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/events?category=${c}`}
              className="text-sm text-[#687386] hover:text-[#202B3C]"
            >
              {CATEGORY_LABELS[c]}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
