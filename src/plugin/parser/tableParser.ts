/**
 * 피그마 프레임에서 테이블 구조 파싱
 */

import {
  TableFrame,
  TableColumn,
  TableRow,
  EndpointInfo,
  DEFAULT_COLORS,
  Position,
  Size,
} from '../types/table';
import { extractRGB } from '../utils/colorUtils';
import { getAbsolutePosition, getSize } from '../utils/geometryUtils';
import { parseRequiredValue, normalizeHttpMethod } from './typeMapper';

/**
 * 노드가 테이블 프레임인지 확인
 */
export function isTableFrame(node: SceneNode): boolean {
  if (node.type !== 'FRAME') {
    return false;
  }

  // Frame 이름으로 Row Frame 제외
  const name = node.name.toLowerCase();
  if (
    node.name.startsWith('Row:') ||
    node.name.startsWith('.Row') ||
    node.name === 'Header Row' ||
    node.name.startsWith('Cell') ||
    name.includes('row ') ||  // "Row 1", "Data Row" 등
    name === 'row'
  ) {
    return false;
  }

  // 최소한의 자식 노드 개수 (헤더 + 최소 1개 데이터 row)
  if (node.children.length < 2) {
    return false;
  }

  return true;
}


/**
 * 테이블 프레임 파싱
 */
export function parseTableFrame(node: FrameNode): TableFrame | null {
  try {
    const position = getAbsolutePosition(node);
    const size = getSize(node);

    if (!size) {
      return null;
    }

    // 제목 추출 (있으면)
    const title = extractTitle(node);
    const endpoint = extractEndpoint(title);

    // 컬럼 헤더 파싱
    const columns = parseColumns(node);
    if (columns.length === 0) {
      console.warn('No columns found in table');
      return null;
    }

    // 데이터 행 파싱
    const rows = parseRows(node, columns);

    const tableFrame: TableFrame = {
      id: node.id,
      title,
      isRoot: !!endpoint,
      depth: 0, // 나중에 계층 구조에서 계산
      endpoint,
      columns,
      rows,
      position,
      size,
    };

    return tableFrame;
  } catch (error) {
    console.error('Failed to parse table frame:', error);
    return null;
  }
}

/**
 * 제목 추출
 */
function extractTitle(frame: FrameNode): string | undefined {
  // Frame의 이름이 제목일 수 있음
  if (frame.name && frame.name !== 'Frame') {
    return frame.name;
  }

  // 또는 첫 번째 Text 노드를 제목으로 간주
  for (const child of frame.children) {
    if (child.type === 'TEXT') {
      return child.characters;
    }
  }

  return undefined;
}

/**
 * 제목에서 엔드포인트 정보 추출
 */
function extractEndpoint(title?: string): EndpointInfo | undefined {
  if (!title) {
    return undefined;
  }

  // [METHOD] /path 패턴 매칭
  const endpointPattern = /\[(\w+)\]\s+(\/[^\s]*)/;
  const match = title.match(endpointPattern);

  if (match) {
    try {
      return {
        method: normalizeHttpMethod(match[1]),
        path: match[2],
      };
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * 컬럼 헤더 파싱 - y 좌표로 제일 위에 있는 row를 헤더로 간주 (Title 제외)
 */
function parseColumns(frame: FrameNode): TableColumn[] {
  const columns: TableColumn[] = [];

  // 모든 자식을 y 좌표로 정렬
  const sortedChildren = [...frame.children].sort((a, b) => a.y - b.y);

  if (sortedChildren.length === 0) {
    return getDefaultColumns();
  }

  // Title Frame 건너뛰고 가장 많은 cell을 가진 row를 헤더로 선택
  let headerRow = null;
  let maxCells = 0;

  for (const child of sortedChildren) {
    // Title Frame은 건너뛰기
    if (child.name === 'Title') {
      continue;
    }

    // 자식이 없으면 건너뛰기
    if (!('children' in child) || !child.children || child.children.length === 0) {
      continue;
    }

    // 자식이 1개이고 그게 TEXT가 아닌 경우만 건너뛰기
    if (child.children.length === 1 && child.children[0].type !== 'TEXT') {
      continue;
    }

    // 가장 많은 자식을 가진 Frame을 헤더로 선택
    const cellCount = child.children.length;
    if (cellCount > maxCells) {
      headerRow = child;
      maxCells = cellCount;
    }
  }

  if (!headerRow) {
    return getDefaultColumns();
  }

  // 헤더 row의 자식들을 x 좌표로 정렬하여 컬럼으로 파싱
  const sortedCells = [...headerRow.children].sort((a, b) => a.x - b.x);

  sortedCells.forEach((cell, index) => {
    const text = extractText(cell);
    const width = 'width' in cell ? cell.width : 100;

    if (text) {
      columns.push({
        name: text,
        width,
        index,
      });
    }
  });

  return columns.length > 0 ? columns : getDefaultColumns();
}

function getDefaultColumns(): TableColumn[] {
  return [
    { name: 'Required', width: 80, index: 0 },
    { name: 'Field', width: 140, index: 1 },
    { name: 'Type', width: 100, index: 2 },
    { name: 'Description', width: 260, index: 3 },
    { name: 'Example', width: 260, index: 4 },
    { name: 'Default', width: 260, index: 5 },
  ];
}

/**
 * 데이터 행 파싱 - y 좌표로 정렬하여 Title과 Header를 제외하고 나머지를 데이터 row로 파싱
 */
function parseRows(frame: FrameNode, columns: TableColumn[]): TableRow[] {
  const rows: TableRow[] = [];

  // 모든 자식을 y 좌표로 정렬
  const sortedChildren = [...frame.children].sort((a, b) => a.y - b.y);

  // 먼저 가장 많은 cell을 가진 row를 찾아서 헤더로 간주
  let headerRow = null;
  let maxCells = 0;

  for (const child of sortedChildren) {
    if (child.name === 'Title') continue;
    if (!('children' in child) || !child.children || child.children.length === 0) continue;
    if (child.children.length === 1 && child.children[0].type !== 'TEXT') continue;

    const cellCount = child.children.length;
    if (cellCount > maxCells) {
      headerRow = child;
      maxCells = cellCount;
    }
  }

  // 이제 데이터 row만 파싱 (헤더는 건너뛰기)
  for (const rowNode of sortedChildren) {
    // Title Frame은 건너뛰기
    if (rowNode.name === 'Title') {
      continue;
    }

    // 자식이 없으면 건너뛰기
    if (!('children' in rowNode) || !rowNode.children || rowNode.children.length === 0) {
      continue;
    }

    // 자식이 1개이고 그게 TEXT가 아닌 경우만 건너뛰기
    if (rowNode.children.length === 1 && rowNode.children[0].type !== 'TEXT') {
      continue;
    }

    // 헤더 row는 건너뛰기
    if (headerRow && rowNode === headerRow) {
      continue;
    }

    // 나머지는 데이터 row
    const sortedCells = [...rowNode.children].sort((a, b) => a.x - b.x);
    const row = parseRowFromNodes(sortedCells, columns);
    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * 노드 그룹에서 행 데이터 파싱 (x 좌표로 이미 정렬됨)
 */
function parseRowFromNodes(nodes: SceneNode[], columns: TableColumn[]): TableRow | null {
  const values: Record<string, string> = {};

  // 순서대로 파싱 (x 좌표로 이미 정렬됨)
  nodes.forEach((node, index) => {
    const text = extractText(node);
    console.log(`      Cell ${index}: text="${text}", column="${columns[index]?.name}"`);
    if (text && columns[index]) {
      values[columns[index].name] = text;
    }
  });

  console.log(`      Values:`, values);

  // 필수 필드 확인
  const field = values['Field'] || values['field'];
  const type = values['Type'] || values['type'];

  if (!field || !type) {
    console.log(`      Missing field or type: field="${field}", type="${type}"`);
    return null;
  }

  const requiredStr = values['Required'] || values['required'] || '';
  const required = parseRequiredValue(requiredStr);

  const row: TableRow = {
    field: field.trim(),
    type: type.trim(),
    required,
    description: (values['Description'] || values['description'] || '').trim(),
    example: values['Example'] || values['example'],
    default: values['Default'] || values['default'],
    hasChildTable: false, // 나중에 계층 구조에서 설정
  };

  return row;
}

/**
 * 노드에서 텍스트 추출
 */
function extractText(node: SceneNode): string | null {
  if (node.type === 'TEXT') {
    return node.characters;
  }

  // Frame이나 Group 내부의 Text 찾기
  if ('children' in node) {
    for (const child of node.children) {
      const text = extractText(child);
      if (text) {
        return text;
      }
    }
  }

  return null;
}

/**
 * 페이지 또는 컨테이너에서 모든 테이블 프레임 찾기
 */
export function findAllTableFrames(container: PageNode | FrameNode | SectionNode): TableFrame[] {
  const tables: TableFrame[] = [];

  function traverse(node: BaseNode) {
    if (node.type === 'FRAME' && isTableFrame(node)) {
      const table = parseTableFrame(node);
      if (table) {
        tables.push(table);
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(container);

  return tables;
}
