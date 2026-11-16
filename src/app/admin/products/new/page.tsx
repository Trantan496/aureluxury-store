import { createProductDataService } from "@/lib/products";
import { ProductEditor } from "@/components/admin/product-editor";
export default async function Page() {
  const service = createProductDataService();
  const result = await service.managementList(), taxonomy = await service.managementTaxonomy();
  if (!result.ok || !taxonomy.ok) return <p role="alert">Không thể tải danh mục hoặc bạn chưa có quyền ADMIN.</p>;
  return <ProductEditor product={null} categories={result.data.categories} taxonomy={taxonomy.data} collections={result.data.collections}/>;
}
