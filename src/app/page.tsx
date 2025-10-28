"use client";

import { useSession } from "next-auth/react";

export default function Home() {
  const { status } = useSession();

  if (status === "loading") return <p>Loading…</p>;

  return (
    <main>
      Home
    </main>
  );
}