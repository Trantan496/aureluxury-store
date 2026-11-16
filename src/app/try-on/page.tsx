import { getCatalogPage } from "@/lib/catalog";
import { TryOnStudio, type TryOnGarmentOption } from "@/components/tryon/tryon-studio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Phòng thử đồ AI | AUREL",
  description: "Thử trang phục AUREL trực tiếp trên ảnh toàn thân với công nghệ AI CatVTON.",
};

function readParam(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default async function TryOnPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const initialGarmentUrl = readParam(params.garmentUrl);
  const initialGarmentName = readParam(params.garmentName);

  const catalogResult = await getCatalogPage({
    page: 1,
    pageSize: 12,
    q: "",
    category: "",
    invalid: false,
  });

  const catalogGarments: TryOnGarmentOption[] =
    catalogResult.status === "success"
      ? catalogResult.products.flatMap((product) => {
          // Slot 5 is the shop-managed white-background packshot, matching the PDP dialog.
          const url = product.images?.[4]?.url;
          if (!url || !url.startsWith("/images/")) return [];
          return [
            {
              id: product.id,
              name: product.name,
              imageUrl: url,
              slug: product.slug,
              categoryLabel: product.category?.name,
            },
          ];
        })
      : [];

  const catalogStatus =
    catalogResult.status === "error"
      ? "error"
      : catalogGarments.length === 0
        ? "empty"
        : "success";

  return (
    <TryOnStudio
      catalogGarments={catalogGarments}
      catalogStatus={catalogStatus}
      initialGarmentUrl={initialGarmentUrl}
      initialGarmentName={initialGarmentName}
    />
  );
}
