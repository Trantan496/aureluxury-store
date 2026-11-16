export const galleryRoles = ["cover", "detail", "fabric", "silhouette", "gallery"] as const;
export type GalleryRole = typeof galleryRoles[number];
export const galleryTypes: Record<GalleryRole, string> = { cover: "front", detail: "detail", fabric: "other", silhouette: "back", gallery: "lifestyle" };
export const galleryTitles: Record<GalleryRole, string> = { cover: "Ảnh chính", detail: "Refined Details", fabric: "Premium Fabric", silhouette: "The Silhouette", gallery: "Ảnh bổ sung" };
export type GalleryImage = { id: string; url: string; alt: string; imageType?: string | null; isPrimary?: boolean; sortOrder?: number; variantId?: string | null };
export function galleryAssignments(images: readonly GalleryImage[], strictRoles = false) {
  const cover = images.find(i => i.isPrimary) ?? images.find(i => i.imageType === "front") ?? (strictRoles ? undefined : images[0]);
  return { cover, detail: images.find(i => i.id !== cover?.id && i.imageType === "detail"), fabric: images.find(i => i.id !== cover?.id && i.imageType === "other"), silhouette: images.find(i => i.id !== cover?.id && i.imageType === "back") };
}
