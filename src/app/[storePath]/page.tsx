import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getStoreByPathSegment } from "@/config/stores";
import SharePageClient from "@/components/SharePageClient";

interface PageProps {
  params: Promise<{ storePath: string }>;
}

export async function generateStaticParams() {
  const { getAllStorePaths } = await import("@/config/stores");
  return getAllStorePaths().map((storePath) => ({ storePath }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { storePath } = await params;
  const store = getStoreByPathSegment(storePath);

  if (!store) {
    return { title: "找不到店家" };
  }

  return {
    title: `${store.sharerPageTitle} — ${store.name}`,
    description: store.sharerPageDescription.slice(0, 120),
    openGraph: {
      title: `${store.sharerPageTitle} — ${store.name}`,
      description: store.sharerPageDescription.slice(0, 120),
      images: [store.shareImage],
    },
  };
}

export default async function StoreSharePage({ params }: PageProps) {
  const { storePath } = await params;
  const store = getStoreByPathSegment(storePath);

  if (!store) {
    notFound();
  }

  return <SharePageClient store={store} />;
}
