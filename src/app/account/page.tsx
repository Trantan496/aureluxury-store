import Link from "next/link";
import { AccountShell } from "@/components/account/account-shell";
import { ProfileForm, type ProfileData } from "@/components/account/profile-form";
import { shopActor } from "@/features/shop/service";
import { prisma } from "@/lib/db/client";
import styles from "@/components/wishlist/wishlist.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thông tin cá nhân | AUREL" };

async function getProfileData(): Promise<ProfileData | null> {
  try {
    const actor = await shopActor();
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        fullName: true,
        email: true,
        city: true,
        birthYear: true,
        addresses: { orderBy: { id: "desc" }, take: 1, select: { phone: true, line1: true } },
      },
    });
    if (!user) return null;
    return {
      fullName: user.fullName,
      email: user.email,
      city: user.city,
      birthYear: user.birthYear,
      phone: user.addresses[0]?.phone ?? null,
      address: user.addresses[0]?.line1 ?? null,
    };
  } catch {
    return null;
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const isPreview = process.env.NODE_ENV !== "production" && params?.preview === "1";
  const realProfile = await getProfileData();

  const profile =
    realProfile ??
    (isPreview
      ? {
          fullName: "Trần Ngọc Tân",
          email: "khai234991@gmail.com",
          city: null,
          birthYear: null,
          phone: null,
          address: null,
        }
      : null);

  return (
    <AccountShell title="Thông tin cá nhân" current="Thông tin cá nhân">
      {profile ? (
        <ProfileForm initial={profile} />
      ) : (
        <section className={styles.empty} role="status">
          <h2>Đăng nhập để xem thông tin cá nhân</h2>
          <p>Quản lý tài khoản và thông tin mua sắm của bạn cùng AUREL.</p>
          <Link href="/login?next=%2Faccount" className={styles.cta}>
            Đăng nhập
          </Link>
        </section>
      )}
    </AccountShell>
  );
}
