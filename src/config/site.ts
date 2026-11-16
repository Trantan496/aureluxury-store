export const site = { name: "Fashion Store", description: "Không gian thời trang tối giản. Khám phá phong cách theo cách của bạn." };
// Provisional navigation directions, not assertions about available inventory.
export const categories = [
  { slug: "tops", name: "Tops", description: "Refined essentials for everyday expression.", number: "04" },
  { slug: "bottoms", name: "Bottoms", description: "Modern silhouettes built for movement.", number: "05" },
  { slug: "outerwear", name: "Outerwear", description: "Iconic layers for a changing world.", number: "06" },
  { slug: "everyday", name: "Thường ngày", description: "Nhẹ nhàng trong từng lựa chọn.", number: "01" },
  { slug: "workwear", name: "Công sở", description: "Gọn gàng, thanh lịch và tự tin.", number: "02" },
  { slug: "essentials", name: "Thiết yếu", description: "Trở về với những điều cơ bản.", number: "03" },
] as const;
