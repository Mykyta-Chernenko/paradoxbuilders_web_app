import { Metadata } from "next";
import { loadMessages, Messages } from "@/lib/messages";
import RootPageClient from "./RootPageClient";

export async function generateMetadata(): Promise<Metadata> {
  const messages: Messages = await loadMessages("en");
  const seo = messages.seo;

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "website",
    },
  };
}

export default function RootPage() {
  return <RootPageClient />;
}
