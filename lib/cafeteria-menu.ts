import menuData from "@/data/sample-menus.json";
import type { HostelId } from "@/lib/hostels";
import type { MenuCategory } from "@/lib/models";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  quantityAvailable: number;
}

export const SAMPLE_MENUS = menuData as Record<HostelId, MenuItem[]>;

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}
