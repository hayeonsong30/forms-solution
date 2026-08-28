"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { useLanguage, type Lang } from "@/lib/language";

const STRINGS = {
  ko: {
    appName: "Form Solution",
    googleLogin: "Google 계정으로 로그인",
  },
  ja: {
    appName: "Form Solution",
    googleLogin: "Googleアカウントでログイン",
  },
} satisfies Record<Lang, { appName: string; googleLogin: string }>;

export default function LoginPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const s = STRINGS[lang];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Image src="/brand/neolab-logo.png" alt="NeoLAB" width={120} height={36} priority />
          <h1 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{s.appName}</h1>
        </div>

        <Card className="p-6">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-slate-50 cursor-pointer"
          >
            <GoogleIcon />
            {s.googleLogin}
          </button>
        </Card>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.86 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
