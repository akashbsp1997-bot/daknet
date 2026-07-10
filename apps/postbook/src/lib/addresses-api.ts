import { getToken } from "./auth";

// NOTE: the generated @workspace/api-client-react hooks don't cover the
// endpoints added this session yet (paginated list, verify, verify-digilocker,
// photo, possible-duplicates) — that needs `pnpm --filter @workspace/api-spec
// run codegen` to have actually run against the updated openapi.yaml. Until
// then, this is a small hand-written client for exactly those calls, using
// the same VITE_API_URL + bearer-token convention as the generated one.
// Once codegen has run, these can be swapped for the generated hooks.

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new Error(body.message || `Request failed: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Address {
  id: string;
  uniqueCode: string;
  name: string;
  type: string;
  gpsLat: number;
  gpsLng: number;
  fullAddress: string;
  contactPerson: string | null;
  contactNumber: string | null;
  accessHours: string | null;
  notes: string | null;
  digipin: string | null;
  digilockerVerified: boolean;
  digilockerVerifiedName: string | null;
  digilockerVerifiedMobile: string | null;
  digilockerVerifiedAt: string | null;
  verificationStatus: "pending" | "verified" | "rejected";
  verifiedBy: string | null;
  verifiedAt: string | null;
  referencePhotoUrl: string | null;
  beatId: string | null;
  officeId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddressListResponse {
  items: Address[];
  nextCursor: string | null;
}

export interface ListAddressesParams {
  officeId?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export function listAddresses(params: ListAddressesParams): Promise<AddressListResponse> {
  const search = new URLSearchParams();
  if (params.officeId) search.set("officeId", params.officeId);
  if (params.q) search.set("q", params.q);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return apiFetch<AddressListResponse>(`/api/addresses${qs ? `?${qs}` : ""}`);
}

export interface CreateAddressInput {
  name: string;
  type: string;
  gpsLat: number;
  gpsLng: number;
  fullAddress: string;
  contactPerson?: string;
  contactNumber?: string;
  accessHours?: string;
  notes?: string;
  beatId?: string;
  officeId: string;
}

export function createAddress(data: CreateAddressInput): Promise<Address> {
  return apiFetch<Address>("/api/addresses", { method: "POST", body: JSON.stringify(data) });
}

export function getAddress(id: string): Promise<Address> {
  return apiFetch<Address>(`/api/addresses/${id}`);
}

export function verifyAddress(id: string, status: "verified" | "rejected"): Promise<Address> {
  return apiFetch<Address>(`/api/addresses/${id}/verify`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function verifyDigilocker(id: string): Promise<Address> {
  return apiFetch<Address>(`/api/addresses/${id}/verify-digilocker`, { method: "POST" });
}

export function getPossibleDuplicates(id: string): Promise<Address[]> {
  return apiFetch<Address[]>(`/api/addresses/${id}/possible-duplicates`);
}

export async function uploadAddressPhoto(id: string, file: File): Promise<Address> {
  const formData = new FormData();
  formData.append("photo", file);
  return apiFetch<Address>(`/api/addresses/${id}/photo`, { method: "POST", body: formData });
}
