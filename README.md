# Figma to JSON Schema

피그마의 API 문서 테이블과 JSON Schema/OpenAPI 간 **양방향 변환**을 지원하는 플러그인입니다.

## 주요 기능

- ✅ **Figma → JSON Schema**: 계층형 테이블 구조를 JSON Schema로 변환
- ✅ **JSON Schema → Figma**: JSON Schema를 시각적 테이블 구조로 자동 생성
- ✅ **OpenAPI 지원**: OpenAPI 3.x 문서 생성 및 Import
- ✅ **계층형 테이블**: object/array 타입이 자동으로 별도 테이블로 분리되어 시각화
- ✅ **스타일 자동 적용**: 일관된 디자인 시스템 (색상, 폰트, 레이아웃)

## 설치

### 1. 개발 환경 설정

```bash
npm install
```

### 2. 개발 모드 실행

```bash
npm run dev
```

개발 모드에서는 파일 변경 시 자동으로 재빌드됩니다.

### 3. 프로덕션 빌드

```bash
npm run build
```

### 4. 피그마에서 플러그인 로드

1. Figma Desktop 실행
2. 메뉴: `Plugins` → `Development` → `Import plugin from manifest...`
3. 이 프로젝트의 `manifest.json` 파일 선택
4. 플러그인이 개발 플러그인 목록에 추가됨

## 사용법

### Figma → JSON Schema

#### 1. 테이블 작성 규칙

각 테이블은 독립된 **Frame**으로 작성합니다.

**필수 컬럼:**
- `Field`: 필드명
- `Type`: 타입 (string, number, boolean 또는 커스텀 타입명)

**선택 컬럼:**
- `Required`: 필수 여부 (● 또는 빈 값)
- `Description`: 설명
- `Example`: 예시 값
- `Default`: 기본 값

> 💡 **참고**: 색상은 시각적 표현용이며 파싱에는 영향을 주지 않습니다. 구조(Frame과 컬럼)만 중요합니다.

**예시 - 단일 레벨 테이블:**
```
[GET] /api/user
┌────────────────────────────────────────────────────┐
│ Required │ Field │ Type   │ Description         │ (회색)
├────────────────────────────────────────────────────┤
│ ●        │ id    │ number │ 사용자 ID           │ (노란색)
│ ●        │ name  │ string │ 이름                │
│ ●        │ email │ string │ 이메일              │
└────────────────────────────────────────────────────┘
```

#### 2. 계층 구조 표현 (타입 이름 매칭)

중첩된 객체나 배열은 **별도 테이블**로 작성하고, **타입 이름으로 자동 연결**됩니다.

**예시 - 중첩 구조:**
```
🔵 부모 테이블: User
┌─────────────────────┐
│ Field   │ Type      │
├─────────────────────┤
│ id      │ string    │  ← 기본 타입, 자식 없음
│ profile │ Profile   │  ← 커스텀 타입 → "Profile" 테이블 찾음
│ tags    │ Tag[]     │  ← 배열 타입 → "Tag" 테이블 찾음
└─────────────────────┘

🟢 자식 테이블: Profile
┌─────────────────────┐
│ Field  │ Type       │
├─────────────────────┤
│ name   │ string     │
│ age    │ number     │
└─────────────────────┘

🟢 자식 테이블: Tag
┌─────────────────────┐
│ Field  │ Type       │
├─────────────────────┤
│ label  │ string     │
│ color  │ string     │
└─────────────────────┘
```

**핵심 규칙:**
1. **부모 테이블의 Type 컬럼**에 PascalCase 이름 작성 (예: `Profile`, `Address`)
2. **자식 테이블의 제목(title)**을 같은 이름으로 작성 (예: 테이블 이름을 `Profile`로)
3. 배열 타입은 `[]` 포함 (예: `Tag[]`) - 자식 테이블 이름은 `Tag`
4. **위치는 상관없음** - 테이블이 어디 있든 이름만 일치하면 자동 연결

**타입 구분:**
- ✅ `Profile`, `Address`, `Tag[]` → 자식 테이블 찾음
- ❌ `string`, `number`, `boolean`, `object`, `array` → 기본 타입, 자식 없음

#### 3. 엔드포인트 정보 (선택)

루트 테이블에 엔드포인트 정보를 추가하려면 테이블 제목을 다음 형식으로 작성:
```
[METHOD] /path
```

예시:
- `[GET] /api/users`
- `[POST] /api/users`
- `[PUT] /api/users/{id}`

#### 4. 플러그인 실행

1. 작성한 테이블 프레임(들)을 선택
2. `Plugins` → `Figma to JSON Schema` 실행
3. `Export to JSON Schema` 버튼 클릭
4. 생성된 JSON Schema 복사 또는 다운로드

### JSON Schema → Figma

1. 플러그인 실행
2. `Import from Schema` 탭 선택
3. JSON Schema 또는 OpenAPI 문서 붙여넣기
4. `Generate Tables` 버튼 클릭
5. 위 규칙대로 계층형 테이블 구조가 자동 생성됨

## 테이블 인식 원리

### 1. 루트 테이블 찾기

플러그인은 다음 순서로 루트 테이블을 결정합니다:

1. **엔드포인트 정보가 있는 테이블** (`[GET] /api/users` 형식)
2. 없으면 **가장 왼쪽(x 좌표가 작은) 테이블**

### 2. 자식 테이블 연결 (타입 이름 매칭)

```typescript
// 연결 로직:
부모 테이블 row의 Type → 자식 테이블 Title

예시:
부모: Field=profile, Type=Profile  →  자식: Title=Profile
부모: Field=tags, Type=Tag[]       →  자식: Title=Tag ([] 제거)
```

**매칭 규칙:**
- Type이 **PascalCase로 시작**하면 커스텀 타입으로 간주
- 배열 표기(`[]`)는 자동으로 제거 후 매칭
- 테이블 제목(title)과 **정확히 일치**해야 함 (대소문자 구분)
- **위치는 무관** - 테이블이 어디 있든 이름만 맞으면 연결

**기본 타입 (자식 없음):**
- `string`, `number`, `boolean`, `array`, `object` (소문자)
- 이메일, userId 등 소문자로 시작하는 타입

### 3. 구조 기반 파싱

- **Frame 타입**만 테이블로 인식
- **y 좌표**로 row 순서 결정
- **가장 많은 자식(cell)을 가진 row**를 헤더로 자동 인식
- **x 좌표**로 컬럼 순서 결정
- ⚠️ **색상은 파싱에 영향 없음** (시각적 표현용)

### 디자인 시스템

자동 생성되는 테이블은 다음 스타일이 적용됩니다:

**색상:**
- 헤더: #d30644 (진한 핑크)
- 컬럼 헤더: #d9d9d9 (회색)
- 데이터 행: #F5FBB5 (연한 노란색)

**타이포그래피:**
- 헤더: Inter Semi Bold 12px
- 데이터: Inter Regular 12px
- 정렬: 중앙 정렬
- Line height: 1.3

**레이아웃:**
- 컬럼 너비: Field 120px / Type 120px / Required 120px / Description 220px
- 행 높이: 36px
- 패딩: 좌우 12px, 상하 10px
- 테두리: 검은색 1px (상단/좌측만)

## 프로젝트 구조

```
figma-to-json/
├── src/
│   ├── plugin/                    # 플러그인 메인 로직
│   │   ├── index.ts              # 플러그인 진입점
│   │   ├── parser/               # Figma → Data 변환
│   │   │   ├── tableParser.ts    # 테이블 파싱
│   │   │   ├── hierarchyBuilder.ts  # 계층 구조 생성
│   │   │   └── typeMapper.ts     # 타입 매핑
│   │   ├── generator/            # Data → Figma 변환
│   │   │   ├── tableGenerator.ts # 테이블 구조 생성
│   │   │   └── frameBuilder.ts   # Figma 노드 생성
│   │   ├── schema/               # 스키마 빌더
│   │   │   ├── jsonSchemaBuilder.ts  # JSON Schema 생성
│   │   │   └── openApiBuilder.ts     # OpenAPI 생성
│   │   ├── types/                # 타입 정의
│   │   │   ├── table.ts          # 테이블 타입
│   │   │   ├── schema.ts         # 스키마 타입
│   │   │   └── endpoint.ts       # 엔드포인트 타입
│   │   └── utils/                # 유틸리티
│   │       ├── colorUtils.ts     # 색상 변환
│   │       └── geometryUtils.ts  # 레이아웃 계산
│   └── ui/                       # UI 컴포넌트
│       ├── index.html
│       ├── ui.tsx
│       └── components/
├── dist/                         # 빌드 출력
│   └── code.js
├── manifest.json                 # 플러그인 매니페스트
├── webpack.config.js             # Webpack 설정
├── tsconfig.json                 # TypeScript 설정
└── package.json
```

## 기술 스택

**메인:**
- TypeScript 5.3
- React 18
- Figma Plugin API

**빌드:**
- Webpack 5
- Babel (ES5 호환성 보장)
- html-inline-script-webpack-plugin

**검증:**
- AJV (JSON Schema 검증)
- openapi-types (OpenAPI 타입 정의)

## 개발 가이드

### 빌드 스크립트

```bash
# 개발 모드 (watch)
npm run dev

# 프로덕션 빌드
npm run build

# 타입 체크
npm run type-check

# 린트
npm run lint
```

### 디버깅

1. Figma Desktop에서 플러그인 실행
2. `Plugins` → `Development` → `Open Console` (Cmd/Ctrl + Option + I)
3. Console에서 로그 확인

### Babel 트랜스파일링

이 프로젝트는 Figma 플러그인 샌드박스 환경(Chrome 58 수준)과의 호환성을 위해 Babel을 사용합니다:
- ES2020+ 문법 → ES5 변환
- Optional chaining (`?.`) 변환
- Nullish coalescing (`??`) 변환

## 로드맵

**완료:**
- ✅ 기본 테이블 파싱
- ✅ JSON Schema 생성
- ✅ 역변환 (Schema → Figma)
- ✅ 계층형 테이블 구조
- ✅ 스타일 시스템
- ✅ ES5 호환성

**예정:**
- [ ] Array items 고급 정의 지원
- [ ] Enum 타입 지원
- [ ] Pattern/Format validation
- [ ] 커스텀 필드 추가
- [ ] TypeScript 타입 정의 생성
- [ ] Zod 스키마 생성
- [ ] 일괄 변환 (여러 엔드포인트)
- [ ] 테이블 템플릿 커스터마이징

## 라이센스

MIT
