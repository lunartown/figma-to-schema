# Architecture

## 개요

Figma의 API 문서 테이블과 JSON Schema/OpenAPI 간 **양방향 변환**을 지원하는 플러그인입니다.

## 핵심 컨셉

### 1. 테이블 구조

피그마 문서의 테이블 구조:

```
┌─────────────────────────────────────────────┐
│ [GET] /stroller/products                    │  ← 엔드포인트 제목
├─────────────────────────────────────────────┤
│ Request │ Response                          │  ← 섹션 헤더 (분홍색)
├─────┬───────┬──────┬──────────┬────────────┤
│Depth│ Field │ Type │ Required │Description │  ← 컬럼 헤더 (검정색)
├─────┼───────┼──────┼──────────┼────────────┤
│  0  │ user  │object│   true   │ 사용자     │  ← 데이터 (노란색)
│  1  │ name  │string│   true   │ 이름       │
│  1  │ age   │number│   false  │ 나이       │
└─────┴───────┴──────┴──────────┴────────────┘
```

### 2. Depth 기반 계층 구조

Depth는 중첩된 객체/배열의 깊이를 나타냅니다:

```typescript
// Depth 0: 최상위
// Depth 1: 1단계 중첩
// Depth 2: 2단계 중첩

// 예시:
0 | user        | object | ...  → { user: { ... } }
1 | name        | string | ...  →   { name: "..." }
1 | address     | object | ...  →   { address: { ... } }
2 | city        | string | ...  →     { city: "..." }
```

## 변환 플로우

### Figma → JSON Schema

```
1. [tableParser] 피그마 테이블 노드 감지
   ↓
2. [endpointExtractor] 엔드포인트 정보 추출 (Method, Path)
   ↓
3. [tableParser] 섹션별(Request/Response) 행 파싱
   ↓
4. [depthResolver] Depth 기반 계층 구조 복원
   ↓
5. [typeMapper] 피그마 Type → JSON Schema 타입
   ↓
6. [schemaBuilder] JSON Schema / OpenAPI 생성
   ↓
7. [validator] 스키마 검증
```

### JSON Schema → Figma

```
1. [schemaParser] JSON Schema / OpenAPI 파싱
   ↓
2. [depthCalculator] 중첩 구조를 Depth로 평탄화
   ↓
3. [tableGenerator] ApiTable 데이터 생성
   ↓
4. [frameBuilder] 피그마 Frame/Table 노드 생성
   ↓
5. [styleApplier] 색상, 레이아웃 적용
```

## 주요 모듈

### Parser (Figma → Data)

#### `tableParser.ts`
- 피그마의 Frame/Table 노드를 감지
- 행/열 구조를 파싱해서 `TableRow[]` 추출
- 색상 기반으로 헤더/데이터 구분

```typescript
function parseTable(node: FrameNode): ApiTable {
  // 1. 제목에서 Method, Path 추출
  // 2. 섹션 헤더 감지 (Request/Response)
  // 3. 각 행을 TableRow로 변환
}
```

#### `depthResolver.ts`
- `TableRow[]`를 계층 구조로 변환
- Depth 값을 기반으로 부모-자식 관계 설정

```typescript
function resolveDepth(rows: TableRow[]): DepthField[] {
  // Depth 0, 1, 2... 를 보고 중첩 구조 복원
  // 예: Depth 2는 Depth 1의 자식
}
```

#### `typeMapper.ts`
- 피그마 Type 컬럼 값 → JSON Schema 타입
- `string`, `number`, `object`, `array`, `boolean`

```typescript
const TYPE_MAP = {
  'string': 'string',
  'number': 'number',
  'integer': 'integer',
  'boolean': 'boolean',
  'object': 'object',
  'array': 'array',
  'date': { type: 'string', format: 'date-time' },
  // ...
};
```

### Generator (Schema → Figma)

#### `tableGenerator.ts`
- JSON Schema를 평탄화해서 `ApiTable` 생성

```typescript
function generateTable(schema: JsonSchema, section: 'request' | 'response'): TableSection {
  // 중첩된 properties를 재귀적으로 순회하며 Depth 계산
  // TableRow[] 생성
}
```

#### `frameBuilder.ts`
- `ApiTable`을 실제 피그마 노드로 생성
- Frame, Text, Rectangle 노드 조합

```typescript
function buildTableFrame(table: ApiTable): FrameNode {
  // 1. 제목 생성
  // 2. 헤더 행 생성
  // 3. 데이터 행 생성
  // 4. 레이아웃 조정
}
```

#### `styleApplier.ts`
- 색상, 폰트, 정렬 등 스타일 적용

```typescript
const DEFAULT_COLORS = {
  header: { r: 1, g: 0.6, b: 0.7 },      // 분홍
  subHeader: { r: 0, g: 0, b: 0 },       // 검정
  data: { r: 1, g: 1, b: 0.8 }           // 노란색
};
```

### Schema Builder

#### `jsonSchemaBuilder.ts`
- `ApiEndpoint` → JSON Schema

```typescript
function buildJsonSchema(endpoint: ApiEndpoint): JsonSchema {
  // properties, required, type 등 생성
}
```

#### `openApiBuilder.ts`
- `ApiEndpoint[]` → OpenAPI 3.x 문서

```typescript
function buildOpenApiDoc(endpoints: ApiEndpoint[]): OpenApiDocument {
  // paths, components, info 등 생성
}
```

## 템플릿 시스템

### 템플릿 구조

```json
{
  "name": "API Endpoint Template",
  "columns": ["Depth", "Field", "Type", "Required", "Description"],
  "depthStyle": "number",
  "colorScheme": {
    "header": { "r": 1, "g": 0.6, "b": 0.7 },
    "subHeader": { "r": 0, "g": 0, "b": 0 },
    "data": { "r": 1, "g": 1, "b": 0.8 }
  },
  "sections": ["Request", "Response"]
}
```

### 사용자 정의 가능

- 컬럼 추가/제거 (예: Example, Format, Constraints)
- 색상 변경
- Depth 표현 방식 (숫자 / 들여쓰기 / 점 표기법)

## UI 구성

### ConversionPanel
- 변환 방향 선택 (Figma→Schema / Schema→Figma)
- Export 옵션 설정

### SchemaPreview
- 생성된 JSON Schema / OpenAPI 미리보기
- 다운로드 버튼

### TablePreview
- 생성될 테이블 구조 미리보기

## 예제

### 입력 (Figma Table)

```
[POST] /users

Request
Depth | Field    | Type   | Required | Description
0     | name     | string | true     | 사용자 이름
0     | email    | string | true     | 이메일
0     | address  | object | false    | 주소
1     | city     | string | true     | 도시
1     | zipcode  | string | false    | 우편번호
```

### 출력 (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "사용자 이름"
    },
    "email": {
      "type": "string",
      "description": "이메일"
    },
    "address": {
      "type": "object",
      "description": "주소",
      "properties": {
        "city": {
          "type": "string",
          "description": "도시"
        },
        "zipcode": {
          "type": "string",
          "description": "우편번호"
        }
      },
      "required": ["city"]
    }
  },
  "required": ["name", "email"]
}
```

## 확장 가능성

### 지원할 추가 기능
- [ ] Array 타입 상세 처리 (`items` 정의)
- [ ] Enum 지원
- [ ] Pattern/Format validation
- [ ] oneOf, anyOf, allOf 복합 스키마
- [ ] TypeScript 타입 정의 생성
- [ ] Zod 스키마 생성
- [ ] 여러 엔드포인트 일괄 변환

## 참고

- [JSON Schema Draft 7](https://json-schema.org/draft-07/schema)
- [OpenAPI 3.x](https://spec.openapis.org/oas/v3.1.0)
- [Figma Plugin API](https://www.figma.com/plugin-docs/)
