"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-context";
import { register as apiRegister } from "@/lib/api/endpoints/auth";
import { toMessage } from "@/lib/api/errors";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "ATTENDEE" },
  });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    try {
      await apiRegister(values);
      await refresh();
      router.push(next);
      router.refresh();
    } catch (err) {
      setServerError(toMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {serverError && (
        <Alert tone="error" title="Could not create your account">
          {serverError}
        </Alert>
      )}
      <FormField label="Full name" htmlFor="register-name" error={errors.name?.message}>
        <Input id="register-name" autoComplete="name" placeholder="Aarav Sharma" {...register("name")} />
      </FormField>
      <FormField label="Email" htmlFor="register-email" error={errors.email?.message}>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register("email")}
        />
      </FormField>
      <FormField label="Password" htmlFor="register-password" error={errors.password?.message}>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          {...register("password")}
        />
      </FormField>
      <FormField label="I want to" htmlFor="register-role" error={errors.role?.message}>
        <select
          id="register-role"
          {...register("role")}
          className="min-h-[44px] w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-base text-[#202B3C]"
        >
          <option value="ATTENDEE">Attend events</option>
          <option value="ORGANIZER">Organize events</option>
        </select>
      </FormField>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
