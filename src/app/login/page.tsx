import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#eef3f8] px-4 py-8">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
