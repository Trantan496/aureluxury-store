import { readFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
import pg from "pg";
// Explicit, additive local DEMO catalog. Never creates customers, orders or reviews.
if (!process.argv.includes("--confirm-demo-catalog=aurel_ai")) throw new Error("Pass --confirm-demo-catalog=aurel_ai");
const config = parse(readFileSync(".env")), url = new URL(config.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/aurel_ai") throw new Error("Only the local demo database is supported");
const db = new pg.Client({ connectionString: url.toString() });
const rows = [
  ["coat-city", "Áo khoác City", "outerwear", "coat", "women", "wool", "coat", 899000],
  ["coat-weekend", "Áo khoác Weekend", "outerwear", "coat", "men", "wool", "coat", 1099000],
  ["knit-classic", "Áo len Classic", "tops", "knit", "unisex", "wool", "knitwear", 399000],
  ["knit-soft", "Áo len Soft", "tops", "knit", "women", "wool", "knitwear", 459000],
  ["trousers-office", "Quần Office", "bottoms", "trousers", "men", "wool", "trousers", 499000],
  ["trousers-relaxed", "Quần Relaxed", "bottoms", "trousers", "unisex", "wool", "trousers", 549000],
  ["bag-daily", "Túi Daily", "accessories", "bag", "unisex", "leather", null, 299000],
  ["bag-work", "Túi Work", "accessories", "bag", "women", "leather", null, 359000],
] as const;
let created = 0, skipped = 0;
try {
  await db.connect();
  if ((await db.query("SELECT current_database() name")).rows[0].name !== "aurel_ai") throw new Error("Wrong database");
  const binary = resolve(".local/postgres/pgsql/bin/pg_dump.exe");
  if (!existsSync(binary)) throw new Error("Backup utility unavailable");
  mkdirSync(".local/backups", { recursive: true });
  const backup = resolve(`.local/backups/before-demo-shop-${Date.now()}.dump`);
  const result = spawnSync(binary, ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", "aurel_ai", "-Fc", "-f", backup], { windowsHide: true, stdio: "pipe", env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) } });
  if (result.status !== 0 || !existsSync(backup) || statSync(backup).size < 1000) throw new Error("Backup failed; no data written");
  const verify = spawnSync(resolve(".local/postgres/pgsql/bin/pg_restore.exe"), ["--list", backup], { windowsHide: true, stdio: "pipe" });
  if (verify.status !== 0) throw new Error("Backup directory verification failed");
  console.log("Pre-change PostgreSQL dump created and archive list verified (not a restore rehearsal).");
  await db.query("BEGIN");
  await db.query("SELECT pg_advisory_xact_lock(20261101)");
  for (let index = 0; index < rows.length; index++) {
    const [suffix, name, category, image, gender, fabric, garmentType, price] = rows[index];
    const slug = `demo-cod-${suffix}`;
    if ((await db.query('SELECT 1 FROM "Product" WHERE slug=$1', [slug])).rowCount) { skipped++; continue; }
    const categoryId = (await db.query('INSERT INTO "Category" (name,slug) VALUES ($1,$2) ON CONFLICT (slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id', [{ tops: "Áo", bottoms: "Quần", outerwear: "Áo khoác", accessories: "Phụ kiện" }[category], category])).rows[0].id;
    const description = "SẢN PHẨM DEMO — dữ liệu giá, chất liệu, màu sắc, số đo và tồn kho phục vụ trình diễn, không phải hàng kinh doanh thật. Ảnh minh họa dùng chung cho các mẫu thử và không thể hiện mọi màu. Phí vận chuyển demo 0 đồng; COD không thu tiền online.";
    const id = (await db.query('INSERT INTO "Product" (name,slug,"categoryId",brand,description,"isActive","productCode",collection) VALUES ($1,$2,$3,\'AUREL DEMO\',$4,true,$5,\'demo-2026\') RETURNING id', [`DEMO — ${name}`, slug, categoryId, description, `AUR-20261101${String(index + 1).padStart(2, "0")}`])).rows[0].id;
    await db.query('INSERT INTO "ProductProfile" ("productId",fabric,gender,fit,"garmentType","updatedAt") VALUES ($1,$2,$3,\'regular-fit\',$4,NOW())', [id, fabric, gender, garmentType]);
    for (const color of ["beige", "black"]) for (const size of image === "bag" ? ["ONE SIZE"] : ["S", "M", "L"]) {
      const stock = index === 0 && color === "black" && size === "S" ? 0 : index === 1 && color === "beige" && size === "M" ? 1 : 10;
      const variantId = (await db.query('INSERT INTO "ProductVariant" ("productId",sku,color,size,stock,"isActive") VALUES ($1,$2,$3,$4,$5,true) RETURNING id', [id, `DEMO-COD-${index + 1}-${color.toUpperCase()}-${size.replaceAll(" ", "-")}`, color, size, stock])).rows[0].id;
      await db.query('INSERT INTO "ProductPrice" ("variantId",currency,amount,"updatedAt") VALUES ($1,\'VND\',$2,NOW())', [variantId, price]);
    }
    await db.query('INSERT INTO "ProductImage" ("productId","storageKey","altText","sortOrder","isPrimary","imageType","websitePermission","rightsReference","sourceReference") VALUES ($1,$2,$3,0,true,\'front\',\'granted\',$4,$5)', [id, `/images/aurel/collection-demo/${image}.png`, `Ảnh minh họa DEMO — ${name}`, "Owner authorized demo merchandise on 2026-11-01; existing generated mock assets; public/images/aurel/collection-demo/README.md", "Existing project image_gen demo asset"]);
    created++;
  }
  await db.query("COMMIT");
  const count = await db.query('SELECT COUNT(*)::int products FROM "Product" WHERE slug LIKE \'demo-cod-%\' AND "isActive"=true');
  console.log(JSON.stringify({ created, skipped, publishedDemoProducts: count.rows[0].products, existingProductsUntouched: true, ordersOrUsersCreated: false }));
} catch (error) { await db.query("ROLLBACK").catch(() => {}); throw error; }
finally { await db.end(); }
