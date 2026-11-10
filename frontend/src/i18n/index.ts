import { de, type Messages } from "./de";

/** Locale registry. To add English: create en.ts implementing `Messages`,
 * register it here and switch `currentLocale` (e.g. from a user setting). */
const locales: Record<string, Messages> = { de };
export const currentLocale = "de";
export const intlLocale = "de-DE";
export const t: Messages = locales[currentLocale];

export function label<K extends keyof Messages>(group: K, key: string | null | undefined): string {
  if (!key) return "";
  return (t[group] as Record<string, string>)[key] ?? key;
}
