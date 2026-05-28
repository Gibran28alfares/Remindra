"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState(supabase ? "" : "Supabase belum dikonfigurasi. Isi environment variables sebelum deploy.");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setFeedback("Supabase belum dikonfigurasi.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setFeedback(error.message);
      return;
    }

    router.replace(searchParams.get("next") || "/");
    router.refresh();
  }

  return (
    <section className="mx-auto mt-10 max-w-md rounded-md border border-line bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-md bg-brand/10 p-2 text-brand">
          <LockKeyhole size={22} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">REMINDRA</p>
          <h1 className="text-xl font-bold text-ink">Masuk Operator</h1>
        </div>
      </div>

      <form className="grid gap-3" onSubmit={signIn}>
        <label className="grid gap-1 text-sm font-medium">
          Email
          <input className="focus-ring rounded-md border border-line px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Password
          <input className="focus-ring rounded-md border border-line px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {feedback ? <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-ink">{feedback}</p> : null}
        <button className="focus-ring rounded-md bg-brand px-3 py-2 font-semibold text-white disabled:opacity-60" disabled={loading || !supabase}>
          {loading ? "Memeriksa..." : "Masuk"}
        </button>
      </form>
    </section>
  );
}
