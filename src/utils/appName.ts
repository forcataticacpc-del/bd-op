export const DEFAULT_APP_NAME = 'Banco de Dados Operacional';
export const APP_NAME_STORAGE_KEY = 'bdo_app_custom_name';

export function getAppCustomName(): string {
  try {
    const saved = localStorage.getItem(APP_NAME_STORAGE_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim();
    }
    return DEFAULT_APP_NAME;
  } catch {
    return DEFAULT_APP_NAME;
  }
}

export function setAppCustomName(name: string): string {
  try {
    const finalName = name.trim().length > 0 ? name.trim() : DEFAULT_APP_NAME;
    localStorage.setItem(APP_NAME_STORAGE_KEY, finalName);
    window.dispatchEvent(new CustomEvent('app_name_changed', { detail: finalName }));
    return finalName;
  } catch {
    return DEFAULT_APP_NAME;
  }
}
