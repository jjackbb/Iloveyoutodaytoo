

export default function ProfilePage() {
  return (
    <div className="page-container">
      <header className="top-header">
        <h1 className="text-display-md">마이페이지</h1>
      </header>
      <main className="content-area">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: 'var(--rounded-full)', backgroundColor: 'var(--color-surface-strong)', marginRight: 'var(--spacing-base)' }}></div>
          <div>
            <h2 className="text-title-md">다정한 딸</h2>
            <p className="text-body-sm text-muted">user@example.com</p>
          </div>
        </div>
        <div className="menu-list">
          <button className="menu-item text-body-md" style={{ width: '100%', textAlign: 'left', padding: 'var(--spacing-base) 0', borderBottom: '1px solid var(--color-hairline)', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>내 정보 설정</button>
          <button className="menu-item text-body-md" style={{ width: '100%', textAlign: 'left', padding: 'var(--spacing-base) 0', borderBottom: '1px solid var(--color-hairline)', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>알림 설정</button>
          <button className="menu-item text-body-md text-muted" style={{ width: '100%', textAlign: 'left', padding: 'var(--spacing-base) 0', background: 'transparent', border: 'none' }}>로그아웃</button>
        </div>
      </main>
    </div>
  );
}
