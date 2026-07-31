# Voice Recording & Waveform Playback Feature Guide

이 문서는 "오늘도 사랑해" 프로젝트에서 구현된 **음성 녹음(최소 3초 제한) 및 시각적 웨이브폼(Waveform) 재생 기능**에 대한 명세서이자 구현 가이드입니다. 향후 다른 프로젝트나 페이지에서 동일한 기능을 쉽게 이식하고 사용할 수 있도록 컴포넌트화된 코드와 핵심 로직을 정리했습니다.

---

## 1. 핵심 기능 요약
- **음성 녹음 모드 전환**: `idle` (대기) → `recording` (녹음 중) → `preview` (미리보기) 상태 기반 제어.
- **최소 3초 녹음 규칙**: 녹음 타이머(`setInterval`)를 통해 시간이 계산되며, 3초 미만일 때 정지할 경우 경고를 띄우고 상태 전환을 차단함.
- **Waveform(파형) 시각화**: 녹음된 오디오의 길이에 맞게 여러 개의 막대(Bar)를 렌더링하고, 현재 재생 진행률(Progress)에 따라 하이라이트 색상을 변경함.
- **구간 클릭 재생**: 파형의 특정 막대를 클릭하면 해당 시점부터 오디오가 재생되도록 제어함.

---

## 2. 상태 관리 로직 (State Management)
이 기능은 부모 컴포넌트(예: Modal 또는 Page)에서 아래와 같은 상태(State)와 Ref를 활용해 제어됩니다.

```tsx
type RecordState = "idle" | "recording" | "preview";

const [recordState, setRecordState] = useState<RecordState>("idle");
const [recordingTime, setRecordingTime] = useState(0); // 현재 녹음된 시간(초)
const [finalDuration, setFinalDuration] = useState(0); // 녹음이 완료된 최종 시간(초)
const timerRef = useRef<NodeJS.Timeout | null>(null);
```

### 필수 함수
- **`handleStartRecording`**: `setInterval`을 이용해 1초마다 `recordingTime`을 1씩 증가시킴.
- **`handleStopRecording`**: 
  - `recordingTime < 3` 일 경우: 에러 토스트(Toast) 발생 및 중단 차단.
  - `recordingTime >= 3` 일 경우: 타이머(interval)를 정리(clearInterval)하고, 상태를 `preview`로 전환.
- **`handleResetRecording`**: 모든 상태를 `idle`과 `0`으로 초기화하여 재녹음 환경 세팅.

---

## 3. Waveform UI 컴포넌트 (`Waveform.tsx`)
실제 오디오 데이터를 파싱하지 않더라도(Mock UI 기준), 난수를 기반으로 파형을 그리고 부드러운 재생 상태를 시뮬레이션할 수 있는 재사용 가능한 컴포넌트입니다.

```tsx
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaveformProps {
  duration: number; // 총 오디오 길이 (초)
}

export function Waveform({ duration }: WaveformProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 ~ 1 사이의 진행률
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const NUM_BARS = 40; // 생성할 파형 막대의 개수

  // 막대의 높이를 1회성 난수로 고정 생성
  const heights = useMemo(() => {
    return Array.from({ length: NUM_BARS }).map(() => Math.max(0.2, Math.random()));
  }, []);

  // 재생 상태에 따른 진행률 업데이트
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = 50; 
      const progressIncrement = intervalMs / (duration * 1000);
      
      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev + progressIncrement >= 1) {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return 1;
          }
          return prev + progressIncrement;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, duration]);

  // 특정 파형 막대 클릭 시 해당 구간부터 재생
  const handleBarClick = (index: number) => {
    const newProgress = index / NUM_BARS;
    setProgress(newProgress);
    setIsPlaying(true); 
  };

  const currentSeconds = progress * duration;

  return (
    // ... UI 렌더링 부 (map 함수를 활용하여 heights 렌더링, progress에 따른 색상 분기)
    // 실제 컴포넌트 코드는 src/components/shared/Waveform.tsx 참조
  );
}
```

---

## 4. 확장 가이드 (실제 오디오 API 연동 시)
현재 기능은 Mock(시뮬레이션) 기반으로 작성되어 있습니다. 추후 실제 사용자 기기의 마이크를 사용해 녹음 기능을 연동하려면 다음 항목을 추가로 구현해야 합니다.

1. **`MediaRecorder API` 연동**: 
   `navigator.mediaDevices.getUserMedia({ audio: true })`를 호출하여 스트림을 얻고 `MediaRecorder` 인스턴스를 생성해야 합니다.
2. **실제 Web Audio API 시각화 (선택)**: 
   `AudioContext` 및 `AnalyserNode`를 사용해 재생 중인 오디오의 `frequencyData`를 추출하면, `Math.random()` 대신 실제 음성의 볼륨과 주파수에 맞는 막대(Bar) 높이를 그릴 수 있습니다.
3. **오디오 재생**: 
   `const audio = new Audio(blobUrl)` 형태로 음원 객체를 생성한 뒤, `audio.play()`와 `audio.currentTime` 속성을 조작하여 웨이브폼 진행률(`progress`)과 실제 오디오 재생 위치를 동기화합니다.
