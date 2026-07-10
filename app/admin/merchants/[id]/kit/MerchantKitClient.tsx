'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Props {
  merchantName: string
  merchantCategory: string
  qrCodeUrl: string | null
  payUrl: string
  publicSlug: string | null
}

export default function MerchantKitClient({
  merchantName, merchantCategory, qrCodeUrl, payUrl, publicSlug,
}: Props) {
  const params = useParams()
  const merchantId = params.id as string
  const qrRef = useRef<HTMLDivElement>(null)

  // Générer le QR code côté client si pas d'URL stockée
  useEffect(() => {
    if (qrCodeUrl || !qrRef.current) return
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    script.onload = () => {
      if (!qrRef.current) return
      qrRef.current.innerHTML = ''
      // @ts-ignore
      new window.QRCode(qrRef.current, {
        text: payUrl,
        width: 200,
        height: 200,
        colorDark: '#064e3b',
        colorLight: '#ffffff',
        correctLevel: 2, // Q
      })
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [payUrl, qrCodeUrl])

  return (
    <>
      {/* Barre admin — visible seulement à l'écran, cachée à l'impression */}
      <div className="no-print bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/admin/merchants/${merchantId}`} className="text-brand-400 text-sm">
            ← Retour fiche marchand
          </Link>
          <span className="text-gray-500 text-sm">|</span>
          <span className="text-white text-sm font-medium">Kit marchand — {merchantName}</span>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors flex items-center gap-2"
        >
          🖨️ Imprimer
        </button>
      </div>

      {/* ── Kit imprimable ── */}
      <div id="kit-print" className="kit-page">

        {/* En-tête */}
        <header className="kit-header">
          <div className="kit-logo-block">
            <div className="kit-flame">🔥</div>
            <div>
              <div className="kit-brand">GreenFlame</div>
              <div className="kit-tagline">Commerce communautaire</div>
            </div>
          </div>
          <div className="kit-merchant-name">
            {merchantName}
          </div>
        </header>

        {/* Corps — QR + Comment payer côte à côte */}
        <main className="kit-body">

          {/* Colonne gauche : QR code */}
          <div className="kit-qr-col">
            <div className="kit-qr-box">
              {qrCodeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCodeUrl} alt="QR Code GreenFlame" className="kit-qr-img" />
              ) : (
                <div ref={qrRef} className="kit-qr-generated" />
              )}
            </div>
            <p className="kit-scan-label">Scannez pour payer</p>
            <p className="kit-scan-sub">Ouvrez GreenFlame → Payer</p>
          </div>

          {/* Colonne droite : instructions */}
          <div className="kit-right-col">

            {/* Comment payer */}
            <div className="kit-section">
              <div className="kit-section-title">Comment payer avec GreenFlame</div>

              <div className="kit-steps">
                <div className="kit-step">
                  <div className="kit-step-num">1</div>
                  <div className="kit-step-text">
                    Ouvrez l&apos;application <strong>GreenFlame</strong> sur votre téléphone
                  </div>
                </div>
                <div className="kit-step">
                  <div className="kit-step-num">2</div>
                  <div className="kit-step-text">
                    Appuyez sur <strong>Payer</strong> et scannez le QR code
                  </div>
                </div>
                <div className="kit-step">
                  <div className="kit-step-num">3</div>
                  <div className="kit-step-text">
                    Entrez le montant de votre achat et confirmez
                  </div>
                </div>
                <div className="kit-step">
                  <div className="kit-step-num">4</div>
                  <div className="kit-step-text">
                    Vous recevez votre <strong>cashback immédiatement</strong> 🎉
                  </div>
                </div>
              </div>
            </div>

            {/* Moyens de paiement */}
            <div className="kit-section">
              <div className="kit-section-title">Moyens de paiement acceptés</div>
              <div className="kit-pay-methods">
                <div className="kit-pay-method kit-pay-gf">
                  <span className="kit-pay-icon">🔥</span>
                  <div>
                    <div className="kit-pay-name">Wallet GreenFlame</div>
                    <div className="kit-pay-desc">Solde de votre compte GF</div>
                  </div>
                </div>
                <div className="kit-pay-method kit-pay-momo">
                  <span className="kit-pay-icon">📱</span>
                  <div>
                    <div className="kit-pay-name">Mobile Money</div>
                    <div className="kit-pay-desc">MTN MoMo · Moov Flooz · Celtiis Kash</div>
                  </div>
                </div>
                <div className="kit-pay-method kit-pay-cash">
                  <span className="kit-pay-icon">💵</span>
                  <div>
                    <div className="kit-pay-name">Espèces</div>
                    <div className="kit-pay-desc">Paiement en cash</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Avantage cashback */}
            <div className="kit-cashback-box">
              <span className="kit-cashback-icon">💚</span>
              <div>
                <div className="kit-cashback-title">Gagnez du cashback sur chaque achat</div>
                <div className="kit-cashback-sub">
                  Une partie de chaque paiement vous est reversée automatiquement sur votre wallet GreenFlame.
                </div>
              </div>
            </div>

          </div>
        </main>

        {/* Pied de page */}
        <footer className="kit-footer">
          <div className="kit-footer-left">
            <strong>Support GreenFlame</strong> · greenflameafrica8@gmail.com
          </div>
          <div className="kit-footer-center">
            greenflame.africa
          </div>
          <div className="kit-footer-right">
            Téléchargez l&apos;app GreenFlame
          </div>
        </footer>

      </div>

      <style>{`
        /* ── Reset impression ── */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          #kit-print { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }

        /* ── Page ── */
        .kit-page {
          width: 210mm;
          min-height: 297mm;
          max-height: 297mm;
          margin: 8mm auto;
          background: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
          box-shadow: 0 4px 32px rgba(0,0,0,0.12);
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* ── En-tête ── */
        .kit-header {
          background: #064e3b;
          padding: 14mm 12mm 10mm;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .kit-logo-block {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .kit-flame { font-size: 28px; }
        .kit-brand {
          font-size: 20px;
          font-weight: 800;
          color: white;
          line-height: 1;
        }
        .kit-tagline {
          font-size: 9px;
          color: #bbf7d0;
          margin-top: 2px;
        }
        .kit-merchant-name {
          font-size: 16px;
          font-weight: 700;
          color: white;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 8px;
          padding: 6px 14px;
          max-width: 80mm;
          text-align: right;
        }

        /* ── Corps ── */
        .kit-body {
          display: flex;
          flex: 1;
          gap: 0;
          padding: 10mm 12mm;
          align-items: flex-start;
        }

        /* ── Colonne QR ── */
        .kit-qr-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 58mm;
          flex-shrink: 0;
          padding-right: 8mm;
          border-right: 1.5px dashed #d1fae5;
        }
        .kit-qr-box {
          width: 52mm;
          height: 52mm;
          border: 3px solid #064e3b;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: white;
          padding: 3px;
        }
        .kit-qr-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .kit-qr-generated {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .kit-qr-generated img {
          width: 100% !important;
          height: 100% !important;
        }
        .kit-scan-label {
          margin-top: 8px;
          font-size: 12px;
          font-weight: 700;
          color: #064e3b;
          text-align: center;
        }
        .kit-scan-sub {
          font-size: 9px;
          color: #6b7280;
          text-align: center;
          margin-top: 2px;
        }

        /* ── Colonne droite ── */
        .kit-right-col {
          flex: 1;
          padding-left: 8mm;
          display: flex;
          flex-direction: column;
          gap: 5mm;
        }

        .kit-section-title {
          font-size: 11px;
          font-weight: 700;
          color: #064e3b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 4mm;
          padding-bottom: 2mm;
          border-bottom: 1.5px solid #d1fae5;
        }

        /* ── Étapes ── */
        .kit-steps {
          display: flex;
          flex-direction: column;
          gap: 3mm;
        }
        .kit-step {
          display: flex;
          align-items: flex-start;
          gap: 7px;
        }
        .kit-step-num {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #16a34a;
          color: white;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .kit-step-text {
          font-size: 10px;
          color: #374151;
          line-height: 1.5;
          padding-top: 2px;
        }

        /* ── Méthodes de paiement ── */
        .kit-pay-methods {
          display: flex;
          flex-direction: column;
          gap: 3mm;
        }
        .kit-pay-method {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 3mm 4mm;
          border-radius: 7px;
          border: 1px solid transparent;
        }
        .kit-pay-gf   { background: #f0fdf4; border-color: #86efac; }
        .kit-pay-momo { background: #fffbeb; border-color: #fcd34d; }
        .kit-pay-cash { background: #f9fafb; border-color: #e5e7eb; }
        .kit-pay-icon { font-size: 16px; }
        .kit-pay-name { font-size: 10px; font-weight: 700; color: #111827; }
        .kit-pay-desc { font-size: 8.5px; color: #6b7280; margin-top: 1px; }

        /* ── Cashback box ── */
        .kit-cashback-box {
          background: linear-gradient(135deg, #064e3b, #16a34a);
          border-radius: 10px;
          padding: 4mm 5mm;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .kit-cashback-icon { font-size: 20px; flex-shrink: 0; }
        .kit-cashback-title {
          font-size: 10px;
          font-weight: 700;
          color: white;
          line-height: 1.4;
        }
        .kit-cashback-sub {
          font-size: 8.5px;
          color: #bbf7d0;
          margin-top: 2px;
          line-height: 1.4;
        }

        /* ── Footer ── */
        .kit-footer {
          background: #1f2937;
          padding: 5mm 12mm;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 8px;
          color: #9ca3af;
        }
        .kit-footer strong { color: white; }
        .kit-footer-center {
          font-weight: 700;
          color: #16a34a;
          font-size: 9px;
        }
      `}</style>
    </>
  )
}
