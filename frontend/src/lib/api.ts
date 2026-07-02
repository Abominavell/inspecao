const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Não autorizado");
  }
    if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail ?? err;
    if (typeof detail === "object" && detail !== null && !Array.isArray(detail)) {
      if (Array.isArray((detail as { errors?: string[] }).errors)) {
        throw new Error((detail as { errors: string[] }).errors.join("\n"));
      }
      if ((detail as { message?: string }).message) {
        throw new Error((detail as { message: string }).message);
      }
      const fieldErrors = Object.entries(detail as Record<string, unknown>)
        .flatMap(([key, value]) => {
          if (key === "detail") return [];
          if (Array.isArray(value)) return value.map((v) => `${key}: ${v}`);
          if (typeof value === "string") return [`${key}: ${value}`];
          return [];
        });
      if (fieldErrors.length) throw new Error(fieldErrors.join("\n"));
    }
    if (Array.isArray(detail)) throw new Error(detail.join("\n"));
    if (res.status === 403) throw new Error("Sem permissão para esta ação");
    throw new Error(typeof detail === "string" ? detail : "Erro na requisição");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

function unwrapList<T>(data: T[] | Paginated<T>): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token?: string | null }>("/auth/login/json", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  refreshToken: (refresh: string) =>
    request<{ access_token: string; refresh_token?: string }>("/auth/token/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }),

  me: () => request<UserAccount>("/auth/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ detail: string }>("/auth/me/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),

  getUsers: () =>
    request<UserAccount[] | Paginated<UserAccount>>("/auth/users").then(unwrapList),
  createUser: (data: UserCreateInput) =>
    request<UserAccount>("/auth/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id: number) => request<void>(`/auth/users/${id}`, { method: "DELETE" }),

  getUnits: () => request<Unit[] | Paginated<Unit>>("/units").then(unwrapList),
  createUnit: (data: UnitInput) =>
    request<Unit>("/units", { method: "POST", body: JSON.stringify(data) }),
  updateUnit: (id: number, data: UnitInput) =>
    request<Unit>(`/units/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUnit: (id: number) => request<void>(`/units/${id}`, { method: "DELETE" }),

  getChecklist: (inspectionId?: number) =>
    request<ChecklistSection[]>(
      `/checklist${inspectionId ? `?inspection_id=${inspectionId}` : ""}`
    ),

  getSsmaConfig: () => request<SsmaConfig>("/config/ssma"),

  getInspections: (filters: InspectionFilters = {}) =>
    request<Inspection[] | Paginated<Inspection>>(`/inspections${buildQuery(filters)}`).then(
      unwrapList
    ),
  createInspection: (data: { unit_id: number; inspection_date: string; report_date: string }) =>
    request<Inspection>("/inspections", { method: "POST", body: JSON.stringify(data) }),
  getInspection: (id: number) => request<Inspection>(`/inspections/${id}`),
  updateInspection: (id: number, data: Partial<Inspection>) =>
    request<Inspection>(`/inspections/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  archiveInspection: (id: number) =>
    request<Inspection>(`/inspections/${id}/archive`, { method: "POST" }),

  reopenInspection: (id: number) =>
    request<Inspection>(`/inspections/${id}/reopen`, { method: "POST" }),

  cloneInspection: (id: number) =>
    request<Inspection>(`/inspections/${id}/clone`, { method: "POST" }),

  getAuditLog: (id: number) => request<AuditLogEntry[]>(`/inspections/${id}/audit-log`),

  getAnswers: (id: number) => request<Answer[]>(`/inspections/${id}/answers`),
  saveAnswers: (id: number, answers: AnswerInput[]) =>
    request<Answer[]>(`/inspections/${id}/answers`, {
      method: "PUT",
      body: JSON.stringify({ answers }),
    }),

  getScores: (id: number) => request<Scores>(`/inspections/${id}/scores`),
  getNonConformities: (id: number) => request<NonConformity[]>(`/inspections/${id}/non-conformities`),
  getCompleteness: (id: number) => request<Completeness>(`/inspections/${id}/completeness`),

  uploadPhoto: async (
    inspectionId: number,
    file: File,
    opts: { answerId?: number; checklistItemId?: number }
  ) => {
    const form = new FormData();
    if (opts.answerId) form.append("answer_id", String(opts.answerId));
    if (opts.checklistItemId) form.append("checklist_item_id", String(opts.checklistItemId));
    form.append("file", file);
    return request<Photo>(`/inspections/${inspectionId}/photos`, { method: "POST", body: form });
  },

  deletePhoto: (inspectionId: number, photoId: number) =>
    request<void>(`/inspections/${inspectionId}/photos/${photoId}`, { method: "DELETE" }),

  photoUrl: (inspectionId: number, photoId: number) =>
    `${API_URL}/inspections/${inspectionId}/photos/${photoId}`,

  addressPhotoUrl: (inspectionId: number) =>
    `${API_URL}/inspections/${inspectionId}/address-photo`,

  uploadAddressPhoto: async (inspectionId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ has_address_photo: boolean }>(
      `/inspections/${inspectionId}/address-photo`,
      { method: "POST", body: form }
    );
  },

  deleteAddressPhoto: (inspectionId: number) =>
    request<void>(`/inspections/${inspectionId}/address-photo`, { method: "DELETE" }),

  downloadPdf: async (inspectionId: number) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/inspections/${inspectionId}/report/pdf`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = err.detail ?? err;
      if (typeof detail === "object" && detail?.errors) {
        throw new Error((detail.errors as string[]).join("\n"));
      }
      throw new Error(typeof detail === "string" ? detail : "Falha ao gerar PDF");
    }
    return res.blob();
  },

  syncPush: (mutations: SyncMutationInput[]) =>
    request<SyncPushResult>("/sync/push", {
      method: "POST",
      body: JSON.stringify({ mutations }),
    }),

  syncPull: (since?: string) =>
    request<SyncPullResult>(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`),
};

export type InspectionFilters = {
  status?: string;
  unit_id?: number;
  regional?: string;
  search?: string;
  mine?: boolean;
  archived?: "true" | "false" | "all";
  date_from?: string;
  date_to?: string;
};

export type AuditLogEntry = {
  id: number;
  action: string;
  details: string;
  user_name: string;
  created_at: string;
};

export type UnitInput = {
  name: string;
  regional: string;
  city: string;
  address: string;
  unit_type: string;
  employee_count: number;
  admin_coordinator: string;
  general_director: string;
  characterization: string;
};

export type Unit = UnitInput & { id: number; created_at: string };

export function getInspectionUnitId(insp: Inspection): number | undefined {
  return insp.unit?.id ?? insp.unit_id;
}

export type ChecklistItem = {
  id: number;
  order: number;
  item_code: string;
  question: string;
};

export type ChecklistSection = {
  id: number;
  order: number;
  title: string;
  items: ChecklistItem[];
};

export type Inspection = {
  id: number;
  unit_id: number;
  inspection_date: string;
  report_date: string;
  status: string;
  is_archived?: boolean;
  created_by_id?: number;
  created_by_name?: string;
  checklist_version_label?: string;
  methodology_text: string;
  objectives_text: string;
  limitations_text: string;
  final_considerations_text: string;
  general_info_text: string;
  cover_diretoria_executiva: string;
  cover_diretor_executivo: string;
  cover_gerencia_geral: string;
  cover_gerente_geral: string;
  cover_gerencia_sst: string;
  cover_gerente_sst: string;
  cover_gerencia_meio_ambiente: string;
  cover_gerente_meio_ambiente: string;
  overall_score: number | null;
  has_address_photo?: boolean;
  unit?: { id: number; name: string; regional: string; city: string };
};

export type InspectionCoverInput = {
  cover_diretor_executivo: string;
  cover_gerente_geral: string;
  cover_gerente_sst: string;
  cover_gerente_meio_ambiente: string;
};

export type AnswerInput = {
  checklist_item_id: number;
  status: "C" | "NC" | "NA" | null;
  description: string;
  recommendation: string;
  normative: string;
};

export type Answer = AnswerInput & {
  id: number;
  photos: Photo[];
};

export type Photo = {
  id: number;
  answer_id: number;
  file_path: string;
  original_filename: string;
  url: string;
};

export type SectionScore = {
  section_id: number;
  section_order: number;
  section_title: string;
  conforme: number;
  nao_conforme: number;
  nao_aplicavel: number;
  total_applicable: number;
  score: number | null;
};

export type Scores = {
  sections: SectionScore[];
  overall_conforme: number;
  overall_nao_conforme: number;
  overall_nao_aplicavel: number;
  overall_score: number | null;
};

export type NonConformity = {
  item_code: string;
  question: string;
  description: string;
  normative: string;
  recommendation: string;
  section_title: string;
  photos: string[];
};

export type Completeness = {
  unit_complete: boolean;
  address_photo_complete: boolean;
  cover_complete: boolean;
  texts_complete: boolean;
  checklist_answered: number;
  checklist_total: number;
  checklist_complete: boolean;
  nc_without_photo: number;
  ready_for_report: boolean;
  pending_items: string[];
  pending_count: number;
  errors: string[];
};

export type SsmaConfig = {
  diretoria_executiva: string;
  diretor_executivo: string;
  gerencia_geral: string;
  gerente_geral: string;
  gerencia_sst: string;
  gerente_sst: string;
  gerencia_meio_ambiente: string;
  gerente_meio_ambiente: string;
  regional: string;
  cidade: string;
};

export type UserAccount = {
  id: number;
  email: string;
  name: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
};

export type UserCreateInput = {
  email: string;
  name: string;
  password: string;
  is_staff?: boolean;
  is_active?: boolean;
};

export type SyncMutationInput = {
  mutation_id: string;
  type: string;
  payload: Record<string, unknown>;
};

export type SyncPushApplied = {
  mutation_id?: string;
  type?: string;
  client_id?: string;
  server_id?: number;
  client_photo_id?: string;
  server_photo_id?: number;
  conflict?: boolean;
};

export type SyncPushResult = {
  applied: SyncPushApplied[];
  id_map: Record<string, number>;
  conflicts: SyncPushApplied[];
  errors: Array<{ mutation_id: string; error: string }>;
};

export type SyncPullResult = {
  inspections: Array<{
    client_id: string;
    inspection: Inspection;
    answers: Answer[];
  }>;
  pulled_at: string;
};
