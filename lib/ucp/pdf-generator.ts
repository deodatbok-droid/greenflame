/**
 * lib/ucp/pdf-generator.ts
 *
 * Génère le Bulletin de Souscription de Droits UCP (BSD-UCP) en PDF statique
 * via pdfkit, l'uploade dans Supabase Storage et retourne l'URL publique.
 *
 * Runtime : Node.js (pas Edge) — ajouter `export const runtime = 'nodejs'`
 * dans les routes qui importent ce module.
 */

import PDFDocument from 'pdfkit'
import { createServiceClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UcpPdfInput {
  bsdNumber:        string
  subscriptionType: 'purchase' | 'attribution'
  ucpParts:         number
  unitPriceFcfa:    number   // prix figé au moment T de la souscription
  amountFcfa:       number
  userName:         string
  userPhone:        string
  userEmail:        string
  adminName:        string
  acceptedAt:       string | null
  otpVerifiedAt:    string | null
  pinVerifiedAt:    string | null
  confirmedAt:      string
  paymentNote:      string | null
}

interface InfoRow {
  k: string
  v: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Porto-Novo',
  })
}

function fmtFcfa(n: number): string {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

// ── Génération PDF ────────────────────────────────────────────────────────────

export async function generateUcpPdf(input: UcpPdfInput): Promise<string> {
  const pdfBuffer = await buildPdf(input)
  const url       = await uploadToStorage(pdfBuffer, input.bsdNumber)
  return url
}

async function buildPdf(input: UcpPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: {
      top: 72, bottom: 40, left: 45, right: 45,
    }, info: {
      Title:   `Bulletin de Souscription UCP — ${input.bsdNumber}`,
      Author:  'GreenFlame',
      Subject: 'Droits de souscription futurs sur actions GreenFlame SA',
    }})
    const chunks: Buffer[] = []
    doc.on('data',  (c: Buffer) => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const ML     = 45
    const W      = doc.page.width - ML * 2
    const HDR    = 68
    const green  = '#1a6b3c'
    const dark   = '#111827'
    const gray   = '#6b7280'
    const light  = '#f0fdf4'
    const border = '#d1fae5'

    // ── En-tête ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, HDR).fill(green)

    doc.fill('white').font('Helvetica-Bold').fontSize(18)
       .text('GreenFlame', ML, 20)
    doc.fill('white').font('Helvetica').fontSize(8)
       .text('greenflame.africa', ML, 36)

    doc.fill('white').font('Helvetica-Bold').fontSize(9)
       .text('BULLETIN DE SOUSCRIPTION DE DROITS UCP', 0, 20,
             { align: 'right', width: doc.page.width - ML })
    doc.fill('white').font('Helvetica').fontSize(8)
       .text('Ubuntu Capital Plan — GreenFlame Africa', 0, 33,
             { align: 'right', width: doc.page.width - ML })
    doc.fill('white').font('Helvetica-Bold').fontSize(10)
       .text(input.bsdNumber, 0, 46, { align: 'right', width: doc.page.width - ML })

    doc.y = 76

    // ── Sous-titre ────────────────────────────────────────────────────────────
    doc.fill(green).font('Helvetica-Bold').fontSize(11)
       .text('Ubuntu Capital Plan — GreenFlame', { align: 'center' })
    doc.moveDown(0.25)
    doc.fill(gray).font('Helvetica').fontSize(8)
       .text(`Document émis le ${fmtDate(input.confirmedAt)}`, { align: 'center' })
    doc.moveDown(0.5)

    // ── Ligne séparatrice ─────────────────────────────────────────────────────
    doc.moveTo(ML, doc.y).lineTo(ML + W, doc.y).strokeColor(border).lineWidth(0.8).stroke()
    doc.moveDown(0.5)

    // ── ENTRE LES PARTIES ─────────────────────────────────────────────────────
    section(doc, 'ENTRE LES PARTIES', green, ML)
    twoCol(doc, W, ML,
      ['ÉMETTEUR', 'GreenFlame Africa SARL', 'Société enregistrée au Bénin',
       'Représentée par : ' + input.adminName],
      ['SOUSCRIPTEUR', input.userName,
       input.userPhone ? 'Tél. : ' + input.userPhone : '',
       input.userEmail ? 'Email : ' + input.userEmail : ''].filter(Boolean),
    )
    doc.moveDown(0.55)

    // ── OBJET ─────────────────────────────────────────────────────────────────
    section(doc, 'OBJET DE LA SOUSCRIPTION', green, ML)

    const typeLabel = input.subscriptionType === 'purchase'
      ? '☑ Souscription par achat    ☐ Attribution'
      : '☐ Souscription par achat    ☑ Attribution'

    const objetRows: InfoRow[] = [
      { k: 'Type de souscription', v: typeLabel },
      { k: 'Nombre de parts UCP',  v: String(input.ucpParts) + ' part' + (input.ucpParts > 1 ? 's' : '') },
      ...(input.subscriptionType === 'purchase' ? [
        { k: 'Prix unitaire par part', v: fmtFcfa(input.unitPriceFcfa) },
        { k: 'Montant total',          v: fmtFcfa(input.amountFcfa)    },
      ] : [
        { k: 'Contrepartie', v: 'Attribution — aucune contrepartie financière directe' },
      ]),
      ...(input.paymentNote ? [{ k: 'Note de paiement', v: input.paymentNote }] : []),
    ]

    infoBox(doc, W, ML, light, border, objetRows, dark, gray)
    doc.moveDown(0.5)

    // ── DROITS CONFÉRÉS ───────────────────────────────────────────────────────
    section(doc, 'DROITS CONFÉRÉS', green, ML)

    doc.fill(dark).font('Helvetica').fontSize(8).text(
      'Les parts UCP souscrites confèrent au titulaire un droit préférentiel et prioritaire ' +
      "à l'acquisition d'actions GreenFlame SA, à hauteur équivalente, lors de l'émission " +
      "desdites actions ou de toute opération d'ouverture du capital de GreenFlame.",
      { align: 'justify', lineGap: 2 }
    )
    doc.moveDown(0.4)
    doc.fill(dark).font('Helvetica').fontSize(8).text(
      'Ce bulletin ne constitue pas une action et ne confère pas, à ce stade, de droit de vote ' +
      'ni de droit aux dividendes. Il matérialise un engagement contractuel de GreenFlame à ' +
      'émettre les actions correspondantes en priorité au profit du souscripteur, dans les ' +
      'conditions alors en vigueur lors de ladite émission.',
      { align: 'justify', lineGap: 2 }
    )
    doc.moveDown(0.5)

    // ── EMPREINTE DE VALIDATION ───────────────────────────────────────────────
    section(doc, 'EMPREINTE DE VALIDATION', green, ML)

    infoBox(doc, W, ML, '#fffbeb', '#fde68a', [
      { k: 'Étape 1 — Acceptation des termes',    v: fmtDate(input.acceptedAt)    },
      { k: 'Étape 2 — Vérification OTP WhatsApp', v: fmtDate(input.otpVerifiedAt) },
      { k: 'Étape 3 — PIN transaction',            v: fmtDate(input.pinVerifiedAt) },
      { k: 'Confirmation admin (paiement reçu)',   v: fmtDate(input.confirmedAt)   },
    ], dark, gray)
    doc.moveDown(0.65)

    // ── SIGNATURES ────────────────────────────────────────────────────────────
    section(doc, 'SIGNATURES', green, ML)
    doc.moveTo(ML, doc.y).lineTo(ML + W, doc.y).strokeColor(border).lineWidth(0.4).stroke()
    doc.moveDown(0.35)

    const sigY = doc.y
    const colW = W / 2 - 8

    doc.fill(gray).font('Helvetica').fontSize(7.5).text('Le Souscripteur', ML, sigY)
    doc.fill(dark).font('Helvetica-Bold').fontSize(9).text(input.userName, ML, sigY + 12)
    doc.fill(gray).font('Helvetica').fontSize(7.5).text('Validé électroniquement', ML, sigY + 24)
    doc.fill(gray).font('Helvetica').fontSize(7.5).text(fmtDate(input.pinVerifiedAt), ML, sigY + 35)

    const rightX = ML + colW + 16
    doc.fill(gray).font('Helvetica').fontSize(7.5).text('Pour GreenFlame Africa', rightX, sigY)
    doc.fill(dark).font('Helvetica-Bold').fontSize(9).text(input.adminName, rightX, sigY + 12)
    doc.fill(gray).font('Helvetica').fontSize(7.5).text("Confirmé par l'administration", rightX, sigY + 24)
    doc.fill(gray).font('Helvetica').fontSize(7.5).text(fmtDate(input.confirmedAt), rightX, sigY + 35)

    // ── Pied de page ──────────────────────────────────────────────────────────
    const footerY = doc.page.height - 34
    doc.moveTo(ML, footerY).lineTo(ML + W, footerY).strokeColor(border).lineWidth(0.5).stroke()
    doc.fill(gray).font('Helvetica').fontSize(7)
       .text(
         `${input.bsdNumber}  ·  GreenFlame Africa  ·  greenflame.africa  ·  ` +
         `Document confidentiel — usage exclusif des parties signataires`,
         ML, footerY + 5, { align: 'center', width: W }
       )

    doc.end()
  })
}

// ── Helpers de mise en page ───────────────────────────────────────────────────

function section(
  doc:   InstanceType<typeof PDFDocument>,
  title: string,
  color: string,
  ML:    number,
) {
  doc.fill(color).font('Helvetica-Bold').fontSize(8)
     .text(title.toUpperCase(), ML, doc.y, { characterSpacing: 0.5 })
  doc.moveDown(0.3)
}

function twoCol(
  doc:   InstanceType<typeof PDFDocument>,
  W:     number,
  ML:    number,
  left:  string[],
  right: string[],
) {
  const colW   = W / 2 - 10
  const midX   = ML + colW + 16
  const startY = doc.y
  const lineH  = 12

  left.forEach((line, i) => {
    const isHeader = i === 0
    doc.fill(isHeader ? '#6b7280' : '#111827')
       .font(isHeader ? 'Helvetica' : i === 1 ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(isHeader ? 7 : i === 1 ? 8.5 : 8)
       .text(line, ML, startY + i * lineH, { width: colW })
  })

  right.forEach((line, i) => {
    const isHeader = i === 0
    doc.fill(isHeader ? '#6b7280' : '#111827')
       .font(isHeader ? 'Helvetica' : i === 1 ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(isHeader ? 7 : i === 1 ? 8.5 : 8)
       .text(line, midX, startY + i * lineH, { width: colW })
  })

  doc.y = startY + Math.max(left.length, right.length) * lineH + 4
}

function infoBox(
  doc:    InstanceType<typeof PDFDocument>,
  W:      number,
  ML:     number,
  bg:     string,
  border: string,
  rows:   InfoRow[],
  dark:   string,
  gray:   string,
) {
  const padV   = 5
  const lineH  = 13
  const boxH   = rows.length * lineH + padV * 2
  const startY = doc.y

  doc.roundedRect(ML, startY, W, boxH, 3).fillAndStroke(bg, border)

  rows.forEach(({ k, v }, i) => {
    const y = startY + padV + i * lineH
    doc.fill(gray).font('Helvetica').fontSize(7.5).text(k + ' :', ML + 8, y, { width: 155 })
    doc.fill(dark).font('Helvetica-Bold').fontSize(8).text(v, ML + 168, y, { width: W - 176 })
  })

  doc.y = startY + boxH + 3
}

// ── Upload Supabase Storage ───────────────────────────────────────────────────

async function uploadToStorage(buffer: Buffer, bsdNumber: string): Promise<string> {
  const svc      = createServiceClient()
  const fileName = `ucp/${bsdNumber}.pdf`

  const { error } = await svc.storage
    .from('documents')
    .upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert:      true,
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = svc.storage.from('documents').getPublicUrl(fileName)
  return data.publicUrl
}
