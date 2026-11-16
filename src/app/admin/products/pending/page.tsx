import {createProductDataService} from "@/lib/products";
import {PendingProducts} from "@/components/admin/pending-products";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){
 const {page}=await searchParams,result=await createProductDataService().pendingList({page:Number(page??1)});
 return result.ok?<PendingProducts initial={result.data}/>:<p role="alert">Không thể tải hàng chờ. Hãy tải lại hoặc kiểm tra quyền ADMIN.</p>;
}
