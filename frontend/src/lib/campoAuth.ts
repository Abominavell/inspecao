import { Capacitor, registerPlugin } from "@capacitor/core";

import { normalizeAppHref } from "@/lib/inspectionRoutes";



export type NativeCampoSession = {

  user_id: string;

  user_name: string;

  is_admin: boolean;

  started_at: string;

};



export type CampoAuthResult = {

  valid: boolean;

  session?: NativeCampoSession;

};



export interface CampoAuthPlugin {

  getSession(): Promise<CampoAuthResult>;

  hasValidSession(): Promise<{ valid: boolean }>;

  setSession(options: { userId: string; userName: string; isAdmin: boolean }): Promise<void>;

  clearSession(): Promise<void>;

  openApp(): Promise<void>;

  openLogin(): Promise<void>;

}



const CampoAuthNative = registerPlugin<CampoAuthPlugin>("CampoAuth");



async function getWebImplementation(): Promise<CampoAuthPlugin> {

  return import("./campoAuthWeb").then((m) => m.default);

}



function useNativePlugin(): boolean {

  return typeof window !== "undefined" && Capacitor.isNativePlatform();

}



export async function readCampoAuthSession(): Promise<CampoAuthResult> {

  try {

    if (useNativePlugin()) {

      return await CampoAuthNative.getSession();

    }

    const web = await getWebImplementation();

    return await web.getSession();

  } catch {

    return { valid: false };

  }

}



export async function writeCampoAuthSession(input: {

  userId: string;

  userName: string;

  isAdmin: boolean;

}): Promise<void> {

  if (useNativePlugin()) {

    await CampoAuthNative.setSession(input);

    return;

  }

  const web = await getWebImplementation();

  await web.setSession(input);

}



export async function clearCampoAuthSession(): Promise<void> {

  try {

    if (useNativePlugin()) {

      await CampoAuthNative.clearSession();

      return;

    }

    const web = await getWebImplementation();

    await web.clearSession();

  } catch {

    /* ignore */

  }

}



/** LoginActivity → MainActivity (nativo) ou navegação para `/` no dev web. */

export async function openCampoApp(): Promise<void> {

  if (useNativePlugin()) {

    await CampoAuthNative.openApp();

    return;

  }

  const web = await getWebImplementation();

  await web.openApp();

}



/** Logout → LoginActivity (nativo) ou navegação para `/login/` no dev web. */

export async function openCampoLogin(): Promise<void> {

  if (useNativePlugin()) {

    await CampoAuthNative.openLogin();

    return;

  }

  const web = await getWebImplementation();

  await web.openLogin();

}



/** @deprecated Use readCampoAuthSession */

export const CampoAuth = CampoAuthNative;


