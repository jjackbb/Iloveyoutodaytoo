#!/usr/bin/env bash
# 화면 하나를 이식할 때마다 통과해야 하는 관문.
#
# 순서에 이유가 있다: 빠르고 잘 걸리는 것부터 돌린다.
# 잔여데이터 검사(1초) → 타입 검사(수초) → 린트 → 빌드(가장 느림).
# 앞에서 걸리면 뒤를 돌릴 이유가 없다.
#
# 사용법: bash verify.sh [--skip-build]

set -uo pipefail
cd "$(dirname "$0")/../../../.." || exit 1

SKIP_BUILD=0
[[ "${1:-}" == "--skip-build" ]] && SKIP_BUILD=1

FAILED=()

step() {
  local name="$1"; shift
  echo ""
  echo "── $name ──"
  if "$@"; then
    echo "   통과"
  else
    echo "   실패"
    FAILED+=("$name")
  fi
}

step "잔여데이터 검사" node .claude/skills/residue-scan/scripts/residue-scan.mjs
step "타입 검사" npx tsc --noEmit
step "린트" npm run lint
if [[ $SKIP_BUILD -eq 0 ]]; then
  step "빌드" npm run build
fi

echo ""
echo "════════════════════════════════"
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "전부 통과."
  exit 0
fi
echo "실패: ${FAILED[*]}"
echo "고치기 전에는 다음 화면으로 넘어가지 않는다."
exit 1
