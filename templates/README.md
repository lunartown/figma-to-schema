# 템플릿 가이드

## 기본 템플릿 구조

피그마에서 API 문서 테이블을 작성할 때 따라야 할 규칙입니다.

## 1. 엔드포인트 제목

```
[METHOD] /path/to/endpoint
```

**형식:**
- `[GET]`, `[POST]`, `[PUT]`, `[PATCH]`, `[DELETE]` 등 HTTP 메서드
- 공백 후 엔드포인트 경로

**예시:**
```
[GET] /stroller/products
[POST] /users/{userId}/orders
[DELETE] /cart/items/{itemId}
```

## 2. 섹션 헤더

Request와 Response를 구분하는 헤더를 작성합니다.

```
┌─────────────────────────┐
│ Request │ Response      │  ← 섹션 헤더
└─────────────────────────┘
```

**규칙:**
- 분홍색 배경 (`#FF99B3` 또는 RGB: 1, 0.6, 0.7)
- 흰색 텍스트
- Bold 폰트

## 3. 컬럼 헤더

데이터 테이블의 컬럼명을 정의합니다.

```
┌──────┬───────┬──────┬──────────┬─────────────┐
│Depth │ Field │ Type │ Required │ Description │  ← 컬럼 헤더
└──────┴───────┴──────┴──────────┴─────────────┘
```

**기본 컬럼:**
- **Depth**: 중첩 깊이 (0, 1, 2...)
- **Field**: 필드명
- **Type**: 데이터 타입
- **Required**: 필수 여부 (true/false)
- **Description**: 설명

**스타일:**
- 검은색 배경 (`#000000`)
- 흰색 텍스트
- Bold 폰트

## 4. 데이터 행

실제 필드 정보를 작성합니다.

```
┌──────┬───────────┬────────┬──────────┬──────────────────┐
│  0   │ productId │ number │   true   │ 상품 ID          │
│  0   │ name      │ string │   true   │ 상품명           │
│  0   │ options   │ array  │   false  │ 옵션 목록        │
│  1   │ optionId  │ number │   true   │ 옵션 ID          │
│  1   │ label     │ string │   true   │ 옵션명           │
└──────┴───────────┴────────┴──────────┴──────────────────┘
```

**스타일:**
- 노란색 배경 (`#FFFFCC` 또는 RGB: 1, 1, 0.8)
- 검은색 텍스트

## 5. Depth 규칙

Depth는 중첩된 객체/배열의 깊이를 나타냅니다.

### 객체 (Object)

```
Depth | Field   | Type
0     | user    | object    ← 최상위 객체
1     | name    | string    ← user의 자식
1     | email   | string    ← user의 자식
```

**JSON 결과:**
```json
{
  "user": {
    "name": "...",
    "email": "..."
  }
}
```

### 배열 (Array)

```
Depth | Field    | Type
0     | products | array     ← 배열
1     | id       | number    ← 배열 아이템의 속성
1     | name     | string    ← 배열 아이템의 속성
```

**JSON 결과:**
```json
{
  "products": [
    {
      "id": 123,
      "name": "..."
    }
  ]
}
```

### 깊은 중첩

```
Depth | Field       | Type
0     | order       | object
1     | customer    | object    ← order의 자식
2     | name        | string    ← customer의 자식
2     | address     | object    ← customer의 자식
3     | city        | string    ← address의 자식
```

**JSON 결과:**
```json
{
  "order": {
    "customer": {
      "name": "...",
      "address": {
        "city": "..."
      }
    }
  }
}
```

## 6. Type 값

지원하는 타입:

| 피그마 Type | JSON Schema Type | 설명 |
|------------|------------------|------|
| `string` | `string` | 문자열 |
| `number` | `number` | 숫자 (정수, 소수) |
| `integer` | `integer` | 정수 |
| `boolean` | `boolean` | true/false |
| `object` | `object` | 객체 |
| `array` | `array` | 배열 |
| `date` | `string` (format: date-time) | 날짜/시간 |
| `email` | `string` (format: email) | 이메일 |
| `uri` | `string` (format: uri) | URL |

**추가 타입 (계획):**
- `enum` - 열거형
- `null` - null 값

## 7. Required 값

필수 여부를 나타냅니다:
- `true` 또는 `Yes` 또는 `O` → required
- `false` 또는 `No` 또는 `X` → optional

## 8. 예제 섹션 (선택사항)

테이블 하단에 실제 JSON 예제를 추가할 수 있습니다.

```
example

{
  "productId": 123,
  "name": "Sample Product",
  "options": [
    {
      "optionId": 1,
      "label": "Color"
    }
  ]
}
```

## 전체 예시

```
[GET] /stroller/products

Request
Depth | Field  | Type   | Required | Description
0     | limit  | number | false    | 페이지 크기 (기본값: 20)
0     | offset | number | false    | 오프셋 (기본값: 0)
0     | filter | object | false    | 필터 조건
1     | brand  | string | false    | 브랜드명

Response
Depth | Field       | Type    | Required | Description
0     | products    | array   | true     | 상품 목록
1     | id          | number  | true     | 상품 ID
1     | name        | string  | true     | 상품명
1     | price       | number  | true     | 가격
1     | description | string  | false    | 설명
0     | total       | number  | true     | 전체 개수
0     | hasMore     | boolean | true     | 다음 페이지 존재 여부
```

## 커스터마이징

### 컬럼 추가

기본 컬럼 외에 추가 컬럼을 사용할 수 있습니다:

```
Depth | Field | Type | Required | Description | Example | Format
0     | email | string | true | 이메일 | user@example.com | email
```

### 색상 변경

`TableConfig`에서 색상을 변경할 수 있습니다:

```typescript
const customColorScheme = {
  header: { r: 0.2, g: 0.4, b: 0.8 },      // 파란색
  subHeader: { r: 0.3, g: 0.3, b: 0.3 },   // 회색
  data: { r: 0.95, g: 0.95, b: 1 }         // 연한 파란색
};
```

## 주의사항

1. **Depth 순서**: Depth가 증가하는 순서로 작성 (0 → 1 → 2)
2. **부모 필드**: Depth N+1 필드는 바로 위의 Depth N 필드의 자식
3. **배열 타입**: 배열의 아이템 타입은 바로 다음 행(Depth +1)에 정의
4. **색상 일관성**: 헤더/데이터 색상을 일관되게 유지

## 문제 해결

### 파싱이 안 될 때

1. 컬럼 이름 확인 (대소문자 정확히)
2. 색상이 템플릿과 일치하는지 확인
3. Depth 값이 숫자인지 확인
4. 엔드포인트 제목 형식 확인

### 중첩 구조가 이상할 때

- Depth 값이 순차적인지 확인
- 부모-자식 관계가 올바른지 확인
