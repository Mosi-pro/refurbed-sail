export type Role = "buyer" | "private_seller" | "dealer" | "admin";
export type Category = "jolle" | "sportboot" | "kielboot" | "daysailer" | "segelyacht" | "katamaran" | "regattaboot";
export type Condition = "used" | "refurbished" | "restored";
export type RefurbStatus = "none" | "documentation_available" | "inspection_documented" | "work_completed";
export type BoatStatus = "draft" | "pending" | "active" | "paused" | "rejected" | "archived" | "removed";
export type SellerType = "private" | "dealer" | "verified_dealer";
export type DealerVerification = "unverified" | "business_checked" | "verified" | "refurb_documented";
export type ReportSection = "hull" | "deck" | "rigging" | "sails" | "fittings" | "electronics" | "engine" | "interior" | "other";
export type EntryStatus = "inspected" | "renewed" | "repaired" | "not_inspected" | "defect_reported";
export type MessageKind = "message" | "viewing_request" | "info_request";
export type EquipmentKind = "main_sail" | "jib" | "genoa" | "spinnaker" | "gennaker" | "electronics" | "other";

export interface DealerBrief {
  id: number; slug: string; company_name: string; logo_url: string | null; city: string | null;
  verification_status: DealerVerification; is_demo: boolean;
}
export interface Dealer extends DealerBrief {
  description: string | null; contact_email: string | null; phone: string | null; website: string | null;
  street: string | null; postal_code: string | null; country: string; member_since: string; listing_count?: number;
  boats?: BoatCard[];
  verification_history?: { status: DealerVerification; note: string | null; created_at: string }[];
}
export interface User {
  id: number; email: string; display_name: string; location: string | null; phone: string | null; bio: string | null;
  avatar_url: string | null; roles: Role[]; is_demo: boolean; created_at: string; dealer: DealerBrief | null;
}
export interface BoatImage { id: number; url: string; thumb_url: string; width: number; height: number }
export interface BoatCard {
  id: number; reference: string; slug: string; category: Category | null; manufacturer: string | null; model: string | null;
  year: number | null; price_eur: number | null; price_negotiable: boolean; location_city: string | null;
  location_region: string | null; country: string; length_m: number | null; condition: Condition;
  refurb_status: RefurbStatus; status: BoatStatus; seller_type: SellerType; seller_name: string; is_demo: boolean;
  image: BoatImage | null; image_count: number; published_at: string | null; created_at: string; updated_at: string;
  view_count?: number; favorites?: number; inquiries?: number; rejection_reason?: string | null; available?: boolean;
  seller_email?: string; has_report?: boolean;
}
export interface DocumentOut {
  id: number; kind: "pdf" | "image"; title: string; original_name: string; size_bytes: number; entry_id: number | null;
  url: string; created_at: string; boat_id?: number; boat_title?: string;
}
export interface ReportEntry {
  id: number; section: ReportSection; status: EntryStatus; description: string | null; work_date: string | null;
  seller_notes: string | null; documents: DocumentOut[];
}
export interface Report {
  id: number; summary: string | null; seller_notes: string | null;
  verification: "seller_provided" | "independently_verified"; verified_by: string | null; verified_at: string | null;
  updated_at: string; entries: ReportEntry[];
}
export interface Spec {
  length_m: number | null; beam_m: number | null; draft_m: number | null; displacement_kg: number | null;
  hull_material: string | null; sail_area_m2: number | null; mast_height_m: number | null; berths: number | null;
  engine: string | null; trailer: string | null;
}
export interface Seller {
  user_id: number; type: SellerType; name: string; image_url: string | null; location: string | null; member_since: string;
  dealer: DealerBrief | null; other_listings?: BoatCard[]; listing_count?: number;
}
export interface BoatDetail extends BoatCard {
  description: string | null; location_postal: string | null; view_count: number; spec: Spec;
  equipment: Partial<Record<EquipmentKind, string>>; images: BoatImage[]; report: Report | null; documents: DocumentOut[];
  seller: Seller; is_owner?: boolean; publish_errors?: string[];
}
export interface Paged<T> { items: T[]; total: number; page: number; pages: number; page_size?: number }
export interface Facets {
  manufacturers: { name: string; count: number }[]; categories: Record<Category, number>; total: number; has_demo: boolean;
}
export interface Message { id: number; kind: MessageKind; body: string; mine: boolean; created_at: string; read_at: string | null }
export interface Conversation {
  id: number; role: "buyer" | "seller"; other: { name: string; image_url: string | null };
  boat: { id: number; slug: string; reference: string; title: string; year: number | null; price_eur: number | null; status: BoatStatus; thumb_url: string | null };
  unread: number; last_message: Message | null; last_message_at: string; messages?: Message[];
}
