# Figma 테이블 파싱 규칙

## 개요

이 플러그인은 **구조 기반 + 타입 이름 매칭** 방식으로 테이블을 인식합니다.
색상은 시각적 표현용이며 파싱에는 영향을 주지 않습니다.

---

## 1. 테이블 기본 조건

테이블로 인식되려면:

✅ **Frame 타입**이어야 함
✅ **자식 노드 2개 이상** (헤더 + 최소 1개 데이터 row)
✅ Frame 이름이 다음으로 시작하지 않아야 함:
- `Row:`, `.Row`
- `Header Row`, `Cell`
- `row ` 또는 `row`

---

## 2. 루트 테이블 식별

플러그인은 다음 순서로 루트 테이블을 찾습니다:

### 우선순위 1: 엔드포인트 정보

테이블 제목(title)에 `[METHOD] /path` 패턴이 있으면 **루트 테이블**

```
예시:
[GET] /api/users          ← 루트
[POST] /api/users         ← 루트
[PUT] /api/users/{id}     ← 루트
```

### 우선순위 2: 가장 왼쪽 테이블

엔드포인트 정보가 없으면 **x 좌표가 가장 작은** 테이블을 루트로 선택

```
테이블 A (x=100)   ← 루트
테이블 B (x=500)
테이블 C (x=900)
```

---

## 3. 계층 구조: 타입 이름 매칭

### 핵심 원리

```
부모 테이블의 Type 컬럼 값 = 자식 테이블의 Title (제목)
```

### 예시

```typescript
// 부모 테이블: User
┌──────────────────┐
│ Field  │ Type    │
├──────────────────┤
│ id     │ string  │  ← 기본 타입 (자식 없음)
│ profile│ Profile │  ← 커스텀 타입 → "Profile" 테이블 찾음
│ tags   │ Tag[]   │  ← 배열 → "Tag" 테이블 찾음 ([] 제거)
└──────────────────┘

// 자식 테이블: Profile (title = "Profile")
┌──────────────────┐
│ Field │ Type     │
├──────────────────┤
│ name  │ string   │
│ age   │ number   │
└──────────────────┘

// 자식 테이블: Tag (title = "Tag")
┌──────────────────┐
│ Field │ Type     │
├──────────────────┤
│ label │ string   │
│ color │ string   │
└──────────────────┘
```

### Expandable 타입 (자식을 가질 수 있는 타입)

플러그인이 자식 테이블을 찾는 타입:

✅ **PascalCase로 시작**하는 타입
- `UserProfile`
- `Address`
- `Permission`
- `ProductDetail`

✅ **배열 표기** (`[]` 포함)
- `Profile[]`
- `Tag[]`
- `Item[]`

❌ **기본 타입** (자식 찾지 않음)
- `string`, `number`, `boolean`, `array`, `object`
- 소문자로 시작: `email`, `userId`, `dateTime`

### 매칭 규칙 상세

| 부모 Type | 자식 Title | 연결 여부 |
|----------|-----------|---------|
| `Profile` | `Profile` | ✅ 연결 |
| `Profile[]` | `Profile` | ✅ 연결 ([] 제거) |
| `UserProfile` | `UserProfile` | ✅ 연결 |
| `profile` | `profile` | ❌ 소문자 (기본 타입) |
| `Profile` | `profile` | ❌ 대소문자 불일치 |
| `string` | `string` | ❌ 기본 타입 |

### 중요 사항

⚠️ **대소문자 정확히 일치해야 함**
- `Profile` ≠ `profile`
- `UserProfile` ≠ `userProfile`

⚠️ **테이블 위치는 무관**
- 오른쪽, 왼쪽, 위, 아래 어디든 상관없음
- 이름만 일치하면 자동 연결

⚠️ **순환 참조 방지**
- 자기 자신은 자식으로 연결 안 됨

---

## 4. 테이블 구조 파싱

### 컬럼 헤더 인식

- **가장 많은 자식(cell)을 가진 row**를 헤더로 자동 인식
- Title Frame은 제외
- y 좌표가 작은 순서로 검사

```
Frame (테이블)
├── Title Frame (1개 자식) ← 무시
├── Header Row (4개 자식)  ← 헤더로 선택
├── Data Row 1 (4개 자식)
└── Data Row 2 (4개 자식)
```

### 데이터 행 파싱

- y 좌표로 정렬하여 위에서 아래로 파싱
- 헤더 row는 제외
- 각 row의 cell을 x 좌표로 정렬하여 컬럼 매칭

```
Row (y=100)
├── Cell (x=0)   → Required 컬럼
├── Cell (x=80)  → Field 컬럼
├── Cell (x=220) → Type 컬럼
└── Cell (x=320) → Description 컬럼
```

---

## 5. 컬럼 매핑

### 인식 가능한 컬럼 이름

플러그인은 다음 컬럼을 인식합니다 (대소문자 무관):

| 컬럼 이름 | 별칭 | 필수 여부 |
|----------|------|---------|
| `Field` | `field` | ✅ 필수 |
| `Type` | `type` | ✅ 필수 |
| `Required` | `required` | 선택 |
| `Description` | `description` | 선택 |
| `Example` | `example` | 선택 |
| `Default` | `default` | 선택 |

### Required 값 파싱

다음 값들이 `true`로 인식됩니다:

- `●` (검은 점)
- `true`, `True`, `TRUE`
- `yes`, `Yes`, `YES`
- `o`, `O`
- `✓`, `☑`

빈 값 또는 다른 값은 `false`

---

## 6. 엔드포인트 정보 추출

### 패턴

```regex
\[(\w+)\]\s+(\/[^\s]*)
```

### 예시

| 입력 | Method | Path |
|------|--------|------|
| `[GET] /api/users` | `GET` | `/api/users` |
| `[POST] /api/users` | `POST` | `/api/users` |
| `[PUT] /api/users/{id}` | `PUT` | `/api/users/{id}` |
| `[DELETE] /api/users/{id}` | `DELETE` | `/api/users/{id}` |

---

## 7. 디버깅 가이드

### 테이블이 인식되지 않을 때

체크리스트:

- [ ] Frame 타입인가?
- [ ] 자식 노드가 2개 이상인가?
- [ ] Frame 이름이 "Row:", "Cell" 등으로 시작하지 않는가?
- [ ] Field와 Type 컬럼이 있는가?

### 자식 테이블이 연결되지 않을 때

체크리스트:

- [ ] 부모 Type이 PascalCase로 시작하는가?
- [ ] 자식 테이블의 Title(제목)이 정확히 일치하는가?
- [ ] 대소문자가 일치하는가?
- [ ] 자식 테이블도 Frame 타입인가?

### 콘솔 로그 확인

```
Plugins → Development → Open Console (Cmd+Option+I)

로그 예시:
Found 3 tables in selection
- User (5 rows)
- Profile (3 rows)
- Tag (2 rows)
```

---

## 8. 예시: 전체 구조

```
테이블 구조:

📦 User (title="[GET] /api/users")  ← 루트 (endpoint 있음)
├── id: string
├── name: string
├── profile: Profile  ← "Profile" 테이블 찾음
└── tags: Tag[]       ← "Tag" 테이블 찾음

📦 Profile (title="Profile")
├── firstName: string
├── lastName: string
└── address: Address  ← "Address" 테이블 찾음

📦 Address (title="Address")
├── city: string
└── country: string

📦 Tag (title="Tag")
├── label: string
└── color: string
```

**생성되는 JSON Schema:**

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "profile": {
      "type": "object",
      "properties": {
        "firstName": { "type": "string" },
        "lastName": { "type": "string" },
        "address": {
          "type": "object",
          "properties": {
            "city": { "type": "string" },
            "country": { "type": "string" }
          }
        }
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": { "type": "string" },
          "color": { "type": "string" }
        }
      }
    }
  }
}
```

---

## 요약

1. ✅ **루트 테이블**: 엔드포인트 있거나 가장 왼쪽
2. ✅ **자식 연결**: 타입 이름(PascalCase) = 테이블 제목
3. ✅ **구조 파싱**: y/x 좌표 기반, 색상 무관
4. ✅ **배열 처리**: `Tag[]` → `Tag` 테이블 찾음
5. ✅ **위치 무관**: 테이블이 어디 있든 이름만 맞으면 OK
