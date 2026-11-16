import test from "node:test";
import assert from "node:assert/strict";
import {PendingAutosave} from "../src/features/products/pending-autosave.ts";
import type {PendingItem} from "../src/features/products/pending-types.ts";
const blank:PendingItem={id:1,version:"0",sourceProductId:2,sourceName:"Unit",sourceSlug:"unit",name:null,price:null,imageUrl:null,state:"pending",productId:null,productSlug:null,published:false};

test("autosave serializes rapid edits using each accepted version",async()=>{
  const calls:string[]=[];let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  const queue=new PendingAutosave(blank,async(row,change)=>{calls.push(row.version);if(calls.length===1)await gate;return {...row,...change.input,version:String(Number(row.version)+1)};},()=>{},()=>{});
  const first=queue.enqueue({input:{name:"First"}});const second=queue.enqueue({input:{price:"299999"}});
  await Promise.resolve();assert.deepEqual(calls,["0"]);release();await Promise.all([first,second]);
  assert.deepEqual(calls,["0","1"]);assert.equal(queue.current.name,"First");assert.equal(queue.current.price,"299999");assert.equal(queue.pending,false);
});
test("failed image and later edits remain queued until explicit retry with latest version",async()=>{
  const file=new File(["unit"],"unit.webp",{type:"image/webp"});let fail=true;const calls:{version:string;file?:File}[]=[];
  const queue=new PendingAutosave(blank,async(row,change)=>{calls.push({version:row.version,file:change.file});if(fail)throw Error("Conflict");return {...row,...change.input,imageUrl:change.file?"/images/saved.webp":row.imageUrl,version:String(Number(row.version)+1)};},()=>{},()=>{});
  await queue.enqueue({input:{},file});await queue.enqueue({input:{name:"Retained"}});assert.equal(calls.length,1);assert.equal(queue.pending,true);assert.equal(queue.error,"Conflict");
  fail=false;await queue.retry(async()=>({...blank,version:"9"}));assert.deepEqual(calls.map(c=>c.version),["0","9","10"]);assert.equal(calls[1].file,file);assert.equal(queue.current.name,"Retained");assert.equal(queue.current.imageUrl,"/images/saved.webp");assert.equal(queue.error,"");
});
test("retry does not overwrite a converted product or start duplicate reloads",async()=>{
  let writes=0,reads=0;const queue=new PendingAutosave(blank,async()=>{writes++;throw Error("Offline");},()=>{},()=>{});
  await queue.enqueue({input:{name:"Retained"}});
  const read=async()=>{reads++;await Promise.resolve();return {...blank,state:"converted" as const};};
  await Promise.all([queue.retry(read),queue.retry(read)]);assert.equal(reads,1);assert.equal(writes,1);assert.match(queue.error,/sản phẩm/);
});
test("replacing a failed image retries the replacement and retains later metadata",async()=>{
  const bad=new File(["bad"],"bad.webp"),good=new File(["good"],"good.webp");let online=false;const files:File[]=[];
  const queue=new PendingAutosave(blank,async(row,change)=>{if(change.file)files.push(change.file);if(!online)throw Error("Invalid image");return {...row,...change.input,version:String(Number(row.version)+1)};},()=>{},()=>{});
  await queue.enqueue({input:{},file:bad});await queue.enqueue({input:{name:"Kept"}});await queue.enqueue({input:{},file:good});
  assert.deepEqual(files,[bad]);online=true;await queue.retry(async()=>blank);assert.deepEqual(files,[bad,good]);assert.equal(queue.current.name,"Kept");
});
