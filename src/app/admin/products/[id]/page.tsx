import { createProductDataService } from "@/lib/products";
import { ProductEditor } from "@/components/admin/product-editor";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, service = createProductDataService();
  const product = await service.managementGet(Number(id));
  const navigation = await service.managementList();
  const taxonomy = await service.managementTaxonomy();
  if (!product.ok || !navigation.ok || !taxonomy.ok) return <p role="alert">Không thể tải sản phẩm. Kiểm tra quyền truy cập hoặc trở về danh sách.</p>;
  const categories = navigation.data.categories.some(c => c.id === product.data.categoryId) ? navigation.data.categories : [...navigation.data.categories, product.data.category];
  return <ProductEditor key={product.data.version} product={product.data} categories={categories} taxonomy={taxonomy.data} collections={navigation.data.collections}/>;
}
