import Link from "next/link";
import {createProductDataService} from "@/lib/products";
import {ProductEditor} from "@/components/admin/product-editor";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params,s=createProductDataService(),pending=await s.pendingGet(Number(id));
 if(!pending.ok)return <p role="alert">Không thể mở món chờ xử lý.</p>;
 if(pending.data.state==="converted")return pending.data.productId?<Link href={`/admin/products/${pending.data.productId}`}>Mở sản phẩm đã chuyển đổi →</Link>:<p>Sản phẩm đã được xử lý và không còn tồn tại.</p>;
 if(!pending.data.name||!pending.data.imageUrl||pending.data.price===null)return <Link href="/admin/products/pending">Lưu đủ ảnh, tên và giá trong hàng chờ trước khi hoàn thiện →</Link>;
 const [result,taxonomy]=await Promise.all([s.managementList(),s.managementTaxonomy()]);
 if(!result.ok||!taxonomy.ok)return <p role="alert">Không thể tải dữ liệu form.</p>;
 return <ProductEditor product={null} pending={pending.data} categories={result.data.categories} taxonomy={taxonomy.data} collections={result.data.collections}/>;
}
