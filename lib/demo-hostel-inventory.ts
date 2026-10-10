import type { HostelId } from "@/lib/hostels";

export type RoomCapacity = 1 | 2 | 3 | 4;

export const DEMO_HOSTEL_INVENTORY: Record<
  HostelId,
  { rooms: string[]; capacities: RoomCapacity[] }
> = {
  emerald: { rooms: ["E-101", "E-102", "E-103"], capacities: [1, 2, 4] },
  edc: { rooms: ["D-101", "D-102", "D-103"], capacities: [1, 2] },
  faith: { rooms: ["F-101", "F-102", "F-103"], capacities: [2, 3, 4] },
  amethyst: { rooms: ["A-101", "A-102", "A-103"], capacities: [1, 2, 3, 4] },
  "the-pod": { rooms: ["P-101", "P-102", "P-103"], capacities: [1, 2] },
  "cooperative-kings": { rooms: ["K-101", "K-102", "K-103"], capacities: [2, 4] },
  "cooperative-queens": { rooms: ["Q-101", "Q-102", "Q-103"], capacities: [2, 4] },
  "redwood-hall": { rooms: ["R-101", "R-102", "R-103"], capacities: [1, 2] },
  "trinity-hall": { rooms: ["T-101", "T-102", "T-103"], capacities: [1, 2, 3] },
  "pearl-hall": { rooms: ["P-201", "P-202", "P-203"], capacities: [1, 2, 3, 4] },
  "trezadel-hall": { rooms: ["TZ-101", "TZ-102", "TZ-103"], capacities: [1, 2, 4] },
  "queen-mary-hall": { rooms: ["QM-101", "QM-102", "QM-103"], capacities: [1, 2] },
  "cedar-hall": { rooms: ["C-101", "C-102", "C-103"], capacities: [1, 2, 3] },
};
