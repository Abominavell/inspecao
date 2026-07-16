import { db, newClientId, type LocalUserRecord } from "@/lib/db";
import {
  clearCampoAuthSession,
  readCampoAuthSession,
  writeCampoAuthSession,
} from "@/lib/campoAuth";
import { isFieldApp, isNativeApp } from "@/lib/runtime";

/** Admin embutido no APK — cria e gerencia perfis de inspetores. */
export const DEFAULT_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_ADMIN_NAME = "Administrador";
export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_ADMIN_PASSWORD = "Inspecao@2026!";

const MIN_INSPECTOR_PASSWORD_LENGTH = 6;

const LEGACY_KEYS = [
  "local_session",
  "field_session_epoch",
  "local_auth_schema_version",
  "field_launch_id",
  "field_auth_listener",
  "field_was_paused",
  "field_dev_launch_epoch",
  "field_dev_process_id",
  "field_dev_session",
  "campo_dev_process_id",
  "campo_dev_session",
];

export type LocalUser = LocalUserRecord;

export type LocalSession = {
  user_id: string;
  user_name: string;
  is_admin: boolean;
  started_at: string;
};

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 120_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  return crypto.randomUUID();
}

export function isDefaultAdmin(userId: string): boolean {
  return userId === DEFAULT_ADMIN_ID;
}

async function buildUserCredentials(password: string): Promise<Pick<LocalUser, "pin_hash" | "pin_salt">> {
  const salt = randomSalt();
  const pin_hash = await hashPassword(password, salt);
  return { pin_hash, pin_salt: salt };
}

function clearLegacyWebStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
}

/** Remove sessões antigas gravadas em Preferences/localStorage (versões anteriores do APK). */
export async function purgeLegacyPersistedSession(): Promise<void> {
  clearLegacyWebStorage();
  try {
    if (!isNativeApp()) return;
    const { Preferences } = await import("@capacitor/preferences");
    for (const key of ["local_session", "local_auth_schema_version", "field_launch_id"]) {
      await Preferences.remove({ key });
    }
  } catch {
    /* ignore */
  }
}

export async function ensureDefaultAdmin(): Promise<LocalUser> {
  const existing = await db.local_users.get(DEFAULT_ADMIN_ID);
  if (existing?.username) return existing;

  const credentials = await buildUserCredentials(DEFAULT_ADMIN_PASSWORD);
  const user: LocalUser = {
    id: DEFAULT_ADMIN_ID,
    name: DEFAULT_ADMIN_NAME,
    username: DEFAULT_ADMIN_USERNAME,
    ...credentials,
    is_admin: true,
    is_active: true,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
  await db.local_users.put(user);
  return user;
}

export async function listLocalUsers(): Promise<LocalUser[]> {
  return db.local_users.orderBy("name").toArray();
}

export async function listInspectorUsers(): Promise<LocalUser[]> {
  const users = await listLocalUsers();
  return users.filter((u) => !u.is_admin);
}

export async function hasLocalUsers(): Promise<boolean> {
  return (await db.local_users.count()) > 0;
}

async function assertUsernameAvailable(username: string, exceptId?: string): Promise<void> {
  const normalized = normalizeUsername(username);
  if (!normalized) throw new Error("Usuário é obrigatório");
  if (normalized === DEFAULT_ADMIN_USERNAME) {
    throw new Error(`O usuário "${DEFAULT_ADMIN_USERNAME}" é reservado ao administrador`);
  }
  const taken = await db.local_users.where("username").equals(normalized).first();
  if (taken && taken.id !== exceptId) {
    throw new Error("Este usuário já está em uso");
  }
}

export async function createLocalUser(input: {
  name: string;
  username: string;
  password: string;
}): Promise<LocalUser> {
  if (input.password.length < MIN_INSPECTOR_PASSWORD_LENGTH) {
    throw new Error(`Senha deve ter pelo menos ${MIN_INSPECTOR_PASSWORD_LENGTH} caracteres`);
  }
  const username = normalizeUsername(input.username);
  await assertUsernameAvailable(username);
  const credentials = await buildUserCredentials(input.password);
  const user: LocalUser = {
    id: newClientId(),
    name: input.name.trim(),
    username,
    ...credentials,
    is_admin: false,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  await db.local_users.put(user);
  return user;
}

export async function setLocalUserActive(userId: string, active: boolean): Promise<void> {
  if (isDefaultAdmin(userId) && !active) {
    throw new Error("O administrador padrão não pode ser desativado");
  }
  const user = await db.local_users.get(userId);
  if (!user) throw new Error("Perfil não encontrado");
  await db.local_users.update(userId, { is_active: active });
}

export async function updateLocalUserPassword(userId: string, password: string): Promise<void> {
  const user = await db.local_users.get(userId);
  if (!user) throw new Error("Perfil não encontrado");
  const minLength = user.is_admin ? 8 : MIN_INSPECTOR_PASSWORD_LENGTH;
  if (password.length < minLength) {
    throw new Error(`Senha deve ter pelo menos ${minLength} caracteres`);
  }
  const credentials = await buildUserCredentials(password);
  await db.local_users.update(userId, credentials);
}

export async function verifyLocalLogin(username: string, password: string): Promise<LocalUser | null> {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const user = await db.local_users.where("username").equals(normalized).first();
  if (!user || user.is_active === false) return null;
  const hash = await hashPassword(password, user.pin_salt);
  return hash === user.pin_hash ? user : null;
}

export async function saveLocalSession(user: LocalUser): Promise<void> {
  await writeCampoAuthSession({
    userId: user.id,
    userName: user.name,
    isAdmin: user.is_admin,
  });
}

async function readStoredSession(): Promise<LocalSession | null> {
  const result = await readCampoAuthSession();
  if (!result.valid || !result.session) return null;
  return {
    user_id: result.session.user_id,
    user_name: result.session.user_name,
    is_admin: result.session.is_admin,
    started_at: result.session.started_at,
  };
}

export async function getLocalSession(): Promise<LocalSession | null> {
  return readStoredSession();
}

export async function getValidLocalSession(): Promise<LocalSession | null> {
  const session = await readStoredSession();
  if (!session?.user_id) {
    await clearLocalSession();
    return null;
  }

  const user = await db.local_users.get(session.user_id);
  if (!user || user.is_active === false || !user.username) {
    await clearLocalSession();
    return null;
  }

  if (session.user_name !== user.name || session.is_admin !== user.is_admin) {
    const updated: LocalSession = {
      ...session,
      user_name: user.name,
      is_admin: user.is_admin,
    };
    await writeCampoAuthSession({
      userId: user.id,
      userName: user.name,
      isAdmin: user.is_admin,
    });
    return updated;
  }

  return session;
}

export async function prepareFieldAppAuth(): Promise<LocalSession | null> {
  await ensureDefaultAdmin();
  return getValidLocalSession();
}

export async function clearLocalSession(): Promise<void> {
  await clearCampoAuthSession();
  clearLegacyWebStorage();
}

export async function logoutFieldApp(): Promise<void> {
  await clearLocalSession();
  await purgeLegacyPersistedSession();
}

export function useLocalAuth(): boolean {
  return isFieldApp();
}
