# Architecture V2 (수정된 이해)

## 올바른 구조 이해

### 핵심 개념

**각 테이블 = 1개의 depth 레벨을 나타내는 독립적인 프레임**

- 테이블들이 **오른쪽으로 연결**되면서 계층 구조 형성
- 왼쪽 → 오른쪽 = 부모 → 자식 → 손자 관계
- 각 테이블은 부모 테이블의 특정 필드(object 또는 array)를 확장

### 시각적 예시

```
┌─────────────────────────┐
│ [GET] /stroller/products│
├──────┬──────┬───────────┤
│Field │Type  │Required   │
├──────┼──────┼───────────┤
│id    │number│ true      │
│name  │string│ true      │
│options│array│ false     │────┐
└──────┴──────┴───────────┘    │
                                │
                                ↓
                       ┌─────────────────┐
                       │ options (array) │
                       ├─────────┬───────┤
                       │Field    │Type   │
                       ├─────────┼───────┤
                       │optionId │number │
                       │label    │string │
                       │details  │object │────┐
                       └─────────┴───────┘    │
                                               │
                                               ↓
                                      ┌─────────────┐
                                      │details(obj) │
                                      ├──────┬──────┤
                                      │Field │Type  │
                                      ├──────┼──────┤
                                      │color │string│
                                      │size  │number│
                                      └──────┴──────┘
```

### 실제 의미

위의 구조는 다음 JSON Schema를 나타냄:

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "number" },
    "name": { "type": "string" },
    "options": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "optionId": { "type": "number" },
          "label": { "type": "string" },
          "details": {
            "type": "object",
            "properties": {
              "color": { "type": "string" },
              "size": { "type": "number" }
            }
          }
        }
      }
    }
  }
}
```

---

## 새로운 데이터 구조

### TableFrame (각 테이블을 나타냄)

```typescript
interface TableFrame {
  id: string; // 피그마 노드 ID
  title?: string; // 테이블 제목 (필드명 또는 엔드포인트)
  isRoot: boolean; // 최상위 테이블 여부

  // 엔드포인트 정보 (루트 테이블만)
  endpoint?: {
    method: string; // GET, POST, etc.
    path: string;   // /api/path
  };

  // 테이블 데이터
  columns: string[]; // ['Field', 'Type', 'Required', 'Description']
  rows: TableRow[];

  // 위치 정보
  position: {
    x: number;
    y: number;
  };

  // 부모 관계
  parentTableId?: string; // 부모 테이블 ID
  parentFieldName?: string; // 부모의 어떤 필드를 확장하는지
}
```

### TableRow (각 행)

```typescript
interface TableRow {
  field: string;        // 필드명
  type: string;         // 타입
  required: boolean;    // 필수 여부
  description?: string; // 설명

  // 이 필드가 하위 테이블을 가지는지
  hasChildTable: boolean;
  childTableId?: string;
}
```

### TableHierarchy (전체 구조)

```typescript
interface TableHierarchy {
  root: TableFrame;
  children: Map<string, TableFrame>; // tableId -> TableFrame
  edges: TableEdge[]; // 테이블 간 연결 관계
}

interface TableEdge {
  fromTableId: string;
  fromField: string;
  toTableId: string;
}
```

---

## 파싱 전략

### 1단계: 모든 테이블 프레임 찾기

```typescript
function findAllTables(page: PageNode): TableFrame[] {
  // 1. 특정 패턴을 가진 Frame 노드들 찾기
  //    - 색상 패턴 (헤더 색상)
  //    - 테이블 형태의 레이아웃
  //    - 엔드포인트 제목 포함 여부

  // 2. 각 Frame을 TableFrame으로 변환

  // 3. x 좌표 기준으로 정렬 (왼쪽 → 오른쪽)
}
```

### 2단계: 루트 테이블 식별

```typescript
function identifyRootTable(tables: TableFrame[]): TableFrame {
  // 1. 가장 왼쪽(x 좌표가 가장 작은) 테이블
  // 2. 또는 [METHOD] /path 형식의 제목을 가진 테이블
}
```

### 3단계: 테이블 간 연결 관계 파악

```typescript
function buildTableHierarchy(tables: TableFrame[]): TableHierarchy {
  // 방법 1: 화살표/선 감지
  //   - 피그마의 Line/Arrow 노드 찾기
  //   - 선의 시작점과 끝점으로 연결 관계 파악

  // 방법 2: 위치 기반 추론
  //   - 부모 테이블의 오른쪽에 있는 테이블들을 자식으로 간주
  //   - y 좌표 범위가 겹치는지 확인
  //   - 부모의 어떤 필드(object/array)에서 연결되는지 매칭

  // 방법 3: 제목 매칭
  //   - 자식 테이블의 제목이 부모 필드명과 일치하는지 확인
}
```

### 4단계: JSON Schema 생성

```typescript
function buildSchemaFromHierarchy(hierarchy: TableHierarchy): JsonSchema {
  // 1. 루트 테이블부터 시작
  // 2. 각 필드를 순회하면서:
  //    - 하위 테이블이 있으면 재귀적으로 처리
  //    - object 타입: properties로 변환
  //    - array 타입: items로 변환
  // 3. required 배열 생성
}
```

---

## 핵심 알고리즘: 테이블 연결 추론

### 위치 기반 알고리즘

```typescript
function inferTableConnections(tables: TableFrame[]): TableEdge[] {
  const edges: TableEdge[] = [];

  // 1. x 좌표 기준으로 테이블을 레벨별로 그룹화
  const levels = groupByXPosition(tables);

  // 2. 각 레벨에서 다음 레벨로의 연결 추론
  for (let i = 0; i < levels.length - 1; i++) {
    const currentLevel = levels[i];
    const nextLevel = levels[i + 1];

    for (const parentTable of currentLevel) {
      // 부모 테이블의 object/array 타입 필드 찾기
      const expandableFields = parentTable.rows.filter(
        row => row.type === 'object' || row.type === 'array'
      );

      for (const childTable of nextLevel) {
        // y 좌표 범위가 겹치는지 확인
        if (isVerticallyAligned(parentTable, childTable)) {
          // 가장 가까운 expandable field와 매칭
          const matchedField = findClosestField(
            expandableFields,
            childTable.position.y
          );

          if (matchedField) {
            edges.push({
              fromTableId: parentTable.id,
              fromField: matchedField.field,
              toTableId: childTable.id,
            });
          }
        }
      }
    }
  }

  return edges;
}
```

---

## 역변환 (Schema → Figma)

### 1단계: 스키마를 테이블 계층으로 분해

```typescript
function decomposeSchema(schema: JsonSchema): TableFrame[] {
  const tables: TableFrame[] = [];

  // 1. 루트 테이블 생성
  const rootTable = createTableFromProperties(schema.properties);
  tables.push(rootTable);

  // 2. 각 object/array 필드에 대해 재귀적으로 하위 테이블 생성
  function processField(
    field: string,
    fieldSchema: JsonSchema,
    parentTableId: string,
    depth: number
  ) {
    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      const childTable = createTableFromProperties(fieldSchema.properties);
      childTable.parentTableId = parentTableId;
      childTable.parentFieldName = field;
      childTable.depth = depth + 1;
      tables.push(childTable);

      // 재귀
      for (const [childField, childSchema] of Object.entries(fieldSchema.properties)) {
        processField(childField, childSchema, childTable.id, depth + 1);
      }
    } else if (fieldSchema.type === 'array' && fieldSchema.items) {
      // array items 처리
      const childTable = createTableFromItems(fieldSchema.items);
      childTable.parentTableId = parentTableId;
      childTable.parentFieldName = field;
      childTable.depth = depth + 1;
      tables.push(childTable);

      // items가 object면 재귀
      if (fieldSchema.items.type === 'object') {
        for (const [itemField, itemSchema] of Object.entries(fieldSchema.items.properties || {})) {
          processField(itemField, itemSchema, childTable.id, depth + 1);
        }
      }
    }
  }

  return tables;
}
```

### 2단계: 테이블 배치

```typescript
function layoutTables(tables: TableFrame[]): void {
  // 1. depth 별로 그룹화
  const levelGroups = groupBy(tables, t => t.depth);

  // 2. 각 레벨을 x 좌표에 배치
  const TABLE_WIDTH = 300;
  const HORIZONTAL_GAP = 100;

  levelGroups.forEach((tables, depth) => {
    const x = depth * (TABLE_WIDTH + HORIZONTAL_GAP);

    // 3. 같은 레벨 내에서 y 좌표 배치
    let y = 0;
    const VERTICAL_GAP = 50;

    tables.forEach(table => {
      table.position = { x, y };
      y += table.height + VERTICAL_GAP;
    });
  });
}
```

### 3단계: 피그마 노드 생성 및 연결선 그리기

```typescript
function createFigmaNodes(tables: TableFrame[], edges: TableEdge[]): void {
  // 1. 각 테이블을 Frame으로 생성
  tables.forEach(table => {
    createTableFrame(table);
  });

  // 2. 연결선 그리기 (선택사항)
  edges.forEach(edge => {
    const fromTable = findTable(edge.fromTableId);
    const toTable = findTable(edge.toTableId);

    // 부모 필드에서 자식 테이블로 화살표 그리기
    drawArrow(fromTable, edge.fromField, toTable);
  });
}
```

---

## 예시: 실제 변환 과정

### 입력 (피그마 테이블들)

```
테이블1 (x=0):
  [GET] /products
  - id: number
  - name: string
  - options: array  ──→

테이블2 (x=400):
  options item
  - optionId: number
  - label: string
  - details: object ──→

테이블3 (x=800):
  details
  - color: string
  - size: number
```

### 파싱 결과

```typescript
hierarchy = {
  root: TableFrame {
    id: "table1",
    endpoint: { method: "GET", path: "/products" },
    rows: [
      { field: "id", type: "number", hasChildTable: false },
      { field: "name", type: "string", hasChildTable: false },
      { field: "options", type: "array", hasChildTable: true, childTableId: "table2" },
    ]
  },
  children: {
    "table2": TableFrame {
      id: "table2",
      parentTableId: "table1",
      parentFieldName: "options",
      rows: [
        { field: "optionId", type: "number", hasChildTable: false },
        { field: "label", type: "string", hasChildTable: false },
        { field: "details", type: "object", hasChildTable: true, childTableId: "table3" },
      ]
    },
    "table3": TableFrame {
      id: "table3",
      parentTableId: "table2",
      parentFieldName: "details",
      rows: [
        { field: "color", type: "string", hasChildTable: false },
        { field: "size", type: "number", hasChildTable: false },
      ]
    }
  },
  edges: [
    { fromTableId: "table1", fromField: "options", toTableId: "table2" },
    { fromTableId: "table2", fromField: "details", toTableId: "table3" },
  ]
}
```

### 출력 (JSON Schema)

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "number" },
    "name": { "type": "string" },
    "options": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "optionId": { "type": "number" },
          "label": { "type": "string" },
          "details": {
            "type": "object",
            "properties": {
              "color": { "type": "string" },
              "size": { "type": "number" }
            }
          }
        }
      }
    }
  }
}
```

---

## 핵심 차이점 요약

### 기존 잘못된 이해
- ❌ 하나의 테이블에 Depth 컬럼이 있음
- ❌ Depth 숫자로 중첩 표현

### 올바른 이해
- ✅ 각 테이블 = 1개의 depth 레벨
- ✅ 테이블이 오른쪽으로 연결되면서 계층 구조
- ✅ 위치 관계로 부모-자식 판단

---

## 다음 단계

1. **테이블 감지 로직** 구현
2. **연결 관계 추론** 알고리즘 구현
3. **계층 구조 빌드** 로직 구현
4. **JSON Schema 생성** 로직 구현
5. **역변환** (Schema → 테이블 배치) 구현
