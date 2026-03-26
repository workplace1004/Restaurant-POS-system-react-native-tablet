/**
 * Bridge translations.js (sync getStoredLang) with AsyncStorage before shim hydrates.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_STORAGE_KEY = 'pos-lang';
const VALID = ['en', 'nl', 'fr', 'tr'];

let memoryLang = 'en';

export function getMemoryLang() {
  return memoryLang;
}

export function setMemoryLang(lang) {
  if (VALID.includes(lang)) memoryLang = lang;
}

export async function hydrateLangFromDisk() {
  try {
    const v = await AsyncStorage.getItem(LANG_STORAGE_KEY);
    if (v && VALID.includes(v)) memoryLang = v;
  } catch {
    /* ignore */
  }
  return memoryLang;
}

export { LANG_STORAGE_KEY, VALID };
