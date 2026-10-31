/** Blog card date format: "1 June 2026" (day-first, no comma). */
export function formatBlogDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
