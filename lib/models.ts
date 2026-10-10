import type { ObjectId } from "mongodb";
import type { HostelId } from "@/lib/hostels";

export type UserRole = "student" | "admin" | "warden";

export interface UserDocument {
  _id?: ObjectId;
  name: string;
  normalizedName: string;
  username?: string;
  normalizedUsername?: string;
  passwordHash: string;
  email?: string;
  normalizedEmail?: string;
  matricNumber?: string;
  normalizedMatricNumber?: string;
  phone?: string;
  hostel: HostelId | null;
  roomNumber: string | null;
  roomCapacity?: 1 | 2 | 3 | 4 | null;
  accommodationPaymentStatus?: "paid" | "not_required";
  role: UserRole;
  createdAt: Date;
}

export interface AuthUser {
  id: string;
  name: string;
  hostel: HostelId | null;
  roomNumber: string | null;
  role: UserRole;
}

export interface HostelDocument {
  _id: HostelId;
  name: string;
  gender: "Male" | "Female";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HostelRoomInventoryDocument {
  _id?: ObjectId;
  hostelId: HostelId;
  roomNumber: string;
  supportedCapacities: Array<1 | 2 | 3 | 4>;
  capacity: 1 | 2 | 3 | 4 | null;
  bookedCount: number;
}

export type MenuCategory = "Breakfast" | "Lunch" | "Dinner" | "Drinks";

export interface CafeteriaMenuItemDocument {
  _id: string;
  hostelId: HostelId;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  stockAvailable: number;
  active: boolean;
  isSample: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CafeteriaOrderLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CafeteriaOrderDocument {
  _id?: ObjectId;
  userId: ObjectId;
  studentName: string;
  hostelId: HostelId;
  hostelName: string;
  items: CafeteriaOrderLine[];
  total: number;
  status: "pending" | "preparing" | "ready" | "collected" | "cancelled";
  isSampleMenu: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type LaundryServiceId = "wash-fold" | "wash-iron" | "dry-clean";

export function isLaundryServiceId(value: string): value is LaundryServiceId {
  return value === "wash-fold" || value === "wash-iron" || value === "dry-clean";
}

export interface LaundryServiceDocument {
  _id: string;
  serviceId: LaundryServiceId;
  hostelId: HostelId;
  name: string;
  description: string;
  pricePerLoad: number;
  active: boolean;
  isSample: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LaundryRequestDocument {
  _id?: ObjectId;
  userId: ObjectId;
  studentName: string;
  hostelId: HostelId;
  hostelName: string;
  serviceId: LaundryServiceId;
  serviceName: string;
  loadCount: number;
  pricePerLoad: number;
  total: number;
  pickupDate: string;
  notes: string;
  status: "pending" | "accepted" | "collected" | "processing" | "ready" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export type ComplaintCategory =
  | "maintenance"
  | "cleanliness"
  | "noise"
  | "safety"
  | "other";

export function isComplaintCategory(value: string): value is ComplaintCategory {
  return (
    value === "maintenance" ||
    value === "cleanliness" ||
    value === "noise" ||
    value === "safety" ||
    value === "other"
  );
}

export interface ComplaintDocument {
  _id?: ObjectId;
  userId: ObjectId;
  studentName: string;
  hostelId: HostelId;
  hostelName: string;
  category: ComplaintCategory;
  subject: string;
  details: string;
  status: "open" | "in_review" | "resolved" | "closed";
  adminResponse?: string;
  handledBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
