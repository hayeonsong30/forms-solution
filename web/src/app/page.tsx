import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-xl font-semibold">폼솔루션</h1>
      <Link href="/templates" className="text-blue-600 hover:underline">
        양식 관리로 이동 →
      </Link>
    </main>
  );
}
