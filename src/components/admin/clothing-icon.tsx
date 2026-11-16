import type {ClothingIcon as Kind} from "@/features/products/category-options";
// Original outline artwork; no third-party logos or image dependencies.
export function ClothingIcon({kind}:{kind:Kind}) {
  const paths:Record<Kind,string>={
    shirt:"m8 4-5 3-2 5 4 2 1-3v11h12V11l1 3 4-2-2-5-5-3M8 4c0 4 8 4 8 0",
    polo:"m8 4-5 3-2 5 4 2 1-3v11h12V11l1 3 4-2-2-5-5-3M8 4l4 4 4-4M12 8v5",
    jacket:"m8 3-5 3-2 15 4 1 2-13-1 14h12L17 9l2 13 4-1-2-15-5-3M8 3l4 5 4-5M12 8v15M8 16H6m10 0h2",
    vest:"M8 3 4 6l2 6v11h12V12l2-6-4-3-4 5-4-5Zm0 0 2 8-3 2 5 7 5-7-3-2 2-8M12 20v3",
    tank:"M7 3H4l2 9v11h12V12l2-9h-3c0 8-10 8-10 0Z",
    knit:"m8 4-5 3-2 14 4 1 2-12-1 13h12L17 10l2 12 4-1-2-14-5-3M8 4c0 5 8 5 8 0M6 20h12",
    hoodie:"M8 6c-2-7 10-7 8 0l5 3 2 12-4 1-2-11 1 12H6l1-12-2 11-4-1L3 9l5-3Zm0 0 4 3 4-3M9 17l-1 3h8l-1-3M10 9v4m4-4v4",
    trousers:"M6 2h12l2 21h-7l-1-13-1 13H4L6 2Zm0 3h12M12 5v5M8 5l-2 5m10-5 2 5",
    shorts:"M5 3h14l3 17h-8l-2-9-2 9H2L5 3Zm0 3h14M12 6v5",
    skirt:"M7 3h10l5 19H2L7 3Zm0 3h10M9 7 7 20m8-13 2 13",
    dress:"M8 2H6l1 7 3 3-6 11h16l-6-11 3-3 1-7h-2c0 4-8 4-8 0ZM10 12h4",
    underwear:"M2 6h20l-2 7-6 7h-4l-6-7-2-7Zm0 3h20M4 13c5-2 7 1 8 7 1-6 3-9 8-7",
    accessories:"M4 8h16l2 13H2L4 8Zm4 0V6a4 4 0 0 1 8 0v2M9 13h6",
  };
  return <svg viewBox="0 0 24 26" width="28" height="30" fill="none" stroke="currentColor" strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;
}
