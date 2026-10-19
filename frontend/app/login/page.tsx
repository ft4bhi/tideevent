import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = { title: "Log in" };

function safeNext(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Log in</h1>
        <p className="mt-1 text-[#687386]">
          New here?{" "}
          <Link href="/register" className="font-semibold text-[#B95F43] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
      <Card className="p-5">
        <Suspense>
          <LoginShell searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

async function LoginShell({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  return <LoginForm next={next} />;
}
