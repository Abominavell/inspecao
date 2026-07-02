import Dexie, { type Table } from "dexie";

export type SyncStatus = "local" | "pending" | "synced" | "conflict";

export type LocalInspection = {
  client_id: string;
  server_id?: number;
  unit_id?: number;
  unit_name?: string;
  unit_regional?: string;
  unit_city?: string;
  unit_data?: Record<string, unknown>;
  inspection_date: string;
  report_date: string;
  status: string;
  is_archived?: boolean;
  methodology_text: string;
  objectives_text: string;
  limitations_text: string;
  final_considerations_text: string;
  general_info_text: string;
  cover_diretor_executivo: string;
  cover_gerente_geral: string;
  cover_gerente_sst: string;
  cover_gerente_meio_ambiente: string;
  cover_diretoria_executiva?: string;
  cover_gerencia_geral?: string;
  cover_gerencia_sst?: string;
  cover_gerencia_meio_ambiente?: string;
  has_address_photo?: boolean;
  sync_status: SyncStatus;
  updated_at: string;
  created_at: string;
};

export type LocalAnswer = {
  id?: number;
  inspection_client_id: string;
  checklist_item_id: number;
  server_answer_id?: number;
  status: "C" | "NC" | "NA" | null;
  description: string;
  recommendation: string;
  normative: string;
  client_id: string;
  updated_at: string;
};

export type LocalPhoto = {
  client_photo_id: string;
  inspection_client_id: string;
  checklist_item_id: number;
  answer_client_id?: string;
  server_photo_id?: number;
  blob: Blob;
  original_filename: string;
  photo_type: "nc" | "address";
  sync_status: SyncStatus;
  created_at: string;
};

export type SyncMutation = {
  mutation_id: string;
  type: string;
  payload: Record<string, unknown>;
  status: "pending" | "applied" | "failed";
  retries: number;
  error?: string;
  created_at: string;
  applied_at?: string;
};

export type ReferenceCache = {
  key: string;
  data: unknown;
  cached_at: string;
};

export type AuthSession = {
  id: number;
  access_token: string;
  refresh_token?: string;
  user: Record<string, unknown>;
  saved_at: string;
};

export type SyncMeta = {
  key: string;
  value: string;
};

class InspecaoDB extends Dexie {
  inspections!: Table<LocalInspection, string>;
  answers!: Table<LocalAnswer, number>;
  photos!: Table<LocalPhoto, string>;
  sync_mutations!: Table<SyncMutation, string>;
  reference_cache!: Table<ReferenceCache, string>;
  auth_session!: Table<AuthSession, number>;
  sync_meta!: Table<SyncMeta, string>;

  constructor() {
    super("inspecao_ssma");
    this.version(1).stores({
      inspections: "client_id, server_id, sync_status, updated_at",
      answers: "++id, inspection_client_id, checklist_item_id, client_id, [inspection_client_id+checklist_item_id]",
      photos: "client_photo_id, inspection_client_id, checklist_item_id, sync_status",
      sync_mutations: "mutation_id, status, created_at",
      reference_cache: "key, cached_at",
      auth_session: "id",
      sync_meta: "key",
    });
  }
}

export const db = new InspecaoDB();

export function newClientId(): string {
  return crypto.randomUUID();
}
