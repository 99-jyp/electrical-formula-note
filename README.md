# 전기 공식 노트

전기(산업)기사 공식 정리·계산·암기 데스크톱 앱 (Tauri 2 + React + TypeScript + SQLite).

## 기술 스택
- UI: React 18, Vite, TypeScript
- 수식: MathLive(시각 편집) + LaTeX 직접 입력, KaTeX 렌더링
- 계산: mathjs
- 데스크톱: Tauri 2 (Rust), `tauri-plugin-sql` (SQLite)
- 브라우저 개발 모드에서는 localStorage로 자동 대체

## 기능
- 분류/태그/즐겨찾기/검색, 공식 CRUD
- 변수 입력 기반 공식 계산기
- 라이트너(5박스) 암기 퀴즈

## DB 스키마
`categories`, `formulas`, `variables`, `tags`, `formula_tags`, `reviews` (`src-tauri/src/lib.rs`의 마이그레이션).

## 실행
```
npm install
npm run dev          # 브라우저 개발 (localStorage)
npx tauri icon <1024x1024.png>   # 최초 1회 아이콘 생성
npm run tauri:dev    # 데스크톱 (Rust 필요)
npm run tauri:build
```
