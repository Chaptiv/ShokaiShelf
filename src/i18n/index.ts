import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import de from './de.json';
import en from './en.json';
import jp from './jp.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
      jp: { translation: jp }
    },
    fallbackLng: 'en',
    supportedLngs: ['de', 'en', 'jp'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ui.lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

// Helper to change language
export const changeLanguage = (lang: 'de' | 'en' | 'jp') => {
  i18n.changeLanguage(lang);
  localStorage.setItem('ui.lang', lang);
};

// Get current language
export const getCurrentLanguage = (): 'de' | 'en' | 'jp' => {
  if (i18n.language?.startsWith('de')) return 'de';
  if (i18n.language?.startsWith('jp')) return 'jp';
  return 'en';
};
