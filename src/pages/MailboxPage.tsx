

export default function MailboxPage() {
  return (
    <div className="page-container">
      <header className="top-header">
        <h1 className="text-display-md">감정 사서함</h1>
      </header>
      <div className="tabs" style={{ display: 'flex', borderBottom: '1px solid var(--color-hairline)', marginBottom: 'var(--spacing-base)' }}>
        <button className="tab active text-button-sm" style={{ flex: 1, padding: 'var(--spacing-md)', borderBottom: '2px solid var(--color-ink)', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>받은 마음</button>
        <button className="tab text-button-sm text-muted" style={{ flex: 1, padding: 'var(--spacing-md)', background: 'transparent', border: 'none' }}>보낸 마음</button>
      </div>
      <main className="content-area">
        <div className="card" style={{ padding: 'var(--spacing-base)', marginBottom: 'var(--spacing-base)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-title-sm">엄마</span>
            <span className="text-caption-sm text-muted">2026. 07. 25</span>
          </div>
          <p className="text-body-md" style={{ marginTop: 'var(--spacing-sm)' }}>우리 딸, 밥은 잘 챙겨 먹고 다니니? 항상 사랑해 💕</p>
        </div>
      </main>
    </div>
  );
}
