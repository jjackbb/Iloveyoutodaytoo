# 프로토타입 화면 명세 — `home`

> `extract-screen.mjs` 가 자동 생성했다. 손으로 고치지 말고 다시 뽑아라.
> **여기 있는 JS는 옮겨 쓰라고 넣은 게 아니다.** 마크업 모양을 알려주려고 넣었다.

- 클래스 22개 / 매칭된 CSS 규칙 45개
- body를 JS가 채우는가: **예 (renderHome)**

## 1. 마크업

```html
<section class="page dissolve" id="home">
        <div class="appbar"><div class="brand"><svg class="ic fill hh"><use href="#i-heart"/></svg> 오늘도 사랑해</div><div class="spacer"></div><button class="iconbtn" onclick="openNotifications()" aria-label="알림"><svg class="ic"><use href="#i-bell"/></svg></button></div>
        <div class="body" id="homeBody"></div>
        <div class="action-bar" id="homeActionBar">
          <button class="btn-primary" onclick="nav('createRoom')">새로운 앨범방 만들기</button>
        </div>
      </section>
```

## 2. 본문을 그리는 JS — `renderHome`

이 화면은 마크업의 body가 비어 있다. 아래 함수가 만들어내는 **HTML 모양만** 가져오고,
상태 변수(`state.…`)와 DOM 조작은 서버에서 읽은 데이터로 대체한다.

```js
function renderHome(){
    const b=document.getElementById('homeBody');
    if(state.rooms.length===0){
      b.classList.add('center');
      b.innerHTML=`<div class="empty-hero">
        <div class="empty-emoji"><svg class="ic"><svg class="ic"><use href="#i-image"/></svg></svg></div>
        <h2>아직 연결된<br>소중한 공간이 없어요</h2>
        <p>우리만의 첫 번째 앨범방을 만들고<br>소중한 사람들을 초대해 보세요.</p>
      </div>`;
    } else {
      b.classList.remove('center');
      let h=``;
      const sortedRooms = [...state.rooms].sort((a, b) => {
        if (a.liked && !b.liked) return -1;
        if (!a.liked && b.liked) return 1;
        return 0;
      });
      sortedRooms.forEach(r=>{
        const n=(state.posts[r.id]||[]).length;
        h+=`<div class="album-card" data-room-id="${r.id}" onclick="enterRoom('${r.id}')">
          <div class="album-photo" style="background-image:url('${r.cover}')">
            <button class="chip-inv" onclick="event.stopPropagation();inviteRoom('${r.id}')"><svg class="ic"><use href="#i-people"/></svg> 초대</button>
            <button class="fav ${r.liked?'on':''}" onclick="event.stopPropagation();toggleFav('${r.id}',this)"><svg class="ic ${r.liked?'fill':''}"><use href="#i-heart"/></svg></button>
            <div class="members">${renderRoomMembersHTML(r)}</div>
          </div>
          <div class="album-meta"><h4>${esc(r.name)}</h4><p>멤버 ${r.members}명 <span class="dotsep"></span> 게시물 ${n}개 <span class="dotsep"></span> ${r.updated}</p></div>
        </div>`;
      });
      b.innerHTML=h;
      bindHomeLongPress();
    }
    document.getElementById('homeActionBar').style.display = 'block';
  }
```

## 3. 이 화면이 쓰는 CSS

```css
#home .action-bar, #mailbox .action-bar, #album .action-bar {
    margin-bottom: 0;
  }

#home .body, #mailbox .body, #my .body, #album .body {
    padding-bottom: 90px !important;
  }

.action-bar {
    border-bottom-left-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    overflow: hidden;
  }

.ic{width:24px;height:24px;display:inline-block;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;}

.ic.fill{fill:currentColor;stroke:none;}

.appbar{flex:none;display:flex;align-items:center;gap:6px;padding:6px 20px 12px;background:var(--bg);}

.appbar .brand{display:flex;align-items:center;gap:7px;font-weight:900;font-size:19px;letter-spacing:-.4px;}

.appbar .brand .hh{width:20px;height:20px;color:var(--brand);}

.appbar .spacer{flex:1;}

.iconbtn{width:40px;height:40px;border-radius:50%;border:none;background:transparent;color:#4a464c;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;}

.iconbtn[onclick="openNotifications()"]{position:relative;}

.iconbtn:active{background:rgba(0,0,0,.06);}

.iconbtn .ic{width:22px;height:22px;}

.body{flex:1;overflow-y:auto;padding:2px 20px 22px;-webkit-overflow-scrolling:touch;}

.body::-webkit-scrollbar{width:0;}

.btn-primary{width:100%;border:none;border-radius:17px;color:#fff;font-family:inherit;font-weight:800;font-size:15.5px;padding:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:-.2px;background:linear-gradient(135deg,var(--brand),var(--brand-2));box-shadow:var(--shadow-btn);transition:transform .12s,filter .12s,opacity .2s;}

.btn-primary .ic{width:20px;height:20px;stroke-width:2.4;}

.btn-primary:active{transform:translateY(1px) scale(.995);filter:brightness(.97);}

.btn-primary:disabled{opacity:.45;box-shadow:none;cursor:default;filter:grayscale(.2);}

/* empty home */
  .empty-hero{margin-top:16px;border-radius:26px;padding:40px 24px 34px;text-align:center;background:linear-gradient(180deg,#fff,#FFF3F6);box-shadow:var(--shadow-card);border:1px solid #FBEAEF;}

.empty-emoji{width:118px;height:118px;margin:0 auto 22px;border-radius:50%;background:radial-gradient(circle at 50% 38%,#FFE1E9,#FFC9D8);display:flex;align-items:center;justify-content:center;color:var(--brand);box-shadow:inset 0 -10px 22px rgba(255,78,116,.16);}

.empty-emoji .ic{width:52px;height:52px;stroke-width:1.7;}

.empty-hero h2{font-size:19px;font-weight:900;letter-spacing:-.5px;line-height:1.4;}

.empty-hero p{font-size:14px;color:var(--ink-2);margin-top:11px;line-height:1.65;font-weight:500;}

.empty-hero .btn-primary{margin-top:26px;}

.album-card{background:var(--card);border-radius:22px;overflow:hidden;margin-top:14px;cursor:pointer;box-shadow:var(--shadow-card);transition:transform .14s;}

.album-card:active{transform:scale(.985);}

.album-photo{position:relative;height:158px;background:#F3E3E8 center/cover;}

.album-photo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,.32));}

.chip-inv{position:absolute;top:12px;left:12px;z-index:3;display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.94);color:var(--brand);font-size:11.5px;font-weight:800;padding:7px 12px;border-radius:100px;border:none;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px -4px rgba(60,20,35,.25);}

.chip-inv:active{transform:scale(.94);}

.chip-inv .ic{width:13px;height:13px;stroke-width:2.4;}

.fav{position:absolute;top:11px;right:11px;z-index:3;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;color:var(--brand);border:none;cursor:pointer;box-shadow:0 4px 12px -4px rgba(60,20,35,.25);transition:transform .12s,background .15s;}

.fav:active{transform:scale(.85);}

.fav .ic{width:19px;height:19px;}

.album-photo .members{position:absolute;left:14px;bottom:12px;z-index:2;display:flex;}

.album-photo .members img{width:26px;height:26px;border-radius:50%;border:2px solid #fff;object-fit:cover;margin-left:-8px;}

.album-photo .members img:first-child{margin-left:0;}

.album-meta{padding:13px 16px 16px;}

.album-meta h4{font-size:15.5px;font-weight:800;letter-spacing:-.3px;}

.album-meta p{font-size:12.5px;color:var(--ink-3);margin-top:5px;font-weight:500;display:flex;align-items:center;gap:5px;}

.dotsep{width:3px;height:3px;border-radius:50%;background:var(--ink-3);display:inline-block;}

.action-bar{flex:none;padding:11px 18px;background:var(--card);border-top:1px solid var(--line);}

.action-bar .btn-primary{font-size:16.5px;padding:17px;}

.action-bar .btn-primary .ic{width:22px;height:22px;}
```
