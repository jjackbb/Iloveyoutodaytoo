import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Image as ImageIcon, Mic } from 'lucide-react';

export default function AlbumPage() {
  const { id } = useParams();
  const [showReplyForm, setShowReplyForm] = useState(false);
  
  // to avoid unused variable warning
  console.log(id);

  return (
    <div className="page-container" style={{ paddingBottom: '120px' }}>
      <header className="top-header" style={{ display: 'flex', alignItems: 'center', padding: 'var(--spacing-base)' }}>
        <Link to="/home" style={{ marginRight: 'var(--spacing-base)' }}>
          <ArrowLeft size={24} color="var(--color-ink)" />
        </Link>
        <h1 className="text-title-md">우리 가족 사랑해 💖</h1>
      </header>

      <main className="content-area">
        {/* Feed Item */}
        <div className="card" style={{ marginBottom: 'var(--spacing-xl)', borderRadius: '0' }}>
          <div style={{ width: '100%', height: '300px', backgroundColor: 'var(--color-surface-strong)', backgroundImage: 'url(https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=1000&auto=format&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
            {/* Image Placeholder */}
          </div>
          <div style={{ padding: 'var(--spacing-base)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
              <div>
                <span className="text-title-sm">엄마</span>
                <span className="text-caption-sm text-muted" style={{ marginLeft: 'var(--spacing-sm)' }}>2026. 07. 25</span>
              </div>
              <button className="btn-secondary" style={{ padding: '8px', border: 'none', background: 'transparent' }}>
                <Heart size={24} color="var(--color-primary)" fill="var(--color-primary)" />
              </button>
            </div>
            <p className="text-body-md">주말에 다녀온 가족 여행 사진이야. 다들 너무 예쁘게 나왔네~</p>
            
            <div style={{ marginTop: 'var(--spacing-base)', paddingTop: 'var(--spacing-base)', borderTop: '1px solid var(--color-hairline)' }}>
              {showReplyForm ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" className="input-text" placeholder="마음 남기기..." style={{ height: '40px', padding: '8px 12px' }} />
                  <button className="btn-primary" style={{ height: '40px', padding: '0 16px' }}>등록</button>
                </div>
              ) : (
                <button className="btn-secondary" style={{ width: '100%', height: '40px', borderRadius: 'var(--rounded-full)' }} onClick={() => setShowReplyForm(true)}>
                  마음 메시지 남기기
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Action Button for Upload */}
      <div style={{ position: 'fixed', bottom: '80px', right: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button className="btn-primary" style={{ width: '56px', height: '56px', borderRadius: 'var(--rounded-full)', padding: 0, boxShadow: 'var(--shadow-float)' }}>
          <Mic size={24} />
        </button>
        <button className="btn-primary" style={{ width: '56px', height: '56px', borderRadius: 'var(--rounded-full)', padding: 0, boxShadow: 'var(--shadow-float)', backgroundColor: 'var(--color-ink)' }}>
          <ImageIcon size={24} />
        </button>
      </div>
    </div>
  );
}
