/**
 * TableFrame으로부터 실제 피그마 Frame 노드 생성
 */

import { TableFrame, TableRow, DEFAULT_COLORS, DEFAULT_TABLE_CONFIG, DEFAULT_COLUMN_WIDTHS } from '../types/table';
import { rgbToPaint } from '../utils/colorUtils';

/**
 * 테이블 프레임을 피그마 Frame 노드로 생성
 */
function createTableFrameNode(table: TableFrame): FrameNode {
  const frame = figma.createFrame();
  frame.name = table.title || 'Table';
  frame.x = table.position.x;
  frame.y = table.position.y;
  frame.resize(table.size.width, table.size.height);

  // 테이블 전체 검은색 테두리
  frame.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  frame.strokeWeight = 1;

  // Auto Layout 설정
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.itemSpacing = 0;
  frame.paddingLeft = 0;
  frame.paddingRight = 0;
  frame.paddingTop = 0;
  frame.paddingBottom = 0;

  let currentY = 0;

  // 제목 생성
  if (table.title) {
    const titleNode = createTitleNode(table.title, table.size.width);
    frame.appendChild(titleNode);
    currentY += titleNode.height;
  }

  // 컬럼 헤더 생성
  const headerRow = createHeaderRow(table.columns, table.size.width);
  frame.appendChild(headerRow);
  currentY += headerRow.height;

  // 데이터 행 생성
  for (const row of table.rows) {
    const rowNode = createDataRow(row, table.columns, table.size.width);
    frame.appendChild(rowNode);
    currentY += rowNode.height;
  }

  return frame;
}

/**
 * 제목 노드 생성
 */
function createTitleNode(title: string, width: number): FrameNode {
  const frame = figma.createFrame();
  frame.name = 'Title';
  frame.resize(width, 36);
  // 진한 핑크 배경
  frame.fills = [rgbToPaint(DEFAULT_COLORS.header)];

  // 테두리 없음 (전체 테이블 frame에서 관리)
  frame.strokes = [];

  const text = figma.createText();
  // 폰트는 이미 createMultipleTableFrames에서 로드됨
  text.fontName = { family: 'Inter', style: 'Semi Bold' };
  text.fontSize = 12;
  // Figma는 빈 문자열을 허용하지 않으므로 공백 문자 사용
  text.characters = title || 'Untitled';
  text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // 흰색
  text.textAlignHorizontal = 'CENTER';
  text.textAlignVertical = 'CENTER';
  text.x = 12;
  text.y = 10;
  text.resize(width - 24, 20);

  frame.appendChild(text);

  return frame;
}

/**
 * 헤더 행 생성
 */
function createHeaderRow(
  columns: { name: string; width: number }[],
  totalWidth: number
): FrameNode {
  const rowFrame = figma.createFrame();
  rowFrame.name = 'Header Row';
  rowFrame.resize(totalWidth, DEFAULT_TABLE_CONFIG.rowHeight);
  rowFrame.fills = [rgbToPaint(DEFAULT_COLORS.columnHeader)];

  // 헤더 하단에만 테두리 추가 (데이터 row와 구분)
  rowFrame.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  rowFrame.strokeWeight = 1;
  rowFrame.strokeTopWeight = 0;
  rowFrame.strokeRightWeight = 0;
  rowFrame.strokeBottomWeight = 1;
  rowFrame.strokeLeftWeight = 0;

  // Auto Layout
  rowFrame.layoutMode = 'HORIZONTAL';
  rowFrame.primaryAxisSizingMode = 'FIXED';
  rowFrame.counterAxisSizingMode = 'FIXED';
  rowFrame.itemSpacing = 0;

  for (const column of columns) {
    const width = DEFAULT_COLUMN_WIDTHS[column.name] || 120;
    const cell = createCellNode(column.name, width, true);
    rowFrame.appendChild(cell);
  }

  return rowFrame;
}

/**
 * 데이터 행 생성
 */
function createDataRow(
  row: TableRow,
  columns: { name: string }[],
  totalWidth: number
): FrameNode {
  const rowFrame = figma.createFrame();
  rowFrame.name = `Row: ${row.field}`;
  rowFrame.resize(totalWidth, DEFAULT_TABLE_CONFIG.rowHeight);
  rowFrame.fills = [rgbToPaint(DEFAULT_COLORS.data)];

  // 테두리는 셀 단위에서만 관리 (rowFrame은 테두리 없음)
  rowFrame.strokes = [];

  // Auto Layout
  rowFrame.layoutMode = 'HORIZONTAL';
  rowFrame.primaryAxisSizingMode = 'FIXED';
  rowFrame.counterAxisSizingMode = 'FIXED';
  rowFrame.itemSpacing = 0;

  // 컬럼 순서대로 값 배치
  for (const column of columns) {
    let value = '';

    switch (column.name) {
      case 'Field':
        value = row.field;
        break;
      case 'Type':
        value = row.type;
        break;
      case 'Required':
      case 'Mandatory':
        value = row.required ? '●' : '';
        break;
      case 'Description':
        value = row.description || '';
        break;
      case 'Example':
        // example은 any 타입일 수 있으므로 문자열로 변환
        if (row.example != null) {
          value = typeof row.example === 'object'
            ? JSON.stringify(row.example)
            : String(row.example);
        } else {
          value = '';
        }
        break;
      case 'Default':
        // default도 any 타입일 수 있으므로 문자열로 변환
        if (row.default != null) {
          value = typeof row.default === 'object'
            ? JSON.stringify(row.default)
            : String(row.default);
        } else {
          value = '';
        }
        break;
      default:
        value = row[column.name] || '';
    }

    const width = DEFAULT_COLUMN_WIDTHS[column.name] || 120;
    const cell = createCellNode(value, width, false);
    rowFrame.appendChild(cell);
  }

  return rowFrame;
}

/**
 * 셀 노드 생성
 */
function createCellNode(
  text: string,
  width: number,
  isHeader: boolean
): FrameNode {
  const cellFrame = figma.createFrame();
  cellFrame.name = 'Cell';
  cellFrame.resize(width, DEFAULT_TABLE_CONFIG.rowHeight);
  cellFrame.fills = []; // 투명

  // 검은색 테두리: 하 1px, 좌 1px만 (상단은 row가 겹치므로 제외)
  cellFrame.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  cellFrame.strokeWeight = 1;
  cellFrame.strokeTopWeight = 0;
  cellFrame.strokeRightWeight = 0;
  cellFrame.strokeBottomWeight = 1;
  cellFrame.strokeLeftWeight = 1;

  const textNode = figma.createText();

  // 폰트는 이미 createMultipleTableFrames에서 로드됨
  if (isHeader) {
    // 헤더: Semi Bold
    textNode.fontName = { family: 'Inter', style: 'Semi Bold' };
  } else {
    // 데이터: Regular
    textNode.fontName = { family: 'Inter', style: 'Regular' };
  }

  textNode.fontSize = 12;
  textNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; // 검정색
  textNode.lineHeight = { value: 1.3, unit: 'PERCENT' };
  // Figma는 빈 문자열을 허용하지 않으므로 공백 문자 사용
  textNode.characters = text || ' ';
  textNode.x = 12;
  textNode.y = 10;
  textNode.resize(width - 24, DEFAULT_TABLE_CONFIG.rowHeight - 20);
  textNode.textAlignHorizontal = 'CENTER';
  textNode.textAlignVertical = 'CENTER';

  cellFrame.appendChild(textNode);

  return cellFrame;
}

/**
 * 여러 테이블을 한번에 생성
 */
export async function createMultipleTableFrames(tables: TableFrame[]): Promise<FrameNode[]> {
  // 폰트를 미리 한 번만 로드 (성능 최적화)
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
  ]);

  const frames: FrameNode[] = [];

  // 동기 처리로 변경하여 성능 향상
  for (const table of tables) {
    const frame = createTableFrameNode(table);
    frames.push(frame);
  }

  return frames;
}

/**
 * 테이블 간 연결선 그리기 (선택사항)
 */
export function drawConnector(
  fromTable: FrameNode,
  fromField: string,
  toTable: FrameNode
): void {
  // 간단한 선 그리기
  const line = figma.createLine();
  line.strokeWeight = 2;
  line.strokes = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
  line.dashPattern = [5, 5];

  // 시작점: fromTable의 오른쪽 중앙
  const startX = fromTable.x + fromTable.width;
  const startY = fromTable.y + fromTable.height / 2;

  // 끝점: toTable의 왼쪽 중앙
  const endX = toTable.x;
  const endY = toTable.y + toTable.height / 2;

  line.x = startX;
  line.y = startY;
  line.resize(endX - startX, 0);
  line.rotation = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

  figma.currentPage.appendChild(line);
}
