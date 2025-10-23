/**
 * 테이블 프레임들의 계층 구조 구축
 */

import { TableFrame, TableHierarchy, TableEdge } from '../types/table';
import { isExpandableType } from './typeMapper';

/**
 * 테이블 프레임들로부터 계층 구조 생성
 */
export function buildHierarchy(tables: TableFrame[]): TableHierarchy | null {
  if (tables.length === 0) {
    return null;
  }

  // 1. 루트 테이블 식별
  const root = identifyRootTable(tables);
  if (!root) {
    throw new Error('No root table found');
  }

  // 2. 나머지 테이블들
  const nonRootTables = tables.filter((t) => t.id !== root.id);

  // 3. 테이블 간 연결 관계 추론
  const edges = inferTableConnections([root, ...nonRootTables]);

  // 4. depth 계산 및 부모 관계 설정
  const tablesMap = new Map<string, TableFrame>();
  tablesMap.set(root.id, root);
  root.depth = 0;

  for (const table of nonRootTables) {
    tablesMap.set(table.id, table);
  }

  // edge를 기반으로 depth 및 부모 설정
  for (const edge of edges) {
    const parentTable = tablesMap.get(edge.fromTableId);
    const childTable = tablesMap.get(edge.toTableId);

    if (parentTable && childTable) {
      childTable.depth = parentTable.depth + 1;
      childTable.parentTableId = edge.fromTableId;
      childTable.parentFieldName = edge.fromField;

      // 부모 행에 hasChildTable 플래그 설정
      const parentRow = parentTable.rows.find((r) => r.field === edge.fromField);
      if (parentRow) {
        parentRow.hasChildTable = true;
        parentRow.childTableId = edge.toTableId;
        childTable.parentFieldType = parentRow.type.toLowerCase().trim() === 'array' ? 'array' : 'object';
      }
    }
  }

  return {
    root,
    tables: tablesMap,
    edges,
  };
}

/**
 * 루트 테이블 식별
 */
function identifyRootTable(tables: TableFrame[]): TableFrame | null {
  // 1. endpoint 정보가 있는 테이블
  const endpointTable = tables.find((t) => t.endpoint);
  if (endpointTable) {
    return endpointTable;
  }

  // 2. 가장 왼쪽(x 좌표가 가장 작은) 테이블
  if (tables.length > 0) {
    return tables.reduce((leftmost, current) =>
      current.position.x < leftmost.position.x ? current : leftmost
    );
  }

  return null;
}

/**
 * 테이블 간 연결 관계 추론 - 타입 이름 기반
 */
function inferTableConnections(tables: TableFrame[]): TableEdge[] {
  const edges: TableEdge[] = [];

  // 테이블 이름(title)으로 맵 생성
  const tablesByTitle = new Map<string, TableFrame>();
  for (const table of tables) {
    if (table.title) {
      tablesByTitle.set(table.title, table);
    }
  }

  // 각 테이블의 rows를 순회하며 타입 이름으로 자식 테이블 찾기
  for (const parentTable of tables) {
    for (const row of parentTable.rows) {
      if (!isExpandableType(row.type)) {
        continue;
      }

      // 타입 이름에서 배열 표기([]) 제거
      const typeName = row.type.replace(/\[\]$/, '').trim();

      // 같은 이름의 테이블 찾기
      const childTable = tablesByTitle.get(typeName);

      if (childTable && childTable.id !== parentTable.id) {
        edges.push({
          fromTableId: parentTable.id,
          fromField: row.field,
          toTableId: childTable.id,
        });

        // 부모 row에 자식 정보 설정
        row.hasChildTable = true;
        row.childTableId = childTable.id;
      }
    }
  }

  return edges;
}

/**
 * 특정 테이블의 모든 자손 찾기
 */
export function findDescendants(
  tableId: string,
  hierarchy: TableHierarchy
): TableFrame[] {
  const descendants: TableFrame[] = [];

  function traverse(currentId: string) {
    const childEdges = hierarchy.edges.filter((e) => e.fromTableId === currentId);

    for (const edge of childEdges) {
      const child = hierarchy.tables.get(edge.toTableId);
      if (child) {
        descendants.push(child);
        traverse(child.id);
      }
    }
  }

  traverse(tableId);

  return descendants;
}

/**
 * 특정 테이블의 직접 자식들 찾기
 */
export function findChildren(
  tableId: string,
  hierarchy: TableHierarchy
): TableFrame[] {
  const children: TableFrame[] = [];

  const childEdges = hierarchy.edges.filter((e) => e.fromTableId === tableId);

  for (const edge of childEdges) {
    const child = hierarchy.tables.get(edge.toTableId);
    if (child) {
      children.push(child);
    }
  }

  return children;
}
