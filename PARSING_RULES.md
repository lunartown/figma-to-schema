# Figma 테이블 파싱 규칙

## 테이블 인식 조건

테이블로 인식되려면 다음 조건을 **모두** 만족해야 합니다:

### 1. Frame 타입
- 테이블은 **Frame** 노드여야 함
- Section, Group 등은 인식 안 됨

### 2. 색상 헤더 필수
다음 색상 중 하나를 가진 자식 노드가 **반드시** 있어야 함:
- **컬럼 헤더 색**: #d9d9d9 (회색) - RGB(217, 217, 217)
- **섹션 헤더 색**: #d30644 (진한 핑크) - RGB(211, 6, 68)

색상 허용 오차: ±15% (tolerance: 0.15)

### 3. 최소 자식 노드
- 자식 노드가 **3개 이상** 있어야 함
- (제목 + 헤더 + 최소 1개 데이터 row)

## 테이블 구조

### 필수 요소

1. **컬럼 헤더 (회색 배경 #d9d9d9)**
   - 컬럼명: Required, Field, Type, Description
   - 폰트: Inter Semi Bold 12px
   - 중앙 정렬

2. **데이터 행 (노란색 배경 #F5FBB5)**
   - 각 행은 Frame으로 구성
   - 각 셀은 내부 Frame
   - 폰트: Inter Regular 12px
   - 중앙 정렬

### 선택 요소

3. **제목 (진한 핑크 배경 #d30644)** - 선택사항
   - 엔드포인트 형식: `[GET] /api/users`
   - 일반 제목: `UserProfile`
   - 없어도 파싱 가능

## 컬럼 순서

현재 인식되는 컬럼:
1. **Required** (필수 여부) - ● 또는 빈 값
2. **Field** (필드명)
3. **Type** (타입)
4. **Description** (설명) - 선택

## 타입 표기

### 기본 타입 (소문자)
- `string`
- `number`
- `boolean`
- `array`

### 커스텀 타입 (PascalCase)
- `UserProfile` (object)
- `Address` (nested object)

### 배열 타입
- `string[]` (primitive 배열)
- `Permission[]` (object 배열)

## 계층 구조

### object 타입
- 부모 테이블의 `Type`에 `UserProfile` 같은 PascalCase 타입
- 오른쪽에 **별도 테이블** 생성
- 테이블 제목: `UserProfile`

### array 타입
- 부모 테이블의 `Type`에 `Permission[]`
- 오른쪽에 **별도 테이블** 생성
- 테이블 제목: `Permission` ([] 제외)

### 위치 규칙
1. 자식 테이블은 부모 테이블 **오른쪽**에 배치
2. 자식 테이블의 y 좌표는 부모의 해당 row y 좌표와 **같거나 더 낮게**
3. 형의 모든 자손들이 배치된 후 동생 배치

## 파싱이 안 되는 경우

### 1. 색상 불일치
**문제**: 헤더 배경색이 정확하지 않음
**해결**:
- 컬럼 헤더: #d9d9d9
- 데이터 행: #F5FBB5
- 제목: #d30644 (선택)

### 2. Frame이 아닌 다른 타입
**문제**: Group, Section으로 구성
**해결**: Frame으로 변경

### 3. 자식 노드 부족
**문제**: 자식이 3개 미만
**해결**: 최소 헤더 + 1개 데이터 row 필요

### 4. Auto Layout 구조 문제
**문제**: 셀들이 Auto Layout으로 정렬되지 않음
**해결**:
- 각 row는 Horizontal Auto Layout
- 테이블 전체는 Vertical Auto Layout

## 디버깅 방법

### 콘솔 로그 확인
1. 플러그인 실행
2. `Plugins` → `Development` → `Open Console`
3. 다음 로그 확인:
   - `Found X tables in selection`
   - 각 테이블 제목과 row 개수

### 테이블이 인식되지 않을 때
```
// 콘솔에 다음과 같이 출력됨:
Found 0 tables in selection
선택한 영역에서 테이블을 찾을 수 없습니다.
```

**체크리스트**:
- [ ] Frame 타입인가?
- [ ] 회색(#d9d9d9) 헤더가 있는가?
- [ ] 자식 노드가 3개 이상인가?
- [ ] 각 row가 노란색(#F5FBB5) 배경인가?

## 예시 구조

```
테이블 Frame (선택 가능)
├── 제목 Frame (선택) - #d30644
│   └── Text "UserProfile"
├── 헤더 Frame - #d9d9d9
│   ├── Cell "Required"
│   ├── Cell "Field"
│   ├── Cell "Type"
│   └── Cell "Description"
├── 데이터 Row Frame - #F5FBB5
│   ├── Cell "●"
│   ├── Cell "id"
│   ├── Cell "string"
│   └── Cell "사용자 ID"
└── 데이터 Row Frame - #F5FBB5
    ├── Cell ""
    ├── Cell "email"
    ├── Cell "string"
    └── Cell "이메일"
```

## 색상 코드 참고

```typescript
// RGB 0-1 범위
columnHeader: { r: 0.851, g: 0.851, b: 0.851 }  // #d9d9d9
data: { r: 0.961, g: 0.984, b: 0.710 }          // #F5FBB5
header: { r: 0.827, g: 0.024, b: 0.267 }        // #d30644
```

## 컬럼 너비 기본값

```typescript
Required: 80px
Field: 140px
Type: 100px
Description: 260px
총 너비: 580px
```
