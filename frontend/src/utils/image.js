/**
 * Helper para resolver URLs de imágenes en producción (Vercel / Supabase) y desarrollo local.
 */
export function getImageUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;

  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  // Si ya es una URL completa (Supabase Storage, Cloudinary, http/https externa)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Si apunta a localhost en producción, reemplazar por ruta relativa
    if (trimmed.includes('localhost:3001')) {
      return trimmed.replace(/http:\/\/localhost:3001/, '');
    }
    return trimmed;
  }

  // Si es una ruta relativa que empieza con uploads/ o /uploads/
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return cleanPath;
  }

  return trimmed;
}
