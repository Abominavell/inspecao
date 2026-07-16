import Dexie, { type Table } from "dexie";

export type SyncStatus = "local" | "pending" | "synced" | "conflict";

export type LocalUnit = {
  id: number;
  name: string;
  regional: string;
  city: string;
  address: string;
  unit_type: string;
  employee_count: number;
  admin_coordinator: string;
  general_director: string;
  characterization: string;
  source: "bundled" | "local";
  created_at: string;
};

export type LocalInspection = {
  client_id: string;
  server_id?: number;
  local_user_id?: string;
  pdf_path?: string;
  pdf_generated_at?: string;
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
  file_path?: string;
  original_filename: string;
  photo_type: "nc" | "address";
  sync_status: SyncStatus;
  created_at: string;
};

export type LocalUserRecord = {
  id: string;
  name: string;
  username: string;
  pin_hash: string;
  pin_salt: string;
  is_admin: boolean;
  is_active?: boolean;
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
  local_users!: Table<LocalUserRecord, string>;
  local_units!: Table<LocalUnit, number>;

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
    this.version(2).stores({
      inspections: "client_id, server_id, local_user_id, sync_status, updated_at, status",
      answers: "++id, inspection_client_id, checklist_item_id, client_id, [inspection_client_id+checklist_item_id]",
      photos: "client_photo_id, inspection_client_id, checklist_item_id, sync_status",
      sync_mutations: "mutation_id, status, created_at",
      reference_cache: "key, cached_at",
      auth_session: "id",
      sync_meta: "key",
      local_users: "id, name",
      local_units: "id, name, source",
    });
    this.version(3).stores({
      inspections: "client_id, server_id, local_user_id, sync_status, updated_at, status",
      answers: "++id, inspection_client_id, checklist_item_id, client_id, [inspection_client_id+checklist_item_id]",
      photos: "client_photo_id, inspection_client_id, checklist_item_id, sync_status",
      sync_mutations: "mutation_id, status, created_at",
      reference_cache: "key, cached_at",
      auth_session: "id",
      sync_meta: "key",
      local_users: "id, name, is_active",
      local_units: "id, name, source",
    }).upgrade(async (tx) => {
      await tx
        .table("local_users")
        .toCollection()
        .modify((user: LocalUserRecord) => {
          if (user.is_active === undefined) user.is_active = true;
        });
    });
    this.version(4).stores({
      inspections: "client_id, server_id, local_user_id, sync_status, updated_at, status",
      answers: "++id, inspection_client_id, checklist_item_id, client_id, [inspection_client_id+checklist_item_id]",
      photos: "client_photo_id, inspection_client_id, checklist_item_id, sync_status",
      sync_mutations: "mutation_id, status, created_at",
      reference_cache: "key, cached_at",
      auth_session: "id",
      sync_meta: "key",
      local_users: "id, name, username, is_active",
      local_units: "id, name, source",
    }).upgrade(async (tx) => {
      const defaultAdminId = "00000000-0000-4000-8000-000000000001";
      const users = await tx.table("local_users").toArray();
      for (const user of users as LocalUserRecord[]) {
        if (user.id === defaultAdminId) continue;
        if (!user.username) {
          await tx.table("local_users").delete(user.id);
        }
      }
    });
  }
}

export const db = new InspecaoDB();

export function newClientId(): string {
  return crypto.randomUUID();
}
