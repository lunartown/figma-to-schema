/**
 * JSON Schema를 PostgreSQL DDL로 변환
 */

import { JsonSchema } from '../types/schema';

/**
 * JSON Schema를 PostgreSQL DDL로 변환
 */
export function generatePostgreSQLFromSchema(
  schema: JsonSchema,
  options?: {
    tableName?: string;
    includeComments?: boolean;
  }
): string {
  const tableName = options?.tableName || toSnakeCase(schema.title || 'root_table');
  const includeComments = options?.includeComments !== false;

  const tables: string[] = [];
  const processedTables = new Set<string>();

  // 메인 테이블과 중첩 테이블 생성
  if (schema.type === 'object' && schema.properties) {
    const mainTable = generateTable(
      tableName,
      schema,
      includeComments,
      processedTables,
      tables
    );
    tables.unshift(mainTable); // 메인 테이블을 맨 앞에
  }

  return tables.join('\n\n');
}

/**
 * 테이블 DDL 생성
 */
function generateTable(
  tableName: string,
  schema: JsonSchema,
  includeComments: boolean,
  processedTables: Set<string>,
  allTables: string[]
): string {
  if (processedTables.has(tableName)) {
    return '';
  }
  processedTables.add(tableName);

  const lines: string[] = [];
  const columnDefs: Array<{name: string, type: string, nullable: string, default: string, comment: string}> = [];
  const primaryKey: string[] = [];

  // 테이블 주석
  if (includeComments && schema.description) {
    lines.push(`-- ${schema.description}`);
  }

  lines.push(`CREATE TABLE "${tableName}"`)
  lines.push(`(`);

  // ID 컬럼 자동 추가
  columnDefs.push({
    name: '"id"',
    type: 'BIGSERIAL',
    nullable: '',
    default: '',
    comment: ''
  });
  primaryKey.push('id');

  if (schema.type === 'object' && schema.properties) {
    const required = schema.required || [];

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const columnName = toSnakeCase(fieldName);
      const isRequired = required.includes(fieldName);

      // object나 array는 별도 테이블로 분리
      if (fieldSchema.type === 'object' && fieldSchema.properties) {
        // 외래키로 연결
        const refTableName = toSnakeCase(fieldName);
        const fkColumn = `${refTableName}_id`;

        columnDefs.push({
          name: `"${fkColumn}"`,
          type: 'BIGINT',
          nullable: isRequired ? 'NOT NULL' : 'NULL',
          default: '',
          comment: ''
        });

        // 중첩 테이블 생성
        const childTable = generateTable(
          refTableName,
          fieldSchema,
          includeComments,
          processedTables,
          allTables
        );
        if (childTable) {
          allTables.push(childTable);
        }
      } else if (fieldSchema.type === 'array' && fieldSchema.items) {
        const items = fieldSchema.items as JsonSchema;

        if (items.type === 'object' && items.properties) {
          // 1:N 관계 - 중간 테이블 생성
          const refTableName = toSnakeCase(fieldName);

          const childTable = generateTable(
            refTableName,
            items,
            includeComments,
            processedTables,
            allTables
          );
          if (childTable) {
            allTables.push(childTable);
          }

          // 중간 테이블에 parent_id 외래키 추가됨 (아래에서 처리)
        } else {
          // primitive 배열은 JSON 컬럼으로 저장
          columnDefs.push({
            name: `"${columnName}"`,
            type: 'JSONB',
            nullable: '',
            default: '',
            comment: ''
          });
        }
      } else {
        // 일반 컬럼
        const sqlType = jsonTypeToPostgreSQLType(fieldSchema);

        let defaultVal = '';
        if (fieldSchema.default !== undefined) {
          const formattedDefault = formatDefaultValue(fieldSchema.default, fieldSchema.type as string);
          if (formattedDefault !== null) {
            defaultVal = `DEFAULT ${formattedDefault}`;
          }
        }

        columnDefs.push({
          name: `"${columnName}"`,
          type: sqlType,
          nullable: isRequired ? 'NOT NULL' : 'NULL',
          default: defaultVal,
          comment: ''
        });
      }
    }
  }

  // 정렬을 위한 최대 길이 계산
  const maxNameLen = Math.max(...columnDefs.map(c => c.name.length));
  const maxTypeLen = Math.max(...columnDefs.map(c => c.type.length));
  const maxNullableLen = Math.max(...columnDefs.map(c => c.nullable.length));
  const maxDefaultLen = Math.max(...columnDefs.map(c => c.default.length));

  // 컬럼 정의 포맷팅
  const formattedColumns = columnDefs.map((col, idx) => {
    // 실제 값이 있는 부분만 모으기
    const parts = [];
    parts.push('    ' + col.name.padEnd(maxNameLen));
    parts.push(col.type.padEnd(maxTypeLen));
    if (col.nullable) parts.push(col.nullable.padEnd(maxNullableLen));
    if (col.default) parts.push(col.default.padEnd(maxDefaultLen));
    if (col.comment) parts.push(col.comment);

    const line = parts.join(' ');
    // 마지막이 아니면 콤마 추가
    return idx < columnDefs.length - 1 ? line + ',' : line;
  });

  // PRIMARY KEY
  formattedColumns.push(`    PRIMARY KEY ("${primaryKey.join('", "')}")`);

  lines.push(formattedColumns.join('\n'));
  lines.push(`);`);

  return lines.join('\n');
}

/**
 * JSON Schema 타입을 PostgreSQL 타입으로 변환
 */
function jsonTypeToPostgreSQLType(schema: JsonSchema): string {
  const type = schema.type as string;

  switch (type) {
    case 'string':
      if (schema.format === 'date') {
        return 'DATE';
      } else if (schema.format === 'date-time') {
        return 'TIMESTAMP';
      } else if (schema.format === 'email') {
        return 'VARCHAR(255)';
      } else if (schema.format === 'uri' || schema.format === 'url') {
        return 'VARCHAR(2048)';
      } else if (schema.maxLength && schema.maxLength <= 255) {
        return `VARCHAR(${schema.maxLength})`;
      } else {
        return 'TEXT';
      }

    case 'number':
      return 'DOUBLE PRECISION';

    case 'integer':
      return 'BIGINT';

    case 'boolean':
      return 'BOOLEAN';

    case 'array':
      return 'JSONB';

    case 'object':
      return 'JSONB';

    default:
      return 'TEXT';
  }
}

/**
 * 기본값 포맷팅
 */
function formatDefaultValue(value: any, type: string): string | null {
  if (value === null) {
    return 'NULL';
  }

  switch (type) {
    case 'string':
      return `'${String(value).replace(/'/g, "\\'")}'`;
    case 'number':
    case 'integer':
      return String(value);
    case 'boolean':
      return value ? '1' : '0';
    default:
      return null;
  }
}

/**
 * PascalCase/camelCase를 snake_case로 변환
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/\s+/g, '_')  // 공백을 언더스코어로
    .replace(/([a-z])([A-Z])/g, '$1_$2')  // camelCase 처리
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')  // PascalCase 처리
    .replace(/[_-]+/g, '_')  // 중복 언더스코어 제거
    .replace(/^_/, '')  // 시작 언더스코어 제거
    .replace(/_$/, '')  // 끝 언더스코어 제거
    .toLowerCase();
}
