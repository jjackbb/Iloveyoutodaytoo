# 프로토타입 화면 명세 — `detail`

> `extract-screen.mjs` 가 자동 생성했다. 손으로 고치지 말고 다시 뽑아라.
> **여기 있는 JS는 옮겨 쓰라고 넣은 게 아니다.** 마크업 모양을 알려주려고 넣었다.

- 클래스 28개 / 매칭된 CSS 규칙 38개
- body를 JS가 채우는가: **예 (renderDetail)**

## ⚠️ 이 화면에 버림 판정 기능이 섞여 있다 — 이식하지 마라

아래는 원본에 있지만 **명세로 옮길 때 빼기로 판정된** 것들이다 (PRD/05_REDESIGN_PLAN.md §2).

- 댓글바·이모지 피커 — PRD §6, 반응 수단은 마음 메시지 하나
- 좋아요 — PRD §6 명시적 제외

## 1. 마크업

```html
<section class="page" id="detail">
        <div class="appbar"><button class="iconbtn" onclick="back()"><svg class="ic"><use href="#i-chevron-left"/></svg></button><div class="pagetitle" id="detailTitle">추억</div><div class="spacer"></div><button class="iconbtn post-more" onclick="openPostActions(event,state.currentPost)" aria-label="피드 더보기"><svg class="ic"><use href="#i-more"/></svg></button></div>
        <div class="body" id="detailBody"></div>
        <div class="comment-bar" id="commentBar">
          <div class="emoji-wrap">
            <button type="button" class="emoji-btn" onclick="toggleEmojiPicker()" aria-label="이모티콘 보내기" aria-expanded="false"><svg class="ic"><use href="#i-smile"/></svg></button>
            <div class="emoji-picker" id="emojiPicker" role="menu" aria-label="이모티콘 선택">
              <button type="button" onclick="insertEmoji('😀')" aria-label="웃는 얼굴">😀</button>
              <button type="button" onclick="insertEmoji('🥰')" aria-label="하트 눈 얼굴">🥰</button>
              <button type="button" onclick="insertEmoji('😂')" aria-label="눈물 나게 웃는 얼굴">😂</button>
              <button type="button" onclick="insertEmoji('😊')" aria-label="미소 짓는 얼굴">😊</button>
              <button type="button" onclick="insertEmoji('😍')" aria-label="하트 눈">😍</button>
              <button type="button" onclick="insertEmoji('😭')" aria-label="우는 얼굴">😭</button>
              <button type="button" onclick="insertEmoji('❤️')" aria-label="빨간 하트">❤️</button>
              <button type="button" onclick="insertEmoji('💕')" aria-label="두 하트">💕</button>
              <button type="button" onclick="insertEmoji('💗')" aria-label="핑크 하트">💗</button>
              <button type="button" onclick="insertEmoji('👍')" aria-label="엄지척">👍</button>
              <button type="button" onclick="insertEmoji('👏')" aria-label="박수">👏</button>
              <button type="button" onclick="insertEmoji('✨')" aria-label="반짝임">✨</button>
            </div>
          </div>
          <input id="commentInput" placeholder="메시지 또는 음성메시지를 남겨보세요" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();addComment()}">
          <button type="button" class="mic-c" onclick="openCRecSheet()" title="음성 댓글" aria-label="음성메시지 보내기"><svg class="ic"><use href="#i-mic"/></svg></button>
          <button class="snd" onclick="addComment()"><svg class="ic"><use href="#i-send"/></svg></button>
        </div>
      </section>
```

## 2. 본문을 그리는 JS — `renderDetail`

이 화면은 마크업의 body가 비어 있다. 아래 함수가 만들어내는 **HTML 모양만** 가져오고,
상태 변수(`state.…`)와 DOM 조작은 서버에서 읽은 데이터로 대체한다.

```js
function renderDetail(){
    const posts=state.posts[state.currentRoom]||[];
    const p=posts.find(x=>x.id===state.currentPost); if(!p) return;
    const room=state.rooms?state.rooms.find(r=>r.id===state.currentRoom):null;
    const detailTitleEl=document.getElementById('detailTitle');
    if(detailTitleEl){
      detailTitleEl.textContent=(room&&room.name)?room.name:'추억';
    }
    const authorName = resolveDisplayName(p.author);
    let h=`<div class="post-head" style="padding-left:2px"><img class="avatar profile-tappable" style="width:40px;height:40px" src="${p.ava}" onclick="event.stopPropagation();openProfilePreview('${esc(authorName)}','${p.ava}')"><div><div class="who">${esc(authorName)}</div><div class="when">${p.date}</div></div></div>`;
    h+=postMediaMarkup(p,true);
    if(p.caption) h+=`<div class="caption" style="padding-left:2px;padding-right:2px">${esc(p.caption)}</div>`;
    if(p.dur) h+=`<div class="post-waveform-placeholder" data-key="post-${p.id}" data-duration="${p.dur}" style="padding: 4px 2px 12px;"></div>`;
    h+=`<div class="post-foot" style="padding-left:2px"><span class="like-btn ${p.liked ? 'active' : ''}" onclick="likePost()"><svg class="ic"><use href="#i-heart"/></svg> <span id="likeCount">${p.likes}</span></span><span><svg class="ic"><use href="#i-comment"/></svg> ${p.comments.length}</span></div>`;
    h+=`<div class="sec-label">댓글 ${p.comments.length}</div><div id="commentList">`;
    p.comments.forEach((c,i)=>{ h+=commentRow(c,i,p.id); });
    h+=`</div>`;
    document.getElementById('detailBody').innerHTML=h;
    buildWaves();
    bindCommentLongPress();
  }
```

## 3. 이 화면이 쓰는 CSS

```css
.ic{width:24px;height:24px;display:inline-block;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;}

.appbar{flex:none;display:flex;align-items:center;gap:6px;padding:6px 20px 12px;background:var(--bg);}

.appbar .pagetitle{font-weight:800;font-size:17px;letter-spacing:-.3px;}

.appbar .spacer{flex:1;}

.iconbtn{width:40px;height:40px;border-radius:50%;border:none;background:transparent;color:#4a464c;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;}

.iconbtn[onclick="openNotifications()"]{position:relative;}

.iconbtn:active{background:rgba(0,0,0,.06);}

.iconbtn .ic{width:22px;height:22px;}

.body{flex:1;overflow-y:auto;padding:2px 20px 22px;-webkit-overflow-scrolling:touch;}

.body::-webkit-scrollbar{width:0;}

.post-head{display:flex;align-items:center;gap:10px;padding:14px 16px 11px;}

.avatar{border-radius:50%;object-fit:cover;background:#F3E3E8;flex:none;}

.post-head .who{font-size:14px;font-weight:800;letter-spacing:-.2px;}

.post-head .when{font-size:11.5px;color:var(--ink-3);margin-top:1px;font-weight:500;}

.profile-tappable{cursor:pointer;}

.profile-tappable:active{transform:scale(.96);}

.caption{padding:12px 16px 2px;font-size:14px;line-height:1.6;color:#2b2b2e;}

.post-foot{display:flex;align-items:center;gap:18px;padding:2px 16px 15px;font-size:13px;color:var(--ink-2);font-weight:600;}

.post-foot span{display:flex;align-items:center;gap:6px;cursor:pointer;}

.post-foot .ic{width:18px;height:18px;}

.post-foot .like-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--ink-3);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: color 0.2s;
  }

.post-foot .like-btn .ic {
    width: 18px;
    height: 18px;
    stroke: var(--ink-3);
    fill: none;
    transition: stroke 0.2s, fill 0.2s;
  }

.sec-label{font-size:13.5px;font-weight:800;color:#3a3540;margin:20px 2px 6px;}

.comment-bar{position:relative;flex:none;display:flex;align-items:center;gap:8px;padding:11px 16px;background:#fff;border-top:1px solid var(--line);}

.comment-bar input{flex:1;border:none;background:var(--bg-warm);border-radius:22px;padding:12px 16px;font-family:inherit;font-size:13.5px;outline:none;color:var(--ink);}

.comment-bar input::placeholder{color:var(--ink-3);}

.emoji-wrap{position:relative;flex:none;}

.emoji-btn{width:40px;height:40px;border-radius:50%;border:none;background:var(--bg-warm);color:var(--brand);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;}

.emoji-btn .ic{width:22px;height:22px;}

.emoji-btn:active{filter:brightness(.95);}

.emoji-picker{position:absolute;left:-6px;bottom:50px;width:238px;padding:10px;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;background:#fff;border:1px solid var(--line);border-radius:17px;box-shadow:0 12px 30px -10px rgba(60,20,35,.3);opacity:0;visibility:hidden;transform:translateY(6px) scale(.96);transform-origin:bottom left;transition:opacity .16s,transform .16s,visibility .16s;z-index:20;}

.emoji-picker button{width:31px;height:31px;border:none;background:transparent;border-radius:9px;font-size:20px;line-height:1;cursor:pointer;}

.emoji-picker button:hover,.emoji-picker button:active{background:#FFF0F4;}

.comment-bar .snd{width:40px;height:40px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--brand),var(--brand-2));color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;}

.comment-bar .snd .ic{width:20px;height:20px;}

.comment-bar .mic-c{width:40px;height:40px;border-radius:50%;border:none;background:var(--bg-warm);color:var(--brand);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;}

.comment-bar .mic-c .ic{width:22px;height:22px;}

.comment-bar .mic-c:active{filter:brightness(.95);}
```

