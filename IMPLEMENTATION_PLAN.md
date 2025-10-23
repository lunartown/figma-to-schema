# 구현 계획

## 개요

피그마 API 테이블 ↔ JSON Schema/OpenAPI 양방향 변환 플러그인 구현

## 구현 우선순위

### Phase 1: 핵심 파싱 로직 (Figma → Data)
**목표**: 피그마 테이블을 데이터 구조로 변환

### Phase 2: 스키마 생성 (Data → Schema)
**목표**: 파싱된 데이터를 JSON Schema/OpenAPI로 변환

### Phase 3: 역변환 (Schema → Figma)
**목표**: 스키마를 다시 피그마 테이블로 생성

### Phase 4: UI 및 통합
**목표**: 사용자 인터페이스 구현 및 전체 통합

---

## Phase 1: 핵심 파싱 로직 (3-4일)

### 1.1 테이블 구조 감지 (`tableParser.ts`)

**목표**: 피그마 Frame/Table 노드에서 행/열 구조 추출

```typescript
// 구현할 함수들
function isApiTable(node: SceneNode): boolean
function extractTitle(node: FrameNode): { method: string; path: string }
function detectSections(node: FrameNode): SectionInfo[]
function parseRows(sectionNode: SceneNode): TableRow[]
```

**구현 세부사항**:

1. **테이블 노드 감지**
   - Frame 노드의 자식 중 Text 노드를 찾아 제목 확인
   - 정규식으로 `[METHOD] /path` 패턴 매칭
   - 제목이 있으면 API 테이블로 간주

2. **섹션 감지** (Request/Response)
   - 분홍색 배경(`r: 1, g: 0.6, b: 0.7` 범위) 노드 찾기
   - 섹션 헤더 텍스트 추출
   - 각 섹션의 영역(y 좌표 범위) 계산

3. **컬럼 헤더 파싱**
   - 검은색 배경(`r: 0, g: 0, b: 0` 범위) 노드 찾기
   - 각 컬럼의 이름과 x 좌표 위치 저장
   - 컬럼 순서: Depth, Field, Type, Required, Description

4. **데이터 행 파싱**
   - 노란색 배경(`r: 1, g: 1, b: 0.8` 범위) 노드들 찾기
   - y 좌표 기준으로 행 그룹화
   - x 좌표와 컬럼 매핑해서 각 셀 값 추출
   - TableRow 객체 생성

**예상 난이도**: 중
**리스크**:
- 피그마 레이아웃이 다양할 수 있음 (Auto Layout vs Manual)
- 색상 값이 정확히 일치하지 않을 수 있음 (허용 범위 필요)

---

### 1.2 Depth 기반 계층 복원 (`depthResolver.ts`)

**목표**: Depth 값을 기반으로 평탄화된 행을 트리 구조로 변환

```typescript
function resolveHierarchy(rows: TableRow[]): DepthField[]
function buildPropertyTree(fields: DepthField[]): ApiSchema
```

**알고리즘**:

```
1. Stack을 사용한 부모-자식 관계 구축
   - Depth 0: 스택 초기화, 루트 필드
   - Depth N: 스택에서 Depth N-1인 부모 찾기
   - 현재 필드를 부모의 children에 추가

2. 경로 생성
   - 각 필드의 전체 경로 계산 (예: ['user', 'address', 'city'])

3. ApiSchema 생성
   - 재귀적으로 properties 구축
   - type이 'object'면 children을 properties로 변환
   - type이 'array'면 children을 items로 변환
```

**예시**:
```
Input:
  Depth 0: user (object)
  Depth 1: name (string)
  Depth 1: address (object)
  Depth 2: city (string)

Output:
  {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: {
            type: 'object',
            properties: {
              city: { type: 'string' }
            }
          }
        }
      }
    }
  }
```

**예상 난이도**: 중
**리스크**:
- Depth 값이 비순차적일 경우 (0 → 2로 건너뛰기)
- Array 타입 처리 복잡도

---

### 1.3 타입 매핑 (`typeMapper.ts`)

**목표**: 피그마 Type 컬럼 값을 JSON Schema 타입으로 변환

```typescript
const TYPE_MAPPING: Record<string, JsonSchemaType | { type: string; format?: string }> = {
  'string': { type: 'string' },
  'number': { type: 'number' },
  'integer': { type: 'integer' },
  'boolean': { type: 'boolean' },
  'object': { type: 'object' },
  'array': { type: 'array' },
  'date': { type: 'string', format: 'date-time' },
  'email': { type: 'string', format: 'email' },
  'uri': { type: 'string', format: 'uri' },
  'url': { type: 'string', format: 'uri' },
};

function mapType(figmaType: string): { type: string; format?: string }
function parseRequiredValue(value: string): boolean
```

**구현 세부사항**:
- 대소문자 무시 (`toLowerCase()`)
- 알 수 없는 타입은 'string'으로 폴백
- Required 컬럼: `true`, `yes`, `o`, `✓` → true

**예상 난이도**: 쉬움

---

## Phase 2: 스키마 생성 (2-3일)

### 2.1 JSON Schema Builder (`jsonSchemaBuilder.ts`)

**목표**: ApiEndpoint → JSON Schema Draft-07

```typescript
function buildJsonSchema(endpoint: ApiEndpoint, section: 'request' | 'response'): JsonSchema
function buildSchema(apiSchema: ApiSchema): JsonSchema
```

**생성 로직**:
```
1. 기본 구조 생성
   {
     "$schema": "http://json-schema.org/draft-07/schema#",
     "type": "object",
     "properties": {},
     "required": []
   }

2. properties 재귀 생성
   - ApiSchema.properties를 순회
   - 각 property를 JsonSchema로 변환
   - nested object는 재귀 호출

3. required 배열 생성
   - required: true인 필드명만 추출

4. description, example 등 메타데이터 추가
```

**예상 난이도**: 중

---

### 2.2 OpenAPI Builder (`openApiBuilder.ts`)

**목표**: ApiEndpoint[] → OpenAPI 3.x 문서

```typescript
function buildOpenApiDocument(endpoints: ApiEndpoint[], options?: OpenApiOptions): OpenApiDocument
```

**생성 구조**:
```yaml
openapi: 3.0.0
info:
  title: API Documentation
  version: 1.0.0
paths:
  /stroller/products:
    get:
      summary: ...
      requestBody: (POST인 경우)
        content:
          application/json:
            schema: { ... }
      responses:
        '200':
          content:
            application/json:
              schema: { ... }
```

**구현 순서**:
1. 기본 info, servers 설정
2. endpoints를 paths로 변환
3. requestBody (POST/PUT/PATCH)
4. responses (200, 400, 500 등)
5. examples 추가

**예상 난이도**: 중-상
**리스크**: OpenAPI 스펙 복잡도

---

### 2.3 검증 (`validator.ts`)

**목표**: 생성된 스키마의 유효성 검증

```typescript
function validateJsonSchema(schema: JsonSchema): ValidationResult
function validateOpenApi(doc: OpenApiDocument): ValidationResult
```

**검증 항목**:
- JSON Schema: ajv 라이브러리 사용
- OpenAPI: openapi-types 타입 체크
- 순환 참조 감지
- 필수 필드 누락 확인

**예상 난이도**: 쉬움

---

## Phase 3: 역변환 (Schema → Figma) (3-4일)

### 3.1 스키마 파싱 및 평탄화 (`tableGenerator.ts`)

**목표**: JSON Schema → ApiTable (평탄화된 구조)

```typescript
function generateTableFromSchema(schema: JsonSchema, section: 'request' | 'response'): TableSection
function flattenSchema(schema: JsonSchema, currentDepth: number, parentPath: string[]): TableRow[]
```

**평탄화 알고리즘**:
```
1. 재귀적으로 properties 순회
2. 현재 depth 추적
3. 각 property를 TableRow로 변환
   - field: property 이름
   - type: schema.type
   - required: required 배열에 포함 여부
   - description: schema.description
   - depth: 현재 depth 값

4. object인 경우:
   - 자신의 row 추가 (type: object)
   - children을 depth+1로 재귀 처리

5. array인 경우:
   - 자신의 row 추가 (type: array)
   - items를 depth+1로 재귀 처리
```

**예상 난이도**: 중

---

### 3.2 피그마 노드 생성 (`frameBuilder.ts`)

**목표**: ApiTable → 실제 Figma 노드 생성

```typescript
function buildTableFrame(table: ApiTable, config: TableConfig): FrameNode
function createTitleText(method: string, path: string): TextNode
function createSectionHeader(title: string, width: number): FrameNode
function createDataRow(row: TableRow, columns: TableColumn[], y: number): FrameNode
```

**생성 순서**:
1. **메인 Frame 생성**
   - Auto Layout (Vertical)
   - Padding: 20px

2. **제목 생성**
   - Text 노드: `[METHOD] /path`
   - 크기: 24px, Bold

3. **섹션별 테이블 생성**
   - 섹션 헤더 (Request/Response)
   - 컬럼 헤더 행
   - 데이터 행들

4. **테이블 레이아웃**
   - 각 컬럼 너비 계산 (텍스트 길이 기반)
   - 행 높이: 고정 32px
   - Grid 정렬

**예상 난이도**: 상
**리스크**: 피그마 레이아웃 API 복잡도

---

### 3.3 스타일 적용 (`styleApplier.ts`)

**목표**: 색상, 폰트, 정렬 등 스타일 적용

```typescript
function applyTableStyles(frame: FrameNode, config: TableConfig): void
function applyHeaderStyle(node: SceneNode): void
function applyDataStyle(node: SceneNode): void
```

**스타일 정의**:
```typescript
const DEFAULT_STYLES = {
  header: {
    fill: { r: 1, g: 0.6, b: 0.7 },
    textColor: { r: 1, g: 1, b: 1 },
    fontSize: 14,
    fontWeight: 700,
  },
  subHeader: {
    fill: { r: 0, g: 0, b: 0 },
    textColor: { r: 1, g: 1, b: 1 },
    fontSize: 12,
    fontWeight: 700,
  },
  data: {
    fill: { r: 1, g: 1, b: 0.8 },
    textColor: { r: 0, g: 0, b: 0 },
    fontSize: 11,
    fontWeight: 400,
  },
};
```

**예상 난이도**: 중

---

## Phase 4: UI 및 통합 (2-3일)

### 4.1 플러그인 메인 (`plugin/index.ts`)

**목표**: 플러그인 엔트리포인트 및 UI 통신

```typescript
figma.showUI(__html__, { width: 500, height: 600 });

figma.ui.onmessage = (msg) => {
  switch (msg.type) {
    case 'parse-table':
      // 선택된 노드 파싱
      break;
    case 'generate-schema':
      // JSON Schema 생성
      break;
    case 'import-schema':
      // Schema로부터 테이블 생성
      break;
  }
};
```

**메시지 타입**:
- `parse-table`: 선택된 테이블 파싱 요청
- `generate-schema`: 스키마 생성 요청
- `import-schema`: 스키마 import 요청
- `export-result`: 결과 전달

**예상 난이도**: 쉬움

---

### 4.2 UI 컴포넌트 (`ui/`)

**목표**: 사용자 인터페이스 구현

**컴포넌트 구조**:
```tsx
<App>
  <ConversionPanel>
    <TabSelector value="figma-to-schema" />

    {mode === 'figma-to-schema' ? (
      <>
        <Button onClick={parseSelection}>Parse Selected Table</Button>
        <SchemaPreview schema={result} />
        <ExportOptions format={format} />
      </>
    ) : (
      <>
        <TextArea placeholder="Paste JSON Schema here" />
        <Button onClick={importSchema}>Import to Figma</Button>
      </>
    )}
  </ConversionPanel>
</App>
```

**기능**:
- 탭 전환 (Figma→Schema / Schema→Figma)
- 스키마 프리뷰 (Syntax Highlight)
- Export 옵션 (format, version)
- Copy to Clipboard / Download

**예상 난이도**: 중

---

### 4.3 통합 테스트

**테스트 시나리오**:

1. **기본 테이블 변환**
   - 단순 Request/Response 테이블 생성
   - 플러그인으로 파싱
   - JSON Schema 생성 확인

2. **중첩 구조**
   - Depth 0-3까지 중첩된 객체
   - 계층 구조가 올바른지 확인

3. **Array 타입**
   - Array 필드와 items 정의
   - items가 올바르게 변환되는지 확인

4. **역변환**
   - JSON Schema 입력
   - 피그마 테이블 생성
   - 원본과 일치하는지 확인

5. **OpenAPI 변환**
   - 여러 엔드포인트 테이블
   - OpenAPI 문서 생성
   - paths가 올바른지 확인

**예상 난이도**: 중-상

---

## 리스크 및 대응

### 1. 피그마 레이아웃 다양성
**리스크**: 사용자가 다양한 레이아웃으로 테이블 생성
**대응**:
- 색상 기반 감지에 허용 범위 추가 (±0.1)
- Auto Layout / Manual Layout 모두 지원
- 감지 실패 시 명확한 에러 메시지

### 2. 복잡한 스키마 타입
**리스크**: oneOf, anyOf, allOf 등 복합 타입
**대응**:
- Phase 1-3에서는 기본 타입만 지원
- 향후 확장 계획

### 3. 대용량 테이블
**리스크**: 수백 개의 필드가 있는 테이블
**대응**:
- 페이지네이션 또는 섹션 분할
- 성능 최적화 (필요시)

### 4. 순환 참조
**리스크**: Schema에 순환 참조가 있을 경우
**대응**:
- $ref 사용 (JSON Schema)
- 순환 감지 알고리즘 구현

---

## 마일스톤

- **Week 1**: Phase 1 완료 (파싱 로직)
- **Week 2**: Phase 2 완료 (스키마 생성)
- **Week 3**: Phase 3 완료 (역변환)
- **Week 4**: Phase 4 완료 (UI 및 통합 테스트)

---

## 구현 순서 요약

1. ✅ **프로젝트 초기화** (완료)
   - 타입 정의, 문서 작성

2. **tableParser.ts** (핵심)
   - 테이블 구조 감지 및 파싱

3. **depthResolver.ts** (핵심)
   - 계층 구조 복원

4. **typeMapper.ts**
   - 타입 매핑

5. **jsonSchemaBuilder.ts**
   - JSON Schema 생성

6. **openApiBuilder.ts**
   - OpenAPI 문서 생성

7. **tableGenerator.ts**
   - 스키마 평탄화

8. **frameBuilder.ts** + **styleApplier.ts**
   - 피그마 노드 생성

9. **plugin/index.ts**
   - 플러그인 메인 로직

10. **UI 컴포넌트**
    - React UI 구현

11. **통합 테스트**
    - 전체 플로우 검증

---

## 질문 및 검토 포인트

### Codex에게 확인받고 싶은 부분:

1. **구현 순서가 적절한가?**
   - Phase 1 → 2 → 3 → 4 순서가 맞는지
   - 병렬로 진행 가능한 부분이 있는지

2. **알고리즘 설계**
   - Depth 기반 계층 복원 알고리즘이 올바른지
   - Stack 기반 접근이 적절한지

3. **리스크 대응**
   - 누락된 리스크가 있는지
   - 대응 방안이 충분한지

4. **확장성**
   - 향후 기능 추가 시 구조 변경이 필요한지
   - 더 나은 아키텍처가 있는지

5. **성능 고려사항**
   - 대용량 테이블 처리 전략
   - 최적화가 필요한 부분

6. **테스트 전략**
   - 테스트 시나리오가 충분한지
   - 엣지 케이스 누락은 없는지
