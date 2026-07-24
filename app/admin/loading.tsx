export default function AdminLoading() {
  return (
    <div
      className="fixed inset-0 flex overflow-hidden"
      style={{ background: '#0c1018' }}
    >
      {/* Sidebar skeleton — desktop uniquement */}
      <div
        className="hidden md:flex shrink-0"
        style={{
          width: 260,
          background: 'linear-gradient(180deg, #080b12 0%, #0c1018 50%, #0e1320 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      />
      {/* Zone contenu */}
      <div className="flex-1" />
    </div>
  )
}
