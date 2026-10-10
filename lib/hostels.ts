import hostelGroups from "@/data/hostel-groups.json";

export type HostelId =
  | "emerald"
  | "edc"
  | "faith"
  | "amethyst"
  | "the-pod"
  | "cooperative-kings"
  | "cooperative-queens"
  | "redwood-hall"
  | "trinity-hall"
  | "pearl-hall"
  | "trezadel-hall"
  | "queen-mary-hall"
  | "cedar-hall";

export interface HostelOption {
  id: HostelId;
  name: string;
}

export interface HostelGroup {
  gender: "Male" | "Female";
  hostels: HostelOption[];
}

export const HOSTEL_GROUPS = hostelGroups as HostelGroup[];

export function isHostelId(value: string): value is HostelId {
  return HOSTEL_GROUPS.some((group) => group.hostels.some((hostel) => hostel.id === value));
}

export function getHostelName(id: string | null): string | null {
  if (!id) {
    return null;
  }
  return HOSTEL_GROUPS.flatMap((group) => group.hostels).find((hostel) => hostel.id === id)?.name ?? id;
}
