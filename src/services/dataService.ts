/**
 * SpecialTech AI ERP — Data Service Layer
 * Adapter between frontend and FastAPI + PostgreSQL backend
 */

import { getApiMode, apiRequest } from "./apiClient";

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  isHeadquarters: boolean;
  fleetManagerName: string;
  fleetManagerPhone?: string;
  chiefMechanicName?: string;
  chiefMechanicPhone?: string;
  baseAddress: string;
  regularClients: string[];
  documentFlow: {
    isolatedStreams: boolean;
    isolateCrmAndErp: boolean;
    orderPrefix: string;
    waybillPrefix: string;
    shiftPrefix: string;
    actPrefix: string;
    oneCDepartmentCode: string;
    default1CSubject: string;
  };
  fixedOverheads?: Array<{ id: string; category: string; name: string; monthlyAmountRub: number }>;
}

export interface Equipment {
  id: string;
  branchId: string;
  inventoryNumber: string;
  name: string;
  type: string;
  brand: string;
  plateNumber: string;
  vin: string;
  year: number;
  owner: string;
  purchasePrice: number;
  currentValue: number;
  status: string;
  assignedSite?: string;
  assignedOperator?: string;
  currentHours: number;
  monthHours: number;
  hourlyRate: number;
  fuelRateHour: number;
  fuelCostMonth: number;
  driverSalaryMonth: number;
  repairCostMonth: number;
  overheadsAllocated: number;
  revenueMonth: number;
  downtimeHoursMonth: number;
  nextMaintenanceInHours: number;
}

export interface CRMDeal {
  id: string;
  branchId: string;
  clientName: string;
  clientType: string;
  siteAddress: string;
  equipmentType: string;
  hourlyRateAgreed: number;
  stage: string;
  dealAmount: number;
  debtAmount: number;
  dateCreated: string;
  stageUpdatedAt: string;
}

export interface RentalOrder {
  id: string;
  branchId: string;
  orderNumber: string;
  clientName: string;
  siteAddress: string;
  equipmentType: string;
  hourlyRate: number;
  estimatedHours: number;
  status: string;
  dateCreated: string;
}

export interface ShiftReport {
  id: string;
  branchId: string;
  shiftNumber: string;
  equipmentId: string;
  equipmentName: string;
  driverId?: string;
  driverName?: string;
  date: string;
  workHours: number;
  startHours: number;
  endHours: number;
  fuelLiters: number;
  status: string;
}

export interface AnomalyAlert {
  id: string;
  branchId: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  equipmentId?: string;
  date: string;
  impactRubles: number;
  resolved: boolean;
}

export interface DriverProfile {
  id: string;
  branchId: string;
  fullName: string;
  phone?: string;
  status: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; role: string; branchId?: string | null };
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function api<T>(path: string, method?: HttpMethod, body?: any): Promise<T> {
  if (getApiMode() !== "fastapi") throw new Error("API mode is not fastapi");
  return apiRequest<T>(path, { method, body });
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return api<LoginResponse>("/auth/login", "POST", { username, password });
}

export function logout(): void {
  (window as any).__spectecLogout?.();
}

export function isAuthenticated(): boolean {
  return (window as any).__spectecAuth !== null;
}

export async function fetchBranches(): Promise<Branch[]> {
  return api<Branch[]>("/branches");
}

export async function updateBranch(branchId: string, data: Partial<Branch>): Promise<Branch> {
  return api<Branch>(`/branches/${encodeURIComponent(branchId)}`, "PATCH", data);
}

export async function fetchEquipment(branchId?: string): Promise<Equipment[]> {
  const url = branchId ? `/fleet?branch_id=${branchId}` : "/fleet";
  return api<Equipment[]>(url);
}

export async function fetchDeals(branchId?: string): Promise<CRMDeal[]> {
  const url = branchId ? `/crm/deals?branch_id=${branchId}` : "/crm/deals";
  return api<CRMDeal[]>(url);
}

export async function createDeal(data: Partial<CRMDeal>): Promise<CRMDeal> {
  return api<CRMDeal>("/crm/deals", "POST", data);
}

export async function moveDealStage(dealId: string, stage: string): Promise<CRMDeal> {
  return api<CRMDeal>(`/crm/deals/${encodeURIComponent(dealId)}/stage`, "PATCH", { stage });
}

export async function fetchOrders(branchId?: string): Promise<RentalOrder[]> {
  const url = branchId ? `/rentals?branch_id=${branchId}` : "/rentals";
  return api<RentalOrder[]>(url);
}

export async function fetchShifts(branchId?: string): Promise<ShiftReport[]> {
  const url = branchId ? `/timesheets/shifts?branch_id=${branchId}` : "/timesheets/shifts";
  return api<ShiftReport[]>(url);
}

export async function submitShift(data: Partial<ShiftReport>): Promise<ShiftReport> {
  return api<ShiftReport>("/timesheets/shifts/submit", "POST", data);
}

export async function approveShift(shiftId: string): Promise<ShiftReport> {
  return api<ShiftReport>(`/timesheets/shifts/${encodeURIComponent(shiftId)}/approve`, "POST");
}

export async function fetchAnomalies(branchId?: string): Promise<AnomalyAlert[]> {
  const url = branchId ? `/audit/anomalies?branch_id=${branchId}` : "/audit/anomalies";
  return api<AnomalyAlert[]>(url);
}

export async function fetchDrivers(branchId?: string): Promise<DriverProfile[]> {
  const url = branchId ? `/drivers?branch_id=${branchId}` : "/drivers";
  return api<DriverProfile[]>(url);
}

export async function bootstrapWorkspace(branchId?: string): Promise<void> {
  const url = branchId ? `/workspace/bootstrap?branch_id=${branchId}` : "/workspace/bootstrap";
  return api<void>(url);
}

export async function setActiveBranch(branchId: string): Promise<void> {
  return api<void>("/workspace/active-branch", "PUT", { branchId });
}

export async function checkHealth(): Promise<{ status: string; service: string; version: string; database: string }> {
  return api<{ status: string; service: string; version: string; database: string }>("/health");
}
