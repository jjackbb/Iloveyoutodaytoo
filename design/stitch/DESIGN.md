---
version: alpha
name: Oneuldo Saranghae (오늘도 사랑해)
description: A calm, private album app where people leave small expressions of love — handwriting, voice, photo, or short video — for someone precious (family, partner, oneself, a pet). Neutral canvas, one burnt-orange accent used as points, never as large fills.
colors:
  primary: "#BF3F0D"
  primary-active: "#99320A"
  primary-light: "#D2450E"
  primary-soft: "#FBF3F0"
  canvas: "#F7F8FA"
  surface: "#FFFFFF"
  surface-soft: "#F2F4F6"
  on-surface: "#222222"
  muted: "#6A6A6A"
  hairline: "#E5E8EB"
  hairline-strong: "#DCE0E5"
  brand-cream: "#F8F2EC"
  cover-paper: "#EDE6DE"
  handwriting-paper: "#FCFBF8"
  favorite: "#FF5A7A"
  avatar-parent-bg: "#EFE8DF"
  avatar-parent-fg: "#76614D"
  avatar-child-bg: "#E8EDF2"
  avatar-child-fg: "#53687D"
  error-bg: "#FFF4F1"
  error: "#99320A"
typography:
  title-app:
    fontFamily: Pretendard
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.035em
  headline-lg:
    fontFamily: Pretendard
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Pretendard
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: -0.03em
  body-lg:
    fontFamily: Pretendard
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.65
  body-md:
    fontFamily: Pretendard
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.7
  body-sm:
    fontFamily: Pretendard
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  label-lg:
    fontFamily: Pretendard
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.2
  label-tag:
    fontFamily: Pretendard
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1
  label-sm:
    fontFamily: Pretendard
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: 10px
  md: 14px
  card: 16px
  lg: 20px
  full: 9999px
spacing:
  base: 16px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  screen-x: 20px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.card}"
    height: 56px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.card}"
    height: 52px
  album-card:
    backgroundColor: "{colors.cover-paper}"
    rounded: "{rounded.card}"
    width: 100%
  album-name-tag:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-tag}"
    height: 29px
    padding: 0 9px
  unread-badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    size: 22px
  fab-add:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: 56px
  method-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.card}"
    height: 80px
    padding: 0 16px
  segmented-tabs:
    backgroundColor: "{colors.surface-soft}"
    rounded: "{rounded.md}"
    padding: 4px
    height: 44px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 14px
  avatar:
    rounded: "{rounded.full}"
    size: 38px
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 20px
---

# Oneuldo Saranghae — Design System

## Overview

"오늘도 사랑해" (I love you, today too) helps people who find it hard to *start* expressing affection. A user opens a private **album room (앨범방)** shared with someone precious and leaves a small "heart" (마음) as handwriting, voice (≤60s), photos (≤10), or one short video (≤30s), with an optional short caption (≤300 chars). The other person views it, likes it, and comments.

Mood: quiet, warm, private — like a paper album, not a social network. The emotions involved are shyness, gratitude, regret; **the UI never shouts**. Korean UI copy, mobile first (390 × 844), usable at 320px. Familiarity baseline is KakaoTalk / Instagram: icon buttons, heart likes, comment counts, floating "+" are assumed known.

## Colors

- **Neutral canvas, color as points.** Page background `canvas` or `surface`; cards white with 1px `hairline` borders. The only accent is burnt orange `primary` (#BF3F0D, from the logo), used for the main action, selected states, the unread badge, and active likes. Never fill large areas or backgrounds with it.
- `primary-soft` is the tint for selected rows/chips. `favorite` pink is only for the favorited album heart.
- White text on `primary` passes 4.5:1; do not use anything lighter than `primary-light` behind white text.
- Avatars use two soft neutral pairs (parent: warm beige, child: cool gray-blue) with a single Korean initial.

## Typography

Pretendard only (Korean + Latin). Titles 700, buttons 600, body 400. No 800/900 weights — they read as ads. App-bar title 18px; screen headline 20–24px; body 16px; captions/meta 12–14px in `muted`. Keep Korean line breaks natural (keep-all).

## Layout

- Mobile frame 390 × 844, side gutter 20px, section gap 24–32px, card gap 16px.
- App bar 56–76px: back chevron (44px target) · centered title · one right action or empty spacer.
- Screens with a persistent action (write, edit, comment) keep content scrolling and pin the action bar to the bottom with a top hairline.
- The album room has a **floating round "+" (56px, bottom-right, 20px inset)** that stays while scrolling.
- Minimum touch target 44 × 44px everywhere.

## Elevation & Depth

Flat. Cards use a 1px border, no shadow. Only floating elements get soft shadow: the "+" FAB (orange glow, 0 6px 16px at 35%), popover menus (0 8px 24px at 14%), dialogs over a 45% black backdrop.

## Shapes

Album cards and content cards 16px radius; buttons 14–16px; inner media 14px; dialogs 20px; avatars, badges, chips, FAB fully round. Album covers and media are **4:3**.

## Components

- **Album card (home):** full-width 4:3 cover (latest handwriting drawn on `cover-paper`, or a photo). Bottom-left: a white name tag flush to the corner — height 29px, 9px horizontal padding, 10px inner top-right radius, 15/600 text "우리 앨범방". Unread count as a round orange **number badge** overlapping the tag's top-right corner with a 2px white ring. Directly above the tag: overlapping member avatars (30px, 2px white ring, -9px overlap; show 2 then "+N" for 3+). Top-right: outline heart for favorite (white, subtle drop shadow; pink filled when on).
- **Memory card (album room feed):** author row (avatar, name, date; own posts get a "⋯" at right) → media preview (4:3; handwriting and video show a small **plain black ▶ (no circle)** at top-right that plays inline) → caption → action row **bottom-left**: heart outline + like count, speech-bubble + comment count.
- **Method rows (compose start):** four full-width 80px rows — icon tile 48px on `primary-soft` with orange line icon, title 17/600, one-line muted detail, chevron at right. After choosing, they collapse to **segmented tabs** (4 equal, gray track, white selected pill with orange text).
- **Detail:** author row + ⋯ → media → action row (heart, comment) → "**name** caption" like Instagram → comment list (32px avatar, bold name + text, small timestamp) → bottom-pinned comment input (rounded full input + orange text "게시" button).
- **Edit mode (album room):** title "추억 고르기", "완료" in orange at top right; own cards become selectable with a round check replacing the avatar (orange filled when selected, 2px orange card border, `primary-soft` fill); others' cards 45% opacity. Bottom bar: "N개 골랐어요" + two buttons "수정" (enabled only with exactly one) and "삭제" (orange text).
- **Popover menu (⋯):** white, 14px radius, 44px rows "수정", "삭제" (orange).
- **Dialog:** title 18/700, one muted sentence, two equal buttons "그만두기" (secondary) and the action (primary).

## Do's and Don'ts

- Do keep the album cover 4:3 with the flush bottom-left name tag (29px / 9px) and the numeric unread badge — these are approved decisions.
- Do show the four expression methods as equals: 손글씨 · 목소리 · 사진 · 영상.
- Do keep all copy short, soft, and in Korean; say "마음" (a heart/feeling), "앨범방" (album room), "소중한 존재" (someone precious).
- Don't use the words "가족방" or assume the other person is family; it may be a partner, oneself, or a pet.
- Don't add greetings, marketing headlines, streaks, gamification, emoji, gradients, or decorative blobs.
- Don't put a round background behind the ▶ play mark; it is a plain black glyph.
- Don't place demo notices ("가상의 앨범방이에요…") inside the app screen; they live outside the phone frame.
- Don't rely on hidden gestures for core actions; every action has a visible button.
