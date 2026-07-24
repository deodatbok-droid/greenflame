/**
 * lib/exports/csv-utils.ts
 * Utilitaires CSV — BOM UTF-8 pour compatibilité Excel français (séparateur ;)
 */

export function escapeCsv(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const BOM = '﻿'
  const lines = [
    headers.map(escapeCsv).join(';'),
    ...rows.map(row => row.map(escapeCsv).join(';')),
  ]
  return BOM + lines.join('\r\n')
}

export function csvResponse(content: string, filename: string): Response {
  return new Response(content, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatAmount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0'
  return n.toLocaleString('fr-FR')
}
