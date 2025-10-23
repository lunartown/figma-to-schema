/**
 * 피그마 테이블 구조 (수정된 버전)
 * 각 테이블 = 1개의 depth 레벨
 * 테이블들이 오른쪽으로 연결되면서 계층 구조 형성
 */

export interface TableFrame {
  id: string; // 피그마 노드 ID
  title?: string; // 테이블 제목
  isRoot: boolean; // 최상위 테이블 여부
  depth: number; // 0 = root, 1 = 1단계 자식, ...

  // 엔드포인트 정보 (루트 테이블만 해당)
  endpoint?: EndpointInfo;

  // 섹션 정보 (Request/Response)
  section?: 'request' | 'response';

  // 테이블 구조
  columns: TableColumn[];
  rows: TableRow[];

  // 위치 정보
  position: Position;
  size: Size;

  // 부모 관계
  parentTableId?: string; // 부모 테이블 ID
  parentFieldName?: string; // 부모의 어떤 필드를 확장하는지
  parentFieldType?: 'object' | 'array'; // 부모 필드의 타입

  // 스타일 정보 (역변환 시 참고)
  colorScheme?: ColorScheme;
}

export interface EndpointInfo {
  method: HttpMethod;
  path: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface TableColumn {
  name: string; // 'Field', 'Type', 'Required', 'Description' 등
  width: number;
  index: number; // 컬럼 순서
}

export interface TableRow {
  field: string; // 필드명
  type: string; // 타입 (string, number, object, array, ...)
  required: boolean; // 필수 여부
  description?: string; // 설명
  example?: string; // 예시 값
  default?: string; // 기본값

  // 추가 컬럼 (커스텀)
  [key: string]: any;

  // 하위 테이블 연결 정보
  hasChildTable: boolean;
  childTableId?: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ColorScheme {
  header: RGB; // 섹션 헤더 색상
  columnHeader: RGB; // 컬럼 헤더 색상
  data: RGB; // 데이터 행 색상
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * 테이블 계층 구조
 */
export interface TableHierarchy {
  root: TableFrame; // 루트 테이블
  tables: Map<string, TableFrame>; // tableId -> TableFrame
  edges: TableEdge[]; // 테이블 간 연결 관계
}

export interface TableEdge {
  fromTableId: string;
  fromField: string;
  toTableId: string;
}

/**
 * 파싱 컨텍스트
 */
export interface ParsingContext {
  // 감지된 모든 테이블 프레임
  candidateTables: CandidateTable[];

  // 색상 기반 식별 설정
  colorTolerance: number; // 색상 허용 범위 (기본: 0.1)

  // 레이아웃 설정
  horizontalGap: number; // 테이블 간 최소 수평 간격 추정
  verticalAlignmentTolerance: number; // 수직 정렬 허용 범위
}

export interface CandidateTable {
  node: FrameNode;
  hasTitle: boolean;
  hasColoredHeader: boolean;
  rowCount: number;
  columnCount: number;
  confidence: number; // 0-1, 테이블일 확률
}

/**
 * 테이블 구조 설정 (템플릿)
 */
export interface TableConfig {
  columns: string[]; // ['Field', 'Type', 'Required', 'Description']

  colorScheme: ColorScheme;

  // 레이아웃 설정
  tableWidth: number;
  rowHeight: number;
  horizontalGap: number; // 테이블 간 간격
  verticalGap: number; // 같은 depth의 테이블 간 간격

  // 연결선 표시 여부
  showConnectors: boolean;
  connectorStyle?: {
    color: RGB;
    thickness: number;
    dashed: boolean;
  };
}

/**
 * 기본 색상 상수
 */
export const DEFAULT_COLORS = {
  header: { r: 0.827, g: 0.024, b: 0.267 },      // 진한 핑크 #d30644 (섹션 헤더)
  columnHeader: { r: 0.851, g: 0.851, b: 0.851 },    // 회색 #d9d9d9 (컬럼 헤더)
  data: { r: 0.961, g: 0.984, b: 0.710 },          // 연한 노란색 #F5FBB5 (데이터 행)
} as const;

/**
 * 컬럼별 기본 너비 (픽셀)
 */
export const DEFAULT_COLUMN_WIDTHS: { [key: string]: number } = {
  'Required': 80,
  'Mandatory': 80,
  'Field': 140,
  'Type': 100,
  'Description': 260,
  'Example': 260,
  'Default': 260,
};

/**
 * 기본 설정
 */
export const DEFAULT_TABLE_CONFIG: TableConfig = {
  columns: ['Required', 'Field', 'Type', 'Description', 'Example', 'Default'],
  colorScheme: DEFAULT_COLORS,
  tableWidth: 1100, // 80+140+100+260+260+260
  rowHeight: 36,
  horizontalGap: 100,
  verticalGap: 50,
  showConnectors: true,
  connectorStyle: {
    color: { r: 0.5, g: 0.5, b: 0.5 },
    thickness: 2,
    dashed: true,
  },
};
