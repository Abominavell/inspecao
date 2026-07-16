/** App Android 100% offline (Capacitor) — sem sync/API em campo. */
export const isOfflineOnlyApp = (): boolean =>
  process.env.NEXT_PUBLIC_OFFLINE_ONLY === "true";

export const isNativeApp = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Capacitor } = require("@capacitor/core") as {
      Capacitor?: { isNativePlatform?: () => boolean };
    };
    return Boolean(Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

export const isFieldApp = (): boolean => isOfflineOnlyApp() || isNativeApp();

/** Gate de login obrigatório — nativo sempre; web só com build mobile. */
export const isCampoAuthRequired = (): boolean => isOfflineOnlyApp() || isNativeApp();
