import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: 0 }}>
      {/* Hero Section */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-xl)', textAlign: 'center', backgroundColor: 'var(--color-surface-soft)' }}>
        <img src="/로고.png" alt="오늘도 사랑해 로고" style={{ width: '120px', height: '120px', borderRadius: 'var(--rounded-xl)', marginBottom: 'var(--spacing-lg)' }} />
        <h1 className="text-display-xl" style={{ color: 'var(--color-primary)', marginBottom: 'var(--spacing-md)' }}>오늘도 사랑해</h1>
        <p className="text-display-sm" style={{ color: 'var(--color-ink)', marginBottom: 'var(--spacing-sm)' }}>
          쑥스러운 마음을 추억으로 전하는 곳
        </p>
        <p className="text-body-md text-muted" style={{ maxWidth: '80%', marginBottom: 'var(--spacing-xl)' }}>
          우리 가족만의 비밀 감정 사서함에서 사진과 짧은 영상으로 자연스럽게 대화의 물꼬를 터보세요.
        </p>
        
        <Link to="/login" className="btn-primary" style={{ width: '100%', maxWidth: '300px', borderRadius: 'var(--rounded-full)', height: '56px', fontSize: '18px' }}>
          시작하기
        </Link>
      </section>

      {/* Feature Section */}
      <section style={{ padding: 'var(--spacing-xl)', backgroundColor: 'var(--color-canvas)' }}>
        <div style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>특별한 우리의 공간</h2>
          <p className="text-body-sm text-muted">가족, 연인, 친구들과 앨범방을 만들어 소중한 순간을 공유하세요.</p>
        </div>
        <div style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>
          <h2 className="text-title-md" style={{ marginBottom: 'var(--spacing-sm)' }}>마음이 담긴 사서함</h2>
          <p className="text-body-sm text-muted">쑥스러워 하지 못한 말들을 음성이나 텍스트로 남겨보세요.</p>
        </div>
      </section>
    </div>
  );
}
