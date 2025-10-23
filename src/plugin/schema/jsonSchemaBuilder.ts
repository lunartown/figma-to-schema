/**
 * 테이블 계층 구조로부터 JSON Schema 생성
 */

import { TableFrame, TableHierarchy, TableRow } from '../types/table';
import { JsonSchema } from '../types/schema';
import { mapType } from '../parser/typeMapper';
import { findChildren } from '../parser/hierarchyBuilder';

/**
 * 테이블 계층으로부터 JSON Schema 생성
 */
export function buildJsonSchema(
  hierarchy: TableHierarchy,
  options?: {
    includeExamples?: boolean;
    schemaVersion?: string;
  }
): JsonSchema {
  const schema: JsonSchema = {
    $schema: options?.schemaVersion || 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: hierarchy.root.title,
    ...buildSchemaFromTable(hierarchy.root, hierarchy, options),
  };

  return schema;
}

/**
 * 테이블로부터 스키마 생성 (재귀)
 */
function buildSchemaFromTable(
  table: TableFrame,
  hierarchy: TableHierarchy,
  options?: { includeExamples?: boolean }
): Partial<JsonSchema> {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const row of table.rows) {
    const fieldSchema = buildSchemaFromRow(row, hierarchy, options);
    properties[row.field] = fieldSchema;

    if (row.required) {
      required.push(row.field);
    }
  }

  const result: Partial<JsonSchema> = {};

  // required를 먼저 추가 (properties보다 앞에)
  if (required.length > 0) {
    result.required = required;
  }

  // properties를 나중에 추가
  result.properties = properties;

  return result;
}

/**
 * 행으로부터 스키마 생성
 */
function buildSchemaFromRow(
  row: TableRow,
  hierarchy: TableHierarchy,
  options?: { includeExamples?: boolean }
): JsonSchema {
  const typeMapping = mapType(row.type);

  const schema: JsonSchema = {
    type: typeMapping.type as any,
  };

  // format 추가
  if (typeMapping.format) {
    schema.format = typeMapping.format;
  }

  // description 추가
  if (row.description) {
    schema.description = row.description;
  }

  // 하위 테이블이 있는 경우 (properties/items를 먼저 추가)
  if (row.hasChildTable && row.childTableId) {
    const childTable = hierarchy.tables.get(row.childTableId);

    if (childTable) {
      // typeMapping.type으로 체크 (원본 row.type이 아닌 변환된 타입)
      if (typeMapping.type === 'object') {
        // object: required를 먼저, properties를 나중에 추가
        const childSchema = buildSchemaFromTable(childTable, hierarchy, options);
        if (childSchema.required) {
          schema.required = childSchema.required;
        }
        schema.properties = childSchema.properties;
      } else if (typeMapping.type === 'array') {
        // array: items 추가
        const childSchema = buildSchemaFromTable(childTable, hierarchy, options);
        schema.items = {
          type: 'object',
          ...childSchema,
        };
      }
    }
  } else if (typeMapping.type === 'array') {
    // primitive 배열 (string[], number[] 등) - child table 없음
    const baseType = row.type.replace(/\[\]$/, '').trim().toLowerCase();
    const baseMapping = mapType(baseType);
    schema.items = {
      type: baseMapping.type as any,
    };
    if (baseMapping.format) {
      (schema.items as any).format = baseMapping.format;
    }
  }

  // default 추가 (examples 전에)
  if (row.default) {
    schema.default = parseExample(row.default);
  }

  // examples를 마지막에 추가
  if (row.example) {
    schema.examples = [parseExample(row.example)];
  }

  return schema;
}

/**
 * example 문자열 파싱
 */
function parseExample(exampleStr: string): any {
  try {
    // JSON 파싱 시도
    return JSON.parse(exampleStr);
  } catch {
    // 실패하면 문자열 그대로 반환
    return exampleStr;
  }
}

/**
 * 특정 섹션(Request/Response)만 스키마 생성
 */
export function buildSchemaForSection(
  table: TableFrame,
  hierarchy: TableHierarchy,
  options?: { includeExamples?: boolean }
): JsonSchema {
  const schema: JsonSchema = {
    type: 'object',
    ...buildSchemaFromTable(table, hierarchy, options),
  };

  return schema;
}
