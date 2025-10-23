/**
 * JSON Schema로부터 테이블 구조 생성 (역변환)
 */

import { TableFrame, TableRow, TableColumn, DEFAULT_TABLE_CONFIG, DEFAULT_COLUMN_WIDTHS, HttpMethod, EndpointInfo } from '../types/table';
import { JsonSchema } from '../types/schema';

/**
 * JSON Schema로부터 테이블 프레임 배열 생성
 */
export function generateTablesFromSchema(
  schema: JsonSchema,
  options?: {
    endpoint?: EndpointInfo;
    title?: string;
  }
): TableFrame[] {
  const tables: TableFrame[] = [];
  let tableIdCounter = 0;

  function generateTableId(): string {
    return `generated-table-${tableIdCounter++}`;
  }

  // 루트 테이블 생성
  const rootTable: TableFrame = {
    id: generateTableId(),
    title: options?.title || schema.title || 'Schema',
    isRoot: true,
    depth: 0,
    endpoint: options?.endpoint,
    columns: [...DEFAULT_TABLE_CONFIG.columns].map((name, index) => ({
      name,
      width: DEFAULT_COLUMN_WIDTHS[name] || 120,
      index,
    })),
    rows: [],
    position: { x: 0, y: 0 },
    size: { width: DEFAULT_TABLE_CONFIG.tableWidth, height: 100 },
  };

  // 루트 스키마 속성들을 행으로 변환
  if (schema.type === 'object' && schema.properties) {
    const result = flattenProperties(
      schema.properties,
      schema.required || [],
      generateTableId,
      0
    );

    rootTable.rows = result.rows;
    tables.push(rootTable);
    tables.push(...result.childTables);

    // 직접 자식만 부모 관계 설정 (손자 이하는 flattenProperties에서 이미 설정됨)
    for (const childTable of result.childTables) {
      if (!childTable.parentTableId) {
        childTable.parentTableId = rootTable.id;
      }
    }
  }

  console.log('Generated tables:', tables.length);
  tables.forEach(t => console.log(`- ${t.title} (depth: ${t.depth}, parent: ${t.parentTableId || 'none'})`));

  return tables;
}

interface FlattenResult {
  rows: TableRow[];
  childTables: TableFrame[];
}

/**
 * properties를 평탄화하여 행과 하위 테이블 생성
 */
function flattenProperties(
  properties: Record<string, JsonSchema>,
  required: string[],
  generateTableId: () => string,
  currentDepth: number
): FlattenResult {
  const rows: TableRow[] = [];
  const childTables: TableFrame[] = [];

  for (const [fieldName, fieldSchema] of Object.entries(properties)) {
    const isRequired = required.includes(fieldName);

    // 타입명 생성: object/array는 PascalCase
    const typeName = toPascalCase(fieldName);
    let typeDisplay = fieldSchema.type as string;

    // object 타입: 하위 테이블 생성
    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      typeDisplay = typeName;
      const childTableId = generateTableId();

      const row: TableRow = {
        field: fieldName,
        type: typeDisplay,
        required: isRequired,
        description: fieldSchema.description,
        example: fieldSchema.examples?.[0],
        default: fieldSchema.default,
        hasChildTable: true,
        childTableId,
      };

      const childTable: TableFrame = {
        id: childTableId,
        title: typeName,
        isRoot: false,
        depth: currentDepth + 1,
        columns: [...DEFAULT_TABLE_CONFIG.columns].map((name, index) => ({
          name,
          width: DEFAULT_COLUMN_WIDTHS[name] || 120,
          index,
        })),
        rows: [],
        position: { x: 0, y: 0 }, // 나중에 레이아웃에서 계산
        size: { width: DEFAULT_TABLE_CONFIG.tableWidth, height: 100 },
        parentFieldName: fieldName,
        parentFieldType: 'object',
      };

      const childResult = flattenProperties(
        fieldSchema.properties,
        fieldSchema.required || [],
        generateTableId,
        currentDepth + 1
      );

      childTable.rows = childResult.rows;
      childTables.push(childTable);
      childTables.push(...childResult.childTables);

      // 하위 테이블의 부모 설정
      for (const grandchild of childResult.childTables) {
        grandchild.parentTableId = childTableId;
      }

      rows.push(row);
    }
    // array 타입: items 처리
    else if (fieldSchema.type === 'array' && fieldSchema.items) {
      const items = fieldSchema.items as JsonSchema;

      if (items.type === 'object' && items.properties) {
        typeDisplay = `${typeName}[]`;
        const childTableId = generateTableId();

        const row: TableRow = {
          field: fieldName,
          type: typeDisplay,
          required: isRequired,
          description: fieldSchema.description,
          example: fieldSchema.examples?.[0],
          default: fieldSchema.default,
          hasChildTable: true,
          childTableId,
        };

        const childTable: TableFrame = {
          id: childTableId,
          title: typeName,
          isRoot: false,
          depth: currentDepth + 1,
          columns: [...DEFAULT_TABLE_CONFIG.columns].map((name, index) => ({
            name,
            width: DEFAULT_COLUMN_WIDTHS[name] || 120,
            index,
          })),
          rows: [],
          position: { x: 0, y: 0 },
          size: { width: DEFAULT_TABLE_CONFIG.tableWidth, height: 100 },
          parentFieldName: fieldName,
          parentFieldType: 'array',
        };

        const childResult = flattenProperties(
          items.properties,
          items.required || [],
          generateTableId,
          currentDepth + 1
        );

        childTable.rows = childResult.rows;
        childTables.push(childTable);
        childTables.push(...childResult.childTables);

        for (const grandchild of childResult.childTables) {
          grandchild.parentTableId = childTableId;
        }

        rows.push(row);
      } else {
        // array of primitives (string[], number[] 등)
        const primitiveType = items.type as string;
        const row: TableRow = {
          field: fieldName,
          type: `${primitiveType}[]`,
          required: isRequired,
          description: fieldSchema.description,
          example: fieldSchema.examples?.[0] || (items.examples ? JSON.stringify(items.examples) : undefined),
          default: fieldSchema.default || (items.default !== undefined ? JSON.stringify(items.default) : undefined),
          hasChildTable: false,
        };
        rows.push(row);
      }
    } else {
      // 기본 타입
      const row: TableRow = {
        field: fieldName,
        type: typeDisplay,
        required: isRequired,
        description: fieldSchema.description,
        example: fieldSchema.examples?.[0],
        default: fieldSchema.default,
        hasChildTable: false,
      };
      rows.push(row);
    }
  }

  return { rows, childTables };
}

/**
 * fieldName을 PascalCase로 변환
 */
function toPascalCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase 분리
    .replace(/[_-]/g, ' ') // snake_case, kebab-case 분리
    .split(' ')
    .filter(word => word.length > 0) // 빈 문자열 제거
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * 생성된 테이블들의 레이아웃 계산
 */
export function calculateTableLayout(tables: TableFrame[]): void {
  const horizontalGap = DEFAULT_TABLE_CONFIG.horizontalGap;
  const verticalGap = DEFAULT_TABLE_CONFIG.verticalGap;
  const rowHeight = DEFAULT_TABLE_CONFIG.rowHeight;
  const headerHeight = rowHeight * 2; // 제목 + 컬럼 헤더

  // 테이블 ID로 빠른 조회를 위한 맵 생성
  const tableMap = new Map<string, TableFrame>();
  for (const table of tables) {
    tableMap.set(table.id, table);
  }

  // 먼저 모든 테이블의 크기 계산
  for (const table of tables) {
    const totalWidth = table.columns.reduce((sum, col) => sum + col.width, 0);
    table.size.width = totalWidth;

    const dataHeight = table.rows.length * rowHeight;
    table.size.height = headerHeight + dataHeight;
  }

  // 루트 테이블 찾기
  const rootTable = tables.find(t => t.isRoot);
  if (!rootTable) return;

  // 루트 테이블 배치
  rootTable.position = { x: 0, y: 0 };

  // 재귀적으로 자식 테이블 배치
  layoutChildren(rootTable, tables, tableMap, horizontalGap, verticalGap, rowHeight, headerHeight);
}

/**
 * 자식 테이블들을 재귀적으로 배치
 */
function layoutChildren(
  parentTable: TableFrame,
  allTables: TableFrame[],
  tableMap: Map<string, TableFrame>,
  horizontalGap: number,
  verticalGap: number,
  rowHeight: number,
  headerHeight: number
): void {
  // 이 테이블의 자식들 찾기
  const children = allTables.filter(t => t.parentTableId === parentTable.id);

  if (children.length === 0) return;

  // 자식 테이블의 x 좌표
  const childX = parentTable.position.x + parentTable.size.width + horizontalGap;

  // 각 자식 테이블 배치
  let nextAvailableY = parentTable.position.y;

  for (const childTable of children) {
    // 부모 테이블에서 이 자식과 연결된 row 찾기
    const parentRow = parentTable.rows.find(r => r.childTableId === childTable.id);

    if (parentRow) {
      // 부모 row의 인덱스
      const rowIndex = parentTable.rows.indexOf(parentRow);

      // 부모 row의 y 좌표 계산
      const parentRowY = parentTable.position.y + headerHeight + (rowIndex * rowHeight);

      // 자식 테이블의 y 좌표는 부모 row의 y 좌표와 같거나 더 낮아야 함
      const childY = Math.max(parentRowY, nextAvailableY);

      childTable.position = { x: childX, y: childY };

      // 이 자식의 자식들도 재귀적으로 배치 (먼저 배치)
      layoutChildren(childTable, allTables, tableMap, horizontalGap, verticalGap, rowHeight, headerHeight);

      // 이 자식과 그 모든 자손들이 차지하는 영역 계산
      const subtreeBottomY = getSubtreeBottomY(childTable, allTables);

      // 다음 자식 테이블이 배치될 수 있는 최소 y 좌표 업데이트
      // (현재 자식 + 그 자손들의 가장 아래보다 낮아야 함)
      nextAvailableY = subtreeBottomY + verticalGap;
    } else {
      // parentRow를 찾지 못한 경우 (안전장치)
      childTable.position = { x: childX, y: nextAvailableY };

      layoutChildren(childTable, allTables, tableMap, horizontalGap, verticalGap, rowHeight, headerHeight);

      const subtreeBottomY = getSubtreeBottomY(childTable, allTables);
      nextAvailableY = subtreeBottomY + verticalGap;
    }
  }
}

/**
 * 테이블과 그 모든 자손들이 차지하는 영역의 가장 아래 y 좌표 계산
 */
function getSubtreeBottomY(table: TableFrame, allTables: TableFrame[]): number {
  let maxY = table.position.y + table.size.height;

  // 모든 자손 테이블 찾기
  const descendants = findAllDescendants(table, allTables);

  for (const descendant of descendants) {
    const bottomY = descendant.position.y + descendant.size.height;
    if (bottomY > maxY) {
      maxY = bottomY;
    }
  }

  return maxY;
}

/**
 * 테이블의 모든 자손 찾기 (재귀적)
 */
function findAllDescendants(table: TableFrame, allTables: TableFrame[]): TableFrame[] {
  const descendants: TableFrame[] = [];
  const directChildren = allTables.filter(t => t.parentTableId === table.id);

  for (const child of directChildren) {
    descendants.push(child);
    descendants.push(...findAllDescendants(child, allTables));
  }

  return descendants;
}
