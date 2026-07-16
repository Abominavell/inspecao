import type { CampoAuthPlugin, NativeCampoSession } from "@/lib/campoAuth";

import { normalizeAppHref } from "@/lib/inspectionRoutes";



const WEB_PROCESS_KEY = "campo_dev_process_id";

const WEB_SESSION_KEY = "campo_dev_session";



function getWebProcessId(): string {

  if (typeof sessionStorage === "undefined") return "web";

  let id = sessionStorage.getItem(WEB_PROCESS_KEY);

  if (!id) {

    id = crypto.randomUUID();

    sessionStorage.setItem(WEB_PROCESS_KEY, id);

  }

  return id;

}



const CampoAuthWeb: CampoAuthPlugin = {

  async getSession() {

    if (typeof sessionStorage === "undefined") {

      return { valid: false };

    }

    const raw = sessionStorage.getItem(WEB_SESSION_KEY);

    if (!raw) return { valid: false };

    try {

      const parsed = JSON.parse(raw) as NativeCampoSession & { bound_process_id?: string };

      if (parsed.bound_process_id !== getWebProcessId()) {

        sessionStorage.removeItem(WEB_SESSION_KEY);

        return { valid: false };

      }

      return {

        valid: true,

        session: {

          user_id: parsed.user_id,

          user_name: parsed.user_name,

          is_admin: parsed.is_admin,

          started_at: parsed.started_at,

        },

      };

    } catch {

      sessionStorage.removeItem(WEB_SESSION_KEY);

      return { valid: false };

    }

  },



  async hasValidSession() {

    const result = await this.getSession();

    return { valid: result.valid };

  },



  async setSession(options) {

    if (typeof sessionStorage === "undefined") return;

    const startedAt = new Date().toISOString();

    sessionStorage.setItem(

      WEB_SESSION_KEY,

      JSON.stringify({

        user_id: options.userId,

        user_name: options.userName,

        is_admin: options.isAdmin,

        started_at: startedAt,

        bound_process_id: getWebProcessId(),

      })

    );

  },



  async clearSession() {

    if (typeof sessionStorage === "undefined") return;

    sessionStorage.removeItem(WEB_SESSION_KEY);

  },



  async openApp() {

    if (typeof window !== "undefined") {

      window.location.assign(normalizeAppHref("/"));

    }

  },



  async openLogin() {

    if (typeof window !== "undefined") {

      window.location.assign(normalizeAppHref("/login/"));

    }

  },

};



export default CampoAuthWeb;


