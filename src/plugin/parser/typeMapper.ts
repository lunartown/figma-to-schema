/**
 * 피그마 Type 컬럼 값을 JSON Schema 타입으로 매핑
 */

export interface TypeMapping {
  type: string;
  format?: string;
}

/**
 * 타입 매핑 테이블
 */
const TYPE_MAP: Record<string, TypeMapping> = {
  'string': { type: 'string' },
  'str': { type: 'string' },
  'text': { type: 'string' },

  'number': { type: 'number' },
  'num': { type: 'number' },
  'float': { type: 'number' },
  'double': { type: 'number' },

  'integer': { type: 'integer' },
  'int': { type: 'integer' },
  'long': { type: 'integer' },

  'boolean': { type: 'boolean' },
  'bool': { type: 'boolean' },

  'object': { type: 'object' },
  'obj': { type: 'object' },

  'array': { type: 'array' },
  'arr': { type: 'array' },
  'list': { type: 'array' },

  'date': { type: 'string', format: 'date-time' },
  'datetime': { type: 'string', format: 'date-time' },
  'timestamp': { type: 'string', format: 'date-time' },

  'email': { type: 'string', format: 'email' },
  'uri': { type: 'string', format: 'uri' },
  'url': { type: 'string', format: 'uri' },
  'uuid': { type: 'string', format: 'uuid' },

  'null': { type: 'null' },
};

/**
 * 피그마 Type 컬럼 값을 JSON Schema 타입으로 변환
 */
export function mapType(figmaType: string): TypeMapping {
  const trimmed = figmaType.trim();
  const normalized = trimmed.toLowerCase();

  // 1. 기본 타입 맵에서 찾기
  const mapping = TYPE_MAP[normalized];
  if (mapping) {
    return mapping;
  }

  // 2. 배열 표기 제거 (Permissions[] -> Permissions, string[] -> string)
  const typeWithoutArray = trimmed.replace(/\[\]$/, '');
  const normalizedWithoutArray = typeWithoutArray.toLowerCase();

  // 3. primitive 배열 타입 (string[], number[], boolean[] 등)
  if (trimmed.endsWith('[]')) {
    const baseMapping = TYPE_MAP[normalizedWithoutArray];
    if (baseMapping) {
      // primitive 배열: string[] -> array
      return { type: 'array' };
    }
  }

  // 4. PascalCase 커스텀 타입 (첫 글자 대문자) -> object 또는 array
  if (typeWithoutArray.length > 0 && /^[A-Z]/.test(typeWithoutArray)) {
    // 원래 타입이 []로 끝나면 array, 아니면 object
    if (trimmed.endsWith('[]')) {
      return { type: 'array' };
    } else {
      return { type: 'object' };
    }
  }

  // 5. 폴백: 알 수 없는 타입은 string으로
  console.warn(`Unknown type: ${figmaType}, falling back to 'string'`);
  return { type: 'string' };
}

/**
 * Required 컬럼 값을 boolean으로 변환
 */
export function parseRequiredValue(value: string | boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = value.toLowerCase().trim();

  const trueValues = ['true', 'yes', 'y', 'o', '✓', '✔', '●', '⬤', '•', '1', 'required'];
  const falseValues = ['false', 'no', 'n', 'x', '✗', '✘', '○', '◯', '0', 'optional', 'null', ''];

  if (trueValues.includes(normalized)) {
    return true;
  }

  if (falseValues.includes(normalized)) {
    return false;
  }

  // 기본값: false (optional)
  return false;
}

/**
 * 타입이 확장 가능한 타입인지 (object, array, 또는 커스텀 타입)
 *
 * 확장 가능한 타입:
 * - 기본: 'object', 'array'
 * - PascalCase 커스텀 타입: 'Profile', 'UserData' (첫 글자 대문자)
 * - 배열 표기: 'Profile[]', 'Permission[]'
 */
export function isExpandableType(type: string): boolean {
  const trimmed = type.trim();
  const normalized = trimmed.toLowerCase();

  // 기본 타입 체크
  if (normalized === 'object' || normalized === 'array') {
    return true;
  }

  // 배열 표기 제거 (Permissions[] -> Permissions)
  const typeWithoutArray = trimmed.replace(/\[\]$/, '');

  // PascalCase 타입 체크 (첫 글자가 대문자면 커스텀 타입으로 간주)
  if (typeWithoutArray.length > 0 && /^[A-Z]/.test(typeWithoutArray)) {
    return true;
  }

  return false;
}

/**
 * HTTP 메서드 정규화
 */
export function normalizeHttpMethod(method: string): 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' {
  const normalized = method.toUpperCase().trim();
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

  if (validMethods.includes(normalized as any)) {
    return normalized as any;
  }

  throw new Error(`Invalid HTTP method: ${method}`);
}
