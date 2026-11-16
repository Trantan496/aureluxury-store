import type {PendingItem} from "./pending-types.ts";

export type PendingChange={input:{name?:string|null;price?:string|null;removeImage?:true};file?:File;imageToken?:string};
/** One versioned writer per card. A failed head stays queued until explicit retry. */
export class PendingAutosave {
  current:PendingItem;
  private queue:PendingChange[]=[];
  private active:Promise<void>|null=null;
  private retrying=false;
  error="";
  private write:(row:PendingItem,change:PendingChange)=>Promise<PendingItem>;
  private accepted:(row:PendingItem,change:PendingChange)=>void;
  private changed:()=>void;
  constructor(row:PendingItem,write:(row:PendingItem,change:PendingChange)=>Promise<PendingItem>,accepted:(row:PendingItem,change:PendingChange)=>void,changed:()=>void){this.current=row;this.write=write;this.accepted=accepted;this.changed=changed;}
  get pending(){return this.queue.length>0||this.active!==null||this.retrying;}
  enqueue(change:PendingChange){
    const head=this.queue[0],image=(value:PendingChange)=>!!value.file||value.input.removeImage===true;
    const keys=Object.keys(change.input),headKeys=head?Object.keys(head.input):[];
    // Let a corrected field replace its failed value, while still requiring explicit retry.
    if(this.error&&!this.active&&head&&(image(head)&&image(change)||!image(head)&&!image(change)&&keys.length===1&&headKeys.length===1&&keys[0]===headKeys[0]))this.queue[0]=change;
    else this.queue.push(change);
    this.changed();return this.flush();
  }
  private flush():Promise<void>{
    if(this.active)return this.active;
    if(this.retrying)return Promise.resolve();
    if(this.error)return Promise.resolve();
    this.active=Promise.resolve().then(async()=>{
      while(this.queue.length){
        const head=this.queue[0];
        try{const row=await this.write(this.current,head);this.current=row;this.queue.shift();this.accepted(row,head);}
        catch(error){this.error=error instanceof Error?error.message:"Không thể lưu.";break;}
      }
    }).finally(()=>{this.active=null;this.changed();});
    this.changed();return this.active;
  }
  async retry(read:()=>Promise<PendingItem>){
    if(this.active||this.retrying)return;
    this.retrying=true;this.changed();
    try{const latest=await read();if(latest.state!=="pending")throw Error("Món đã chuyển thành sản phẩm. Tải lại trang để chỉnh sản phẩm thật.");this.current=latest;this.error="";}
    catch(error){this.error=error instanceof Error?error.message:"Không thể tải phiên bản mới.";return;}
    finally{this.retrying=false;this.changed();}
    return this.flush();
  }
}
