import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 안드로이드 앱(Capacitor) 쪽. Gradle 이 만드는 산출물에 Capacitor 의 native-bridge.js 가
    // 복사돼 들어오는데, 우리 코드가 아니라 린트할 이유가 없다(경고 16건이 여기서 났다).
    "android/**",
    // 서버에 못 닿았을 때만 보이는 정적 안전망 한 장. 번들에 안 들어간다.
    "capacitor-shell/**",
  ]),
]);

export default eslintConfig;
