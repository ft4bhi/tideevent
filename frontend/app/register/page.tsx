import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata = { title: "Create account" };

function safeNext(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Create account</h1>
        <p className="mt-1 text-[#687386]">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-[#B95F43] hover:underline">
            Log in
          </Link>
        </p>
      </div>
      <Card className="p-5">
        <Suspense>
          <RegisterShell searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

async function RegisterShell({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  return <RegisterForm next={next} />;
}
