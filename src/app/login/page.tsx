import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { PageLoading } from "@/components/page-loading";

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LoginForm />
    </Suspense>
  );
}
