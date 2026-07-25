import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Dummy login logic
    if (email && password) {
      navigate('/home');
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', padding: 'var(--spacing-xl)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <img src="/로고.png" alt="오늘도 사랑해 로고" style={{ width: '120px', height: '120px', borderRadius: 'var(--rounded-xl)', marginBottom: 'var(--spacing-base)' }} />
        <h1 className="text-display-lg" style={{ color: 'var(--color-primary)' }}>오늘도 사랑해</h1>
        <p className="text-body-md text-muted" style={{ marginTop: 'var(--spacing-sm)' }}>쑥스러운 마음을 전하는 곳</p>
      </div>

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-base)' }}>
        <input 
          type="email" 
          className="input-text" 
          placeholder="이메일" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required 
        />
        <input 
          type="password" 
          className="input-text" 
          placeholder="비밀번호" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required 
        />
        <button type="submit" className="btn-primary" style={{ marginTop: 'var(--spacing-sm)', width: '100%' }}>이메일로 로그인</button>
      </form>
      
      <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>
        <a href="#" className="text-caption text-muted">비밀번호 찾기</a>
        <span style={{ margin: '0 8px', color: 'var(--color-hairline)' }}>|</span>
        <a href="#" className="text-caption text-muted">이메일 회원가입</a>
      </div>
    </div>
  );
}
