# /consulting — 자문 서비스 관리 앱

자문 서비스 관리 앱(consulting.html) 관련 작업을 수행합니다.
CLAUDE.md의 전체 컨텍스트를 참고하세요.

## 핵심 파일
- **파일**: `consulting.html` (단일 파일, Vanilla JS)
- **배포 URL**: https://sgspeed04.github.io/Tracker/consulting.html
- **Supabase**: https://fbctahxjzwwzuscjvaxg.supabase.co
- **테이블**: `cm_clients`, `cm_sessions`

## 앱 구조
```
consulting.html
├── CSS (스타일, 반응형)
├── HTML (사이드바, 모달, 컨텐츠 영역)
└── JavaScript
    ├── State & Storage (localStorage + Supabase)
    ├── 대시보드 렌더링 (renderDashboard)
    ├── 클라이언트 CRUD (renderClients, saveClient, deleteClient)
    ├── 자문 CRUD (renderSessions, saveSession, deleteSession)
    ├── 수입 통계 (renderIncome)
    └── 설정 (renderSettings, Supabase 연동)
```

## 자주 요청되는 작업
- 새 기능 추가 → consulting.html 수정 후 push
- 플랫폼 옵션 추가/변경 → select 태그 option 수정
- 통계 항목 추가 → renderIncome() 함수 수정
- 이메일 템플릿 수정 → openEmailModal() 함수 수정
- UI 색상/레이아웃 변경 → CSS :root 변수 수정

## 작업 완료 후 반드시
```bash
git add consulting.html
git commit -m "변경 내용 요약"
git push origin main
```
