import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import de from './de.json';
import en from './en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en }
    },
    fallbackLng: 'en',
    supportedLngs: ['de', 'en'],
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
export const changeLanguage = (lang: 'de' | 'en') => {
  i18n.changeLanguage(lang);
  localStorage.setItem('ui.lang', lang);
};

// Get current language
export const getCurrentLanguage = (): 'de' | 'en' => {
  return (i18n.language?.startsWith('de') ? 'de' : 'en') as 'de' | 'en';
};
