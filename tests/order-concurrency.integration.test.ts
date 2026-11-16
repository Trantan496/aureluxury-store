import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { integrationTarget, assertIntegrationDatabase } from "../scripts/integration-target.ts";

const target = integrationTarget();
if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== target.toString()) throw new Error("Use the guarded integration runner");
const levels = ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"] as const;
type Connection = pg.Client;
type Outcome = { code: string | null };
test("Order header revision protects direct SQL writers", { timeout: 120000 }, async t => {
  const clients = [0,1,2].map(() => new pg.Client({ connectionString: target.toString(), options: "-c statement_timeout=12s -c lock_timeout=6s" }));
  const [control, first, second] = clients;
  const guard = (client: Connection) => assertIntegrationDatabase(sql => client.query(sql));
  const prefix = "p251-" + randomBytes(8).toString("hex");
  let user = 0, category = 0, product = 0;
  let orders: number[] = [], items: number[][] = [];
  const variants: number[] = [];
  const matrix: Record<string, number> = {};
  async function outcome(work: () => Promise<unknown>, client: Connection): Promise<Outcome> {
    try { await work(); return { code: null }; }
    catch (error) { await client.query("ROLLBACK"); return { code: (error as {code?:string}).code ?? "UNKNOWN" }; }
  }
  async function invariant() {
    const rows = (await control.query(`SELECT o.id FROM public."Order" o LEFT JOIN public."OrderItem" i ON i."orderId"=o.id
      WHERE o."orderNumber" LIKE $1 GROUP BY o.id HAVING o.currency IS NOT NULL AND
      (count(i.id)=0 OR sum(i."lineTotal") IS DISTINCT FROM o."totalAmount" OR bool_or(i.currency IS DISTINCT FROM o.currency))`, [prefix + "%"])).rows;
    assert.deepEqual(rows, [], "No committed order may violate currency/total/nonempty invariants");
  }
  async function insert(client: Connection, order: number, variant: number) {
    return client.query(`INSERT INTO public."OrderItem" ("orderId","variantId","productName",sku,color,size,quantity,currency,"unitPrice","lineTotal")
      VALUES ($1,$2,'Test','Test','Test','M',1,'USD',0,0) RETURNING id`, [order,variant]);
  }
  async function reset() {
    for (const client of [first,second]) await client.query("ROLLBACK");
    await guard(control); await control.query("BEGIN");
    if (orders.length) {
      await control.query(`DELETE FROM public."OrderItem" WHERE "orderId"=ANY($1::int[])`, [orders]);
      await control.query(`DELETE FROM public."Order" WHERE id=ANY($1::int[])`, [orders]);
    }
    orders = []; items = [];
    for (let o = 0; o < 2; o++) {
      const id = (await control.query(`INSERT INTO public."Order" ("orderNumber","userId",currency,"totalAmount","shippingName","shippingPhone","shippingAddress")
        VALUES ($1,$2,'USD',0,'Test','0','Test') RETURNING id`, [prefix + "-" + o,user])).rows[0].id;
      orders.push(id); items.push([]);
      for (let i = 0; i < 2; i++) items[o].push((await insert(control,id,variants[o*2+i])).rows[0].id);
    }
    await control.query("COMMIT");
  }
  async function begin(level: typeof levels[number]) {
    for (const client of [first,second]) {
      await guard(client); await client.query("BEGIN ISOLATION LEVEL " + level);
      // Establish snapshots before either writer starts, including the old bug schedule.
      await client.query(`SELECT id FROM public."OrderItem" WHERE "orderId"=ANY($1::int[])`, [orders]);
    }
  }
  async function blocked(client: Connection) {
    const pid = (await control.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1", [(client as Connection & {label:string}).label])).rows[0]?.pid;
    assert.ok(pid);
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      if ((await control.query("SELECT cardinality(pg_blocking_pids($1))>0 AS blocked", [pid])).rows[0].blocked) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail("Expected a real PostgreSQL lock wait, not a timing-only race");
  }
  async function race(level: typeof levels[number], name: string, a: () => Promise<unknown>, b: () => Promise<unknown>, rcCode: string | null, rollbackFirst = false) {
    await t.test(level + ": " + name, async () => {
      await reset(); await begin(level);
      await a();
      const pending = outcome(async () => { await b(); await second.query("COMMIT"); }, second);
      await blocked(second);
      await first.query(rollbackFirst ? "ROLLBACK" : "COMMIT");
      const result = await pending;
      assert.equal(result.code, rollbackFirst || level === "READ COMMITTED" ? rcCode : "40001");
      await invariant(); matrix[level] = (matrix[level] ?? 0) + 1;
    });
  }
  try {
    for (let i=0;i<clients.length;i++) {
      const client = clients[i]; await client.connect(); await guard(client);
      const label = prefix + "-connection-" + i;
      Object.assign(client,{label}); await client.query("SELECT set_config('application_name',$1,false)",[label]);
    }
    await guard(control); await control.query("BEGIN");
    user = (await control.query(`INSERT INTO public."User" (email,"fullName","updatedAt") VALUES ($1,'Test',NOW()) RETURNING id`,[prefix+"@test.invalid"])).rows[0].id;
    category = (await control.query(`INSERT INTO public."Category" (name,slug) VALUES ($1,$1) RETURNING id`,[prefix])).rows[0].id;
    product = (await control.query(`INSERT INTO public."Product" (name,slug,"categoryId") VALUES ($1,$1,$2) RETURNING id`,[prefix,category])).rows[0].id;
    for(let i=0;i<4;i++) variants.push((await control.query(`INSERT INTO public."ProductVariant" ("productId",sku,color,size,stock) VALUES ($1,$2,$2,'M',10) RETURNING id`,[product,prefix+"-"+i])).rows[0].id);
    await control.query("COMMIT");
    for (const level of levels) {
      await race(level,"old two DELETE write skew cannot commit an empty order",
        ()=>first.query(`DELETE FROM public."OrderItem" WHERE id=$1`,[items[0][0]]),
        ()=>second.query(`DELETE FROM public."OrderItem" WHERE id=$1`,[items[0][1]]),"23514");
      await race(level,"two INSERT writers share the header revision",
        ()=>insert(first,orders[0],variants[0]),()=>insert(second,orders[0],variants[1]),null);
      await race(level,"quantity, unit price and header total remain atomic",
        ()=>first.query(`UPDATE public."OrderItem" SET quantity=2 WHERE id=$1`,[items[0][0]]),
        async()=>{ await second.query(`UPDATE public."OrderItem" SET "unitPrice"=1,"lineTotal"=1 WHERE id=$1`,[items[0][1]]); await second.query(`UPDATE public."Order" SET "totalAmount"=1 WHERE id=$1`,[orders[0]]); },null);
      await race(level,"currency conversion is only an explicit coherent snapshot rewrite",
        ()=>first.query(`UPDATE public."OrderItem" SET quantity=2 WHERE id=$1`,[items[0][0]]),
        async()=>{ await second.query(`UPDATE public."OrderItem" SET currency='EUR' WHERE "orderId"=$1`,[orders[0]]); await second.query(`UPDATE public."Order" SET currency='EUR' WHERE id=$1`,[orders[0]]); },null);
      await race(level,"mixed item currency is rejected",
        ()=>first.query(`UPDATE public."OrderItem" SET quantity=2 WHERE id=$1`,[items[0][0]]),
        ()=>second.query(`UPDATE public."OrderItem" SET currency='EUR' WHERE id=$1`,[items[0][1]]),"23514");
      await race(level,"moving both remaining items cannot empty the source order",
        ()=>first.query(`UPDATE public."OrderItem" SET "orderId"=$1 WHERE id=$2`,[orders[1],items[0][0]]),
        ()=>second.query(`UPDATE public."OrderItem" SET "orderId"=$1 WHERE id=$2`,[orders[1],items[0][1]]),"23514");
      await race(level,"opposite moves serialize both headers",
        ()=>first.query(`UPDATE public."OrderItem" SET "orderId"=$1 WHERE id=$2`,[orders[1],items[0][0]]),
        ()=>second.query(`UPDATE public."OrderItem" SET "orderId"=$1 WHERE id=$2`,[orders[0],items[1][0]]),null);
      await race(level,"direct header UPDATE conflicts with item writer",
        ()=>first.query(`UPDATE public."Order" SET "shippingName"='Changed',revision=0 WHERE id=$1`,[orders[0]]),
        ()=>second.query(`UPDATE public."OrderItem" SET quantity=3 WHERE id=$1`,[items[0][0]]),null);
      await race(level,"rollback releases the revision without losing the other commit",
        ()=>first.query(`DELETE FROM public."OrderItem" WHERE id=$1`,[items[0][0]]),
        ()=>second.query(`DELETE FROM public."OrderItem" WHERE id=$1`,[items[0][1]]),null,true);
      await race(level,"header deletion cannot admit an orphan concurrent INSERT",
        async()=>{ await first.query(`DELETE FROM public."OrderItem" WHERE "orderId"=$1`,[orders[0]]); await first.query(`DELETE FROM public."Order" WHERE id=$1`,[orders[0]]); },
        ()=>insert(second,orders[0],variants[0]),"23503");
      await t.test(level+": real deadlock aborts one transaction",async()=>{
        await reset(); await begin(level);
        await first.query(`UPDATE public."OrderItem" SET quantity=2 WHERE id=$1`,[items[0][0]]);
        await second.query(`UPDATE public."OrderItem" SET quantity=2 WHERE id=$1`,[items[1][0]]);
        const a = outcome(async()=>{await first.query(`UPDATE public."OrderItem" SET quantity=3 WHERE id=$1`,[items[1][1]]); await first.query("COMMIT");},first);
        await blocked(first);
        const b = outcome(async()=>{await second.query(`UPDATE public."OrderItem" SET quantity=3 WHERE id=$1`,[items[0][1]]); await second.query("COMMIT");},second);
        const results = await Promise.all([a,b]);
        assert.equal(results.filter(r=>r.code==="40P01").length,1);
        assert.ok(results.every(r=>[null,"40P01","40001"].includes(r.code)));
        await invariant(); matrix[level]++;
      });
      await t.test(level+": lock timeout rolls back the complete transaction",async()=>{
        await reset(); await begin(level);
        await first.query(`UPDATE public."OrderItem" SET quantity=2 WHERE id=$1`,[items[0][0]]);
        await second.query("SET LOCAL lock_timeout='150ms'");
        const result=await outcome(()=>second.query(`DELETE FROM public."OrderItem" WHERE id=$1`,[items[0][1]]),second);
        assert.equal(result.code,"55P03"); await first.query("COMMIT");
        assert.equal((await control.query(`SELECT count(*)::int AS n FROM public."OrderItem" WHERE "orderId"=$1`,[orders[0]])).rows[0].n,2);
        await invariant(); matrix[level]++;
      });
      await t.test(level+": rollback after successful item write restores revision and data",async()=>{
        await reset(); const before=(await control.query(`SELECT revision::text FROM public."Order" WHERE id=$1`,[orders[0]])).rows[0].revision;
        await guard(first); await first.query("BEGIN ISOLATION LEVEL "+level);
        await first.query(`UPDATE public."OrderItem" SET quantity=5 WHERE id=$1`,[items[0][0]]); await first.query("ROLLBACK");
        assert.equal((await control.query(`SELECT revision::text FROM public."Order" WHERE id=$1`,[orders[0]])).rows[0].revision,before);
        await invariant(); matrix[level]++;
      });
    }
    await t.test("revision tampering, search_path and function ACL do not bypass validation",async()=>{
      await reset();
      const original=(await control.query(`SELECT revision::text FROM public."Order" WHERE id=$1`,[orders[0]])).rows[0].revision;
      await control.query(`UPDATE public."Order" SET revision=-100 WHERE id=$1`,[orders[0]]);
      assert.equal(BigInt((await control.query(`SELECT revision::text FROM public."Order" WHERE id=$1`,[orders[0]])).rows[0].revision),BigInt(original)+BigInt(1));
      await first.query("BEGIN; SET LOCAL search_path=pg_temp,pg_catalog");
      await first.query(`CREATE TEMP TABLE "Order" (id int,revision bigint)`);
      await first.query(`UPDATE public."OrderItem" SET quantity=2 WHERE id=$1`,[items[0][0]]); await first.query("COMMIT");
      const functions=(await control.query(`SELECT p.proname,p.prosecdef,p.proconfig, EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('guard_order_revision','touch_order_item_headers','check_order_currency_snapshot','enforce_order_currency_snapshot')`)).rows;
      assert.equal(functions.length,4); for(const fn of functions){assert.equal(fn.prosecdef,false);assert.equal(fn.public_execute,false);assert.ok(fn.proconfig.includes("search_path=pg_catalog, pg_temp"));}
      await invariant();
    });
    console.log("PASS direct SQL concurrency matrix "+JSON.stringify(matrix));
  } finally {
    for (const client of clients) await client.query("ROLLBACK").catch(()=>{});
    try {
      if(user){ await guard(control); await control.query("BEGIN");
        await control.query(`DELETE FROM public."OrderItem" WHERE "orderId" IN (SELECT id FROM public."Order" WHERE "userId"=$1)`,[user]);
        await control.query(`DELETE FROM public."Order" WHERE "userId"=$1`,[user]);
        await control.query(`DELETE FROM public."ProductVariant" WHERE "productId"=$1`,[product]);
        await control.query(`DELETE FROM public."Product" WHERE id=$1`,[product]);
        await control.query(`DELETE FROM public."Category" WHERE id=$1`,[category]);
        await control.query(`DELETE FROM public."User" WHERE id=$1`,[user]); await control.query("COMMIT"); }
    } finally { for(const client of clients) await client.end(); }
  }
});
