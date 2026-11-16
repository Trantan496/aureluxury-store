import { createProductDataService } from "@/lib/products";
import { ProductShowroom } from "@/components/admin/product-showroom";
import { showroomProduct } from "@/features/products/showroom-model";
import { productRelated } from "@/lib/product-related";
import { currencyEnabled } from "@/features/money/money";
export const dynamic = "force-dynamic";
export const metadata = { title: "Product Showroom | AUREL", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id:string }> }) {
  const { id } = await params;
  const result = await createProductDataService().managementGet(Number(id));
  if (!result.ok) return <p role="alert">Không thể mở showroom. Kiểm tra quyền truy cập hoặc tải lại.</p>;
  return <ProductShowroom initial={result.data} related={await productRelated(showroomProduct(result.data))} currencyEnabled={currencyEnabled()}/>;
}
