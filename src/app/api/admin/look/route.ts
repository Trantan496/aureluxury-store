import {NextResponse} from "next/server";
import {revalidatePath} from "next/cache";
import {createProductDataService} from "@/lib/products";
import {assertAdminOrigin,readAdminJson} from "@/features/products/admin-http";
import {readImageBody} from "@/features/products/image-upload";
import {object} from "@/features/products/validation";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
function response(result:{ok:boolean;error?:{code:string}}){return NextResponse.json(result,{headers,status:result.ok?200:({UNAUTHENTICATED:401,FORBIDDEN:403,NOT_FOUND:404,INVALID_INPUT:400,CONFLICT:409} as Record<string,number>)[result.error?.code??""]??503});}
export async function GET(request:Request){const q=new URL(request.url).searchParams,s=createProductDataService();return response(q.has("id")?await s.pendingGet(Number(q.get("id"))):await s.pendingList({page:Number(q.get("page")??1),...(q.has("sourceId")?{sourceId:Number(q.get("sourceId"))}:{})}));}
export async function POST(request:Request){try{
  assertAdminOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL,request.headers.get("sec-fetch-site"));
  const s=createProductDataService();
  if(!request.headers.get("content-type")?.startsWith("application/json")){
    const id=Number(request.headers.get("x-pending-id")),version=request.headers.get("x-pending-version");
    return response(request.headers.get("x-pending-operation")==="patch"?await s.pendingPatch(id,version,{},()=>readImageBody(request)):await s.pendingSave(id,version,{name:decodeURIComponent(request.headers.get("x-pending-name")??""),price:request.headers.get("x-pending-price")},()=>readImageBody(request)));
  }
  const v=object(await readAdminJson(request),["operation","id","version","input","sourceId","requestKey"]);
  const result=v.operation==="create"?await s.pendingCreate(v.sourceId,v.requestKey):v.operation==="save"?await s.pendingSave(v.id,v.version,v.input):v.operation==="patch"?await s.pendingPatch(v.id,v.version,v.input):v.operation==="detach"?await s.pendingDetach(v.id,v.version):v.operation==="convert"?await s.pendingConvert(v.id,v.version,v.input):null;
  if(!result)throw new Error("operation");
  if(result.ok){revalidatePath("/products");revalidatePath("/admin/products/pending");revalidatePath("/","layout");}
  return response(result);
}catch{return NextResponse.json({ok:false,error:{code:"INVALID_INPUT",message:"Không thể cập nhật món phối đồ."}},{status:400,headers});}}
