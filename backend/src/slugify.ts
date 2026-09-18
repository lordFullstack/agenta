// src/slugify.ts
//
// Única fuente de verdad para convertir un nombre en slug — la usan tanto el
// registro (business.service.ts, genera el slug) como la búsqueda pública
// (catalog.service.ts, normaliza lo que el usuario escribe antes de buscar).
// Si generan el slug de formas distintas, "Barbería El Socio" y
// "barberia-el-socio" dejan de ser la misma barbería para la búsqueda.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
