import type {PendingItem} from "@/features/products/pending-types";
export async function lookRequest<T>(body:Record<string,unknown>,file?:File):Promise<T>{
  const input=body.input as {name?:string;price?:string}|undefined;
  const request:RequestInit=file?{headers:{"Content-Type":file.type,"x-pending-operation":String(body.operation),"x-pending-id":String(body.id),"x-pending-version":String(body.version),...(body.operation==="patch"?{}:{"x-pending-name":encodeURIComponent(input?.name??""),"x-pending-price":String(input?.price??"")})},body:file}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)};
  const response=await fetch("/api/admin/look",{method:"POST",credentials:"same-origin",...request});
  const result=await response.json();if(!result.ok)throw new Error(result.error?.code==="CONFLICT"?"Dữ liệu đã thay đổi. Tải lại ô trước khi lưu; nội dung đang nhập vẫn được giữ.":result.error?.code==="FEATURE_UNAVAILABLE"?"Hàng chờ chưa được bật trên database này.":"Không thể lưu. Kiểm tra ảnh, tên và giá VND hoặc thử lại.");
  return result.data as T;
}
export async function reloadPending(id:number):Promise<PendingItem>{const response=await fetch(`/api/admin/look?id=${id}`,{cache:"no-store"});const result=await response.json();if(!result.ok)throw new Error("Không thể tải lại dữ liệu.");return result.data;}
