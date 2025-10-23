/**
 * JSON Schema를 TypeScript interface로 변환
 */

import { JsonSchema } from '../types/schema';
import { TableHierarchy } from '../types/table';

/**
 * JSON Schema를 TypeScript interface 코드로 변환
 */
export function generateTypeScriptFromSchema(
  schema: JsonSchema,
  options?: {
    interfaceName?: string;
    includeComments?: boolean;
    exportInterfaces?: boolean;
  }
): string {
  const interfaceName = options?.interfaceName || toPascalCase(schema.title || 'Root');
  const includeComments = options?.includeComments !== false;
  const exportInterfaces = options?.exportInterfaces !== false;

  const nestedInterfaces: string[] = [];
  const generatedInterfaces = new Set<string>();

  // 먼저 모든 중첩된 인터페이스 수집
  if (schema.properties) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      collectNestedInterfaces(fieldName, fieldSchema, includeComments, exportInterfaces, generatedInterfaces, nestedInterfaces, '');
    }
  }

  // 메인 인터페이스 생성
  const mainInterface = generateMainInterface(
    interfaceName,
    schema,
    includeComments,
    exportInterfaces,
    generatedInterfaces
  );

  // 중첩된 인터페이스들을 먼저, 메인 인터페이스를 마지막에
  const allInterfaces = [...nestedInterfaces, mainInterface];

  return allInterfaces.join('\n\n');
}

/**
 * TableHierarchy로부터 TypeScript interface 생성
 */
export function generateTypeScriptFromHierarchy(
  hierarchy: TableHierarchy,
  options?: {
    interfaceName?: string;
    includeComments?: boolean;
    exportInterfaces?: boolean;
  }
): string {
  const rootTable = hierarchy.root;
  const interfaceName = options?.interfaceName || rootTable.title || 'Root';

  // TableHierarchy를 JSON Schema로 변환한 후 TypeScript 생성
  // (기존 buildJsonSchema 함수 활용)
  const { buildJsonSchema } = require('../schema/jsonSchemaBuilder');
  const schema = buildJsonSchema(hierarchy, { includeExamples: true });

  return generateTypeScriptFromSchema(schema, options);
}

/**
 * 메인 인터페이스 생성 (중첩 인터페이스는 생성하지 않음)
 */
function generateMainInterface(
  name: string,
  schema: JsonSchema,
  includeComments: boolean,
  exportKeyword: boolean,
  generatedInterfaces: Set<string>
): string {
  const lines: string[] = [];

  // JSDoc 코멘트 추가
  if (includeComments && schema.description) {
    lines.push(`/**`);
    lines.push(` * ${schema.description}`);
    lines.push(` */`);
  }

  // interface 선언
  const exportStr = exportKeyword ? 'export ' : '';
  lines.push(`${exportStr}interface ${name} {`);

  if (schema.type === 'object' && schema.properties) {
    const required = schema.required || [];

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const isRequired = required.includes(fieldName);
      const optional = isRequired ? '' : '?';

      // 필드 코멘트
      if (includeComments && (fieldSchema.description || fieldSchema.examples || fieldSchema.default !== undefined)) {
        lines.push(``); // 빈 줄 추가
        lines.push(`  /**`);
        if (fieldSchema.description) {
          lines.push(`   * ${fieldSchema.description}`);
        }
        if (fieldSchema.examples && fieldSchema.examples.length > 0) {
          lines.push(`   * @example ${JSON.stringify(fieldSchema.examples[0])}`);
        }
        if (fieldSchema.default !== undefined) {
          lines.push(`   * @default ${JSON.stringify(fieldSchema.default)}`);
        }
        lines.push(`   */`);
      }

      // 타입 생성
      const tsType = schemaToTypeScript(fieldName, fieldSchema, generatedInterfaces);
      lines.push(`  ${fieldName}${optional}: ${tsType};`);
    }
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * 중첩 인터페이스 생성 (재귀적으로 호출되지 않음)
 */
function generateNestedInterface(
  name: string,
  schema: JsonSchema,
  includeComments: boolean,
  exportKeyword: boolean
): string {
  const lines: string[] = [];

  // JSDoc 코멘트 추가
  if (includeComments && schema.description) {
    lines.push(`/**`);
    lines.push(` * ${schema.description}`);
    lines.push(` */`);
  }

  // interface 선언
  const exportStr = exportKeyword ? 'export ' : '';
  lines.push(`${exportStr}interface ${name} {`);

  if (schema.type === 'object' && schema.properties) {
    const required = schema.required || [];

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const isRequired = required.includes(fieldName);
      const optional = isRequired ? '' : '?';

      // 필드 코멘트
      if (includeComments && (fieldSchema.description || fieldSchema.examples || fieldSchema.default !== undefined)) {
        lines.push(``); // 빈 줄 추가
        lines.push(`  /**`);
        if (fieldSchema.description) {
          lines.push(`   * ${fieldSchema.description}`);
        }
        if (fieldSchema.examples && fieldSchema.examples.length > 0) {
          lines.push(`   * @example ${JSON.stringify(fieldSchema.examples[0])}`);
        }
        if (fieldSchema.default !== undefined) {
          lines.push(`   * @default ${JSON.stringify(fieldSchema.default)}`);
        }
        lines.push(`   */`);
      }

      // 타입 생성 (generatedInterfaces는 빈 Set 전달)
      const tsType = schemaToTypeScript(fieldName, fieldSchema, new Set());
      lines.push(`  ${fieldName}${optional}: ${tsType};`);
    }
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * 중첩된 인터페이스 수집 (재귀적)
 */
function collectNestedInterfaces(
  fieldName: string,
  schema: JsonSchema,
  includeComments: boolean,
  exportKeyword: boolean,
  generatedInterfaces: Set<string>,
  result: string[],
  indent: string
): void {
  if (schema.type === 'object' && schema.properties) {
    const typeName = toPascalCase(fieldName);
    if (!generatedInterfaces.has(typeName)) {
      generatedInterfaces.add(typeName);

      // 이 인터페이스의 중첩된 인터페이스를 먼저 수집
      for (const [nestedFieldName, nestedFieldSchema] of Object.entries(schema.properties)) {
        collectNestedInterfaces(nestedFieldName, nestedFieldSchema, includeComments, exportKeyword, generatedInterfaces, result, indent);
      }

      // 그 다음 이 인터페이스를 추가
      const nested = generateNestedInterface(typeName, schema, includeComments, exportKeyword);
      result.push(nested);
    }
  } else if (schema.type === 'array' && schema.items) {
    const items = schema.items as JsonSchema;
    if (items.type === 'object' && items.properties) {
      const typeName = toPascalCase(fieldName);
      if (!generatedInterfaces.has(typeName)) {
        generatedInterfaces.add(typeName);

        // 이 인터페이스의 중첩된 인터페이스를 먼저 수집
        for (const [nestedFieldName, nestedFieldSchema] of Object.entries(items.properties)) {
          collectNestedInterfaces(nestedFieldName, nestedFieldSchema, includeComments, exportKeyword, generatedInterfaces, result, indent);
        }

        // 그 다음 이 인터페이스를 추가
        const nested = generateNestedInterface(typeName, items, includeComments, exportKeyword);
        result.push(nested);
      }
    }
  }
}

/**
 * JSON Schema 타입을 TypeScript 타입으로 변환
 */
function schemaToTypeScript(
  fieldName: string,
  schema: JsonSchema,
  generatedInterfaces: Set<string>
): string {
  // object 타입
  if (schema.type === 'object' && schema.properties) {
    const typeName = toPascalCase(fieldName);
    generatedInterfaces.add(typeName);
    return typeName;
  }

  // array 타입
  if (schema.type === 'array' && schema.items) {
    const items = schema.items as JsonSchema;

    if (items.type === 'object' && items.properties) {
      const typeName = toPascalCase(fieldName);
      generatedInterfaces.add(typeName);
      return `${typeName}[]`;
    } else {
      const itemType = primitiveTypeToTypeScript(items.type as string, items.format);
      return `${itemType}[]`;
    }
  }

  // primitive 타입
  return primitiveTypeToTypeScript(schema.type as string, schema.format);
}

/**
 * Primitive 타입 변환
 */
function primitiveTypeToTypeScript(type: string, format?: string): string {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return 'any[]'; // fallback
    case 'object':
      return 'Record<string, any>'; // fallback
    default:
      return 'any';
  }
}

/**
 * fieldName을 PascalCase로 변환
 */
function toPascalCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
