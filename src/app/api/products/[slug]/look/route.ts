import {NextResponse} from "next/server";
import {publicLook} from "@/lib/product-related";
import {currency} from "@/features/money/money";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
  try{const {slug}=await params,q=new URL(request.url).searchParams;return NextResponse.json(await publicLook(slug,Number(q.get("page")??1),q.has("currency")?currency(q.get("currency")):undefined),{headers:{"Cache-Control":"no-store"}});}
  catch{return NextResponse.json({rows:[],hasMore:false},{status:400});}
}
