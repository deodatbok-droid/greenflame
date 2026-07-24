export default function AdminLoading() {
  return (
    <>
      <style>{`
        .gf-loading-sidebar { display: none !important; }
        @media (min-width: 768px) { .gf-loading-sidebar { display: flex !important; } }
      `}</style>
      <div style={{ position:'fixed', inset:0, display:'flex', overflow:'hidden', background:'#0c1018' }}>
        <div className="gf-loading-sidebar" style={{ flexShrink:0, width:260, background:'linear-gradient(180deg,#080b12 0%,#0c1018 50%,#0e1320 100%)', borderRight:'1px solid rgba(255,255,255,0.06)' }} />
        <div style={{ flex:1 }} />
      </div>
    </>
  )
}
