"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLocale } from "@/lib/locale";
import Home from "./[locale]/page";

export default function RootPageClient() {
  const router = useRouter();

  useEffect(() => {
    const queryString = window.location.search;
    if (getLocale() !== "en") {
      router.replace(`/${getLocale()}${queryString}`);
    }
  }, [router]);

  return <Home />;
}
