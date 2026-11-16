type DashIconName = "box" | "check" | "archive" | "alert" | "eye" | "edit" | "external" | "plus" | "search" | "image" | "chart" | "donut" | "bars" | "x" | "chevron-left" | "chevron-right" | "calendar";

const paths: Record<DashIconName, string> = {
  box: "m3 7.5 9-4.5 9 4.5v9L12 21l-9-4.5v-9Zm0 0 9 4.5 9-4.5M12 12v9",
  check: "M20 6 9 17l-5-5",
  archive: "M3 4h18v4H3V4Zm2 4v12h14V8M10 12h4",
  alert: "M12 3 2.5 20h19L12 3Zm0 6v5m0 3h.01",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  edit: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  plus: "M12 5v14M5 12h14",
  search: "m20 20-4.5-4.5M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  image: "M4 5h16v14H4V5Zm0 11 4-4 3 3 4-5 5 6M9 9.5h.01",
  chart: "M3 17l5-5 4 3 8-8M15 7h5v5",
  donut: "M12 3a9 9 0 1 0 9 9h-9V3Zm3-.5V9h6.5A9 9 0 0 0 15 2.5Z",
  bars: "M4 6h10M4 12h16M4 18h7",
  x: "M6 6l12 12M18 6 6 18",
  "chevron-left": "m15 6-6 6 6 6",
  "chevron-right": "m9 6 6 6-6 6",
  calendar: "M4 6h16v14H4V6Zm0 4h16M8 3v4m8-4v4",
};

export function DashIcon({ name }: { name: DashIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
