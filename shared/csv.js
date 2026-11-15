/** @param {(string | number)[][]} rows */
export function serializeCsv(rows) {
  return '\uFEFF' + rows.map((row) => row.map((value) => {
    const text = String(value)
    const safeText = typeof value === 'string' && /^[=+\-@\t\r\n]/.test(text.trimStart()) ? "'" + text : text
    return '"' + safeText.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
}
