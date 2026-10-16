import { init, miniApp, viewport, themeParams, backButton, closingBehavior, mainButton, secondaryButton } from "@tma.js/sdk";
import { retrieveLaunchParams } from "@tma.js/bridge";

export function initTma() {
  try {
    init();
  } catch {
    // ignore
  }

  try { themeParams.mount(); } catch {}
  try { miniApp.mount(); } catch {}
  try { viewport.mount(); } catch {}
  try { backButton.mount(); closingBehavior.mount(); mainButton.mount(); secondaryButton.mount(); } catch {}

  try { miniApp.ready(); } catch {}
  try {
    if (viewport.isExpanded && !viewport.isExpanded.get()) {
      viewport.expand();
    }
  } catch {}

  try { themeParams.bindCssVars(); } catch {}
  try { viewport.bindCssVars(); } catch {}
  try { miniApp.bindCssVars(); } catch {}

  return { miniApp, viewport, themeParams, backButton, closingBehavior, mainButton, secondaryButton };
}

export function getTmaLaunchParams() {
  try {
    return retrieveLaunchParams();
  } catch {
    return undefined;
  }
}
