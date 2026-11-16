import { InputError, object } from "./validation.ts";

export type DynamicAttribute = { key: string; label: string; options: readonly string[]; multiple?: boolean; dependsOn?: { key: string; values: readonly string[] } };
export type DynamicAttributeValues = Record<string, string | string[]>;
const field = (key: string, label: string, options: readonly string[], multiple = false): DynamicAttribute => ({ key, label, options, ...(multiple ? { multiple: true } : {}) });

// Stable keys are deliberately English/machine-readable; Vietnamese remains presentation only.
export const productTypeAttributes = {
  "t-shirt": [field("neckline", "Kiểu cổ", ["Cổ tròn", "Cổ V", "Cổ thuyền", "Henley"]), field("sleeve_length", "Độ dài tay", ["Sát nách", "Tay ngắn", "Tay lỡ", "Tay dài"]), field("sleeve_style", "Kiểu tay", ["Tay thường", "Raglan", "Tay rơi"]), field("garment_length", "Chiều dài áo", ["Cropped", "Tiêu chuẩn", "Dáng dài"]), field("print_type", "Kiểu hình in", ["Không in", "Logo", "Graphic"]), { ...field("print_placement", "Vị trí hình in", ["Phía trước", "Phía sau", "Tay áo"], true), dependsOn: { key: "print_type", values: ["Logo", "Graphic"] } }],
  shirt: [field("neckline", "Kiểu cổ", ["Cổ Đức", "Cổ tàu", "Cổ Cuba"]), field("sleeve_length", "Độ dài tay", ["Tay ngắn", "Tay dài"]), field("cuff_style", "Kiểu cổ tay", ["Thường", "French Cuff"]), field("hem_style", "Kiểu vạt áo", ["Vạt ngang", "Vạt cong"]), field("closure_style", "Kiểu đóng áo", ["Hàng nút", "Nút ẩn"]), field("sheerness", "Độ xuyên thấu", ["Không xuyên thấu", "Bán xuyên thấu", "Xuyên thấu"])],
  polo: [field("neckline", "Kiểu cổ", ["Cổ dệt bo", "Cổ sơ mi"]), field("placket_style", "Kiểu nẹp", ["2 nút", "3 nút", "Khóa kéo"]), field("sleeve_length", "Độ dài tay", ["Tay ngắn", "Tay dài"]), field("cuff", "Bo tay", ["Có", "Không"]), field("fabric_structure", "Cấu trúc vải", ["Piqué", "Jersey", "Interlock"]), field("hem_style", "Kiểu gấu", ["Gấu thẳng", "Xẻ hai bên"])],
  trousers: [field("trouser_style", "Kiểu quần", ["Quần tây", "Chino", "Cargo", "Jogger"]), field("pant_leg_style", "Kiểu ống", ["Straight", "Tapered", "Wide", "Flare"]), field("waist_rise", "Độ cao cạp", ["Cạp thấp", "Cạp trung bình", "Cạp cao"]), field("length", "Chiều dài", ["Cropped", "Mắt cá", "Dáng dài"]), field("pleats", "Ly quần", ["Không ly", "1 ly", "2 ly"]), field("waistband", "Kiểu cạp", ["Cạp thường", "Cạp chun", "Dây rút"])],
  jeans: [field("pant_leg_style", "Kiểu ống", ["Skinny", "Slim", "Straight", "Wide", "Bootcut"]), field("waist_rise", "Độ cao cạp", ["Low-rise", "Mid-rise", "High-rise"]), field("denim_wash", "Màu wash", ["Light Wash", "Medium Wash", "Dark Wash", "Raw Denim"]), field("surface_treatment", "Xử lý bề mặt", ["Trơn", "Rách", "Bạc màu"]), field("stretch", "Độ co giãn", ["Không co giãn", "Co giãn nhẹ", "Co giãn cao"]), field("hem_style", "Kiểu gấu", ["Nguyên bản", "Xắn gấu", "Tua rua"])],
  shorts: [field("trouser_style", "Kiểu quần", ["Chino", "Bermuda", "Cargo", "Sport"]), field("length", "Chiều dài", ["Giữa đùi", "Trên gối", "Ngang gối"]), field("pant_leg_style", "Kiểu ống", ["Ôm", "Thẳng", "Rộng"]), field("waistband", "Kiểu cạp", ["Cạp chun", "Cạp nút", "Dây rút"]), field("pocket_style", "Kiểu túi", ["Túi chéo", "Túi hộp", "Túi sau"]), field("lining", "Lớp lót", ["Có", "Không"])],
  skirt: [field("skirt_shape", "Phom váy", ["Chữ A", "Bút chì", "Xếp ly", "Đuôi cá"]), field("length", "Chiều dài", ["Mini", "Midi", "Maxi"]), field("waist_rise", "Độ cao cạp", ["Cạp thấp", "Cạp trung bình", "Cạp cao"]), field("pleats", "Kiểu xếp ly", ["Không", "Ly nhỏ", "Ly lớn"]), field("slit", "Đường xẻ", ["Không", "Phía trước", "Phía sau", "Bên hông"]), field("closure_style", "Kiểu đóng", ["Khóa kéo", "Nút", "Cạp chun"])],
  dress: [field("dress_style", "Kiểu đầm", ["Wrap", "Slip", "Shirt Dress", "Bodycon"]), field("neckline", "Kiểu cổ", ["Cổ tròn", "Cổ V", "Cổ vuông", "Cổ tim"]), field("sleeve_length", "Độ dài tay", ["Không tay", "Tay ngắn", "Tay dài"]), field("length", "Chiều dài", ["Mini", "Midi", "Maxi"]), field("waist_position", "Vị trí eo", ["Eo tự nhiên", "Eo cao", "Eo hạ"]), field("skirt_shape", "Phom phần váy", ["Chữ A", "Suông", "Ôm", "Xòe"]), field("slit", "Đường xẻ", ["Không", "Phía trước", "Bên hông", "Phía sau"])],
  jacket: [field("jacket_style", "Kiểu áo", ["Denim Jacket", "Bomber", "Blazer", "Parka"]), field("neckline", "Kiểu cổ", ["Cổ bẻ", "Cổ đứng", "Cổ tròn"]), field("closure_style", "Kiểu khóa", ["Nút", "Khóa kéo", "Không khóa"]), field("hood", "Mũ trùm", ["Có", "Không"]), field("lining", "Lớp lót", ["Có", "Không"]), field("fabric_weight", "Độ dày", ["Mỏng", "Vừa", "Dày"]), field("length", "Chiều dài", ["Cropped", "Ngang hông", "Dáng dài"])],
  coat: [field("lapel_style", "Kiểu ve áo", ["Notch", "Peak", "Shawl"]), field("button_row", "Hàng nút", ["Một hàng", "Hai hàng"]), field("length", "Chiều dài", ["Ngang đùi", "Ngang gối", "Bắp chân"]), field("belt", "Đai thắt lưng", ["Có", "Không"]), field("shell_material", "Chất liệu vỏ", ["Wool", "Cashmere", "Blend"]), field("lining", "Lớp lót", ["Toàn phần", "Một phần", "Không"]), field("warmth", "Độ giữ ấm", ["Nhẹ", "Trung bình", "Cao"])],
  knitwear: [field("knit_product_type", "Loại sản phẩm", ["Sweater", "Cardigan", "Gile"]), field("knit_style", "Kiểu dệt", ["Rib", "Cable", "Jersey"]), field("knit_gauge", "Độ thô mũi đan", ["Fine", "Medium", "Chunky"]), field("neckline", "Kiểu cổ", ["Cổ tròn", "Cổ V", "Cổ lọ"]), field("sleeve_length", "Độ dài tay", ["Không tay", "Tay ngắn", "Tay dài"]), field("closure_style", "Kiểu đóng", ["Không", "Nút", "Khóa kéo"]), field("fabric_weight", "Độ dày", ["Mỏng", "Vừa", "Dày"])],
} as const;

export type ProductType = keyof typeof productTypeAttributes;
export function attributesFor(type: string | null | undefined) { return type && Object.hasOwn(productTypeAttributes, type) ? productTypeAttributes[type as ProductType] : []; }
export function visibleAttributes(type: string | null | undefined, values: DynamicAttributeValues) { return attributesFor(type).filter(attribute => !attribute.dependsOn || (attribute.dependsOn.values as readonly string[]).includes(values[attribute.dependsOn.key] as string)); }
export function dynamicAttributes(input: unknown, productType: string | null): DynamicAttributeValues {
  const values = object(input ?? {}, attributesFor(productType).map(attribute => attribute.key));
  const output: DynamicAttributeValues = {};
  for (const attribute of attributesFor(productType)) {
    if (attribute.dependsOn && !(attribute.dependsOn.values as readonly string[]).includes(values[attribute.dependsOn.key] as string)) continue;
    const value = values[attribute.key];
    if (value === undefined || value === null || value === "") continue;
    const selections = attribute.multiple ? value : [value];
    if (!Array.isArray(selections) || !selections.length || selections.some(selection => typeof selection !== "string" || !attribute.options.includes(selection))) throw new InputError(`dynamicAttributes.${attribute.key}`);
    if (!attribute.multiple && selections.length !== 1) throw new InputError(`dynamicAttributes.${attribute.key}`);
    if (new Set(selections).size !== selections.length) throw new InputError(`dynamicAttributes.${attribute.key}`);
    output[attribute.key] = attribute.multiple ? selections : selections[0];
  }
  return output;
}
