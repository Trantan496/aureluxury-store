import { TryOnStudio } from "@/components/tryon/tryon-studio";

export const metadata = {
  title: "Virtual Try-On Sandbox | AUREL",
};

export default function TryOnTestPortalPage() {
  return (
    <TryOnStudio
      catalogGarments={[]}
      catalogStatus="success"
      eyebrow="AUREL / CATVTON 768×1024"
      heading="Virtual Try-On Sandbox"
      subtitle="Trang kiểm thử nhanh CatVTON GPU cục bộ với trang phục mẫu hoặc ảnh tải lên trực tiếp từ máy."
    />
  );
}
