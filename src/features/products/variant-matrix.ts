import {InputError} from "./validation.ts";
import {normalizedWords,variantSku} from "./product-code.ts";
export type VariantColour={id:string;name:string;hex:string};
export type VariantColours=Record<string,{name:string;hex:string}>;
const apparelSizeOrder=["XXS","XS","S","M","L","XL","XXL","XXXL","XXXXL"];
export function sortSizeOptions(values:readonly string[]){return [...new Set(values)].sort((a,b)=>{
  const left=a.trim().toUpperCase(),right=b.trim().toUpperCase(),li=apparelSizeOrder.indexOf(left),ri=apparelSizeOrder.indexOf(right);
  const ln=Number(left),rn=Number(right),leftNumeric=Number.isFinite(ln)&&/^\d+(?:\.\d+)?$/.test(left),rightNumeric=Number.isFinite(rn)&&/^\d+(?:\.\d+)?$/.test(right);
  if(leftNumeric&&rightNumeric)return ln-rn;if(leftNumeric!==rightNumeric)return leftNumeric?-1:1;
  if(li>=0||ri>=0)return (li<0?apparelSizeOrder.length:li)-(ri<0?apparelSizeOrder.length:ri)||left.localeCompare(right,"vi");
  return left.localeCompare(right,"vi",{numeric:true,sensitivity:"base"});
});}
export const defaultColourHex:Record<string,string>={black:"#2C1E16",white:"#FFFDF9",beige:"#D7C6B1",brown:"#79533B",navy:"#22334D",blue:"#377FC2",red:"#BC3636",green:"#3C7950",grey:"#929292",pink:"#E9A6BD",yellow:"#E8C744",purple:"#88599C",orange:"#DC863D"};
export function variantOption(value:unknown,kind:"color"|"size"){
  if(typeof value!=="string"||!value.trim()||value.trim().length>80||/[\u0000-\u001f\u007f<>]/.test(value))throw new InputError(kind);
  const name=value.trim().replace(/\s+/g," "),token=normalizedWords(name).replace(/ +/g,"-");
  if(!token||token.length>60||token==="not-applicable"||(kind==="color"&&name.length<2))throw new InputError(kind);
  return {id:kind==="size"?token.toUpperCase():token,name};
}
export function variantColour(name:unknown,hex:unknown):VariantColour{
  const option=variantOption(name,"color");if(typeof hex!=="string"||!/^#[a-fA-F0-9]{6}$/.test(hex))throw new InputError("hex");
  return {...option,hex:hex.toUpperCase()};
}
export function missingVariantPairs(existing:readonly {color:string;size:string}[],colors:readonly string[],sizes:readonly string[]){
  const c=[...new Set(colors)],s=[...new Set(sizes)];
  if(c.length>40||s.length>40||existing.length>200)throw new InputError("variants");
  const used=new Set(existing.map(v=>JSON.stringify([v.color,v.size])));
  const pairs=c.flatMap(color=>s.flatMap(size=>used.has(JSON.stringify([color,size]))?[]:[{color,size}]));
  if(existing.length+pairs.length>200)throw new InputError("variants");
  return pairs;
}
export function allocateVariantSku(code:string,color:string,size:string,used:Set<string>){
  const base=variantSku(code,color,size);
  for(let n=0;n<=1000;n++){const candidate=n?`${base}-V${n}`:base;if(!used.has(candidate)){used.add(candidate);return candidate;}}
  throw new InputError("sku");
}
