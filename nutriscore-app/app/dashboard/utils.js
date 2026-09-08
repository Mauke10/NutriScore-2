export function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

export function todayStr() {
  return localDateStr(new Date());
}

export function mondayOf(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return localDateStr(date);
}

export function currentMonthStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

export function numOrEmpty(v) {
  return v === null || v === undefined ? "" : v;
}

export const PEOPLE = [
  { key: "martin", name: "Martin", seriesVar: "--series-martin" },
  { key: "laura", name: "Laura", seriesVar: "--series-laura" }
];

export function otherOf(key) {
  return key === "martin" ? "laura" : "martin";
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(monthStr) {
  const [, m] = monthStr.split("-").map(Number);
  return MONTH_ABBR[(m || 1) - 1] || monthStr;
}
