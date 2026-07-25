import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="page-container">
      <header className="top-header">
        <h1 className="text-display-md" style={{ color: 'var(--color-primary)' }}>오늘도 사랑해</h1>
      </header>

      <main className="content-area">
        <section className="album-list">
          <div className="empty-state" style={{ padding: 'var(--spacing-xl) 0', textAlign: 'center' }}>
            <p className="text-body-md text-muted">아직 연결된 공간이 없어요.</p>
            <p className="text-caption text-muted" style={{ marginBottom: 'var(--spacing-lg)' }}>새로운 앨범방을 만들어 가족을 초대해보세요!</p>
            <button className="btn-primary" style={{ borderRadius: 'var(--rounded-full)' }}>
              <Plus size={20} style={{ marginRight: '8px' }} />
              새로운 앨범방 만들기
            </button>
          </div>
          
          {/* Mock data for album cards */}
          <div className="card" style={{ marginBottom: 'var(--spacing-base)' }}>
            <div style={{ padding: 'var(--spacing-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="text-title-md">우리 가족 사랑해 💖</h2>
                <p className="text-body-sm text-muted">엄마, 아빠, 나</p>
              </div>
              <Link to="/album/1" className="btn-secondary" style={{ padding: '8px 16px', height: 'auto', borderRadius: 'var(--rounded-full)' }}>
                입장
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
