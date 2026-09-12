export function asArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

export function formatMoney(value: any): string {
  const numeric = Number(value) || 0;
  return `${Math.round(numeric).toLocaleString("vi-VN")}d`;
}

export function formatPercent(value: any): string {
  const numeric = Number(value) || 0;
  return `${numeric.toFixed(1)}%`;
}

export function removeVietnameseTone(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function labelScaleAction(action: string): string {
  switch (action) {
    case "increase":
      return "De xuat tang ngan sach";
    case "decrease":
      return "De xuat giam ngan sach";
    case "kill":
      return "De xuat tam dung";
    default:
      return "De xuat giu nguyen";
  }
}
