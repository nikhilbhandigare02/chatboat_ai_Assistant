import en from './en.json';
import mr from './mr.json';

const languages = {
  en,
  mr
};

// Marathi language detection - checks for Marathi characters
const detectMarathi = (text) => {
  // Marathi Unicode range: 0x0900 to 0x097F
  const marathiRegex = /[\u0900-\u097F]/;
  return marathiRegex.test(text);
};
   
// Detect language from user input
export const detectLanguage = (text) => {
  if (detectMarathi(text)) {
    return 'mr';
  }
  return 'en'; // Default to English
};

// Get translation by key and language
export const getTranslation = (key, language = 'en', params = {}) => {
  const translations = languages[language] || languages.en;
  
  const keys = key.split('.');
  let value = translations;
  
  for (const k of keys) {
    value = value?.[k];
    if (!value) break;
  }
  
  if (!value) {
    value = languages.en;
    for (const k of keys) {
      value = value?.[k];
      if (!value) break;
    }
  }
  
  if (!value) return key; 
  return value.replace(/\{(\w+)\}/g, (match, param) => params[param] || match);
};

export default languages;
