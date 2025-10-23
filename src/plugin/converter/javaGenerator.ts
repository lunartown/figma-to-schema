/**
 * JSON Schema를 Java class로 변환
 */

import { JsonSchema } from '../types/schema';

/**
 * JSON Schema를 Java class 코드로 변환
 */
export function generateJavaFromSchema(
  schema: JsonSchema,
  options?: {
    className?: string;
    includeComments?: boolean;
    useLombok?: boolean;
  }
): string {
  const className = options?.className || toPascalCase(schema.title || 'Root');
  const includeComments = options?.includeComments !== false;
  const useLombok = options?.useLombok !== false;

  const nestedClasses: string[] = [];
  const generatedClasses = new Set<string>();

  // 먼저 모든 중첩된 클래스 수집
  if (schema.properties) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      collectNestedClasses(fieldName, fieldSchema, includeComments, useLombok, generatedClasses, nestedClasses);
    }
  }

  // 메인 클래스 생성
  const mainClass = generateMainClass(
    className,
    schema,
    includeComments,
    useLombok,
    generatedClasses
  );

  // 중첩된 클래스들을 먼저, 메인 클래스를 마지막에
  const allClasses = [...nestedClasses, mainClass];

  return allClasses.join('\n\n');
}

/**
 * 메인 클래스 생성
 */
function generateMainClass(
  name: string,
  schema: JsonSchema,
  includeComments: boolean,
  useLombok: boolean,
  generatedClasses: Set<string>
): string {
  const lines: string[] = [];

  // 클래스 주석
  if (includeComments && schema.description) {
    lines.push(`/**`);
    lines.push(` * ${schema.description}`);
    lines.push(` */`);
  }

  lines.push(`public class ${name} {`);

  if (schema.type === 'object' && schema.properties) {
    const required = schema.required || [];

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const isRequired = required.includes(fieldName);
      const javaFieldName = toCamelCase(fieldName);

      // 필드 주석
      if (includeComments && (fieldSchema.description || fieldSchema.examples || fieldSchema.default !== undefined)) {
        lines.push(``);
        lines.push(`    /**`);
        if (fieldSchema.description) {
          lines.push(`     * ${fieldSchema.description}`);
        }
        if (fieldSchema.examples && fieldSchema.examples.length > 0) {
          lines.push(`     * Example: ${JSON.stringify(fieldSchema.examples[0])}`);
        }
        if (fieldSchema.default !== undefined) {
          lines.push(`     * Default: ${JSON.stringify(fieldSchema.default)}`);
        }
        lines.push(`     */`);
      }

      // 타입 생성
      const javaType = schemaToJavaType(fieldName, fieldSchema, generatedClasses);
      lines.push(`    private ${javaType} ${javaFieldName};`);
    }
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * 중첩 클래스 생성
 */
function generateNestedClass(
  name: string,
  schema: JsonSchema,
  includeComments: boolean,
  useLombok: boolean
): string {
  const lines: string[] = [];

  // 클래스 주석
  if (includeComments && schema.description) {
    lines.push(`/**`);
    lines.push(` * ${schema.description}`);
    lines.push(` */`);
  }

  lines.push(`public class ${name} {`);

  if (schema.type === 'object' && schema.properties) {
    const required = schema.required || [];

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const javaFieldName = toCamelCase(fieldName);

      // 필드 주석
      if (includeComments && (fieldSchema.description || fieldSchema.examples || fieldSchema.default !== undefined)) {
        lines.push(``);
        lines.push(`    /**`);
        if (fieldSchema.description) {
          lines.push(`     * ${fieldSchema.description}`);
        }
        if (fieldSchema.examples && fieldSchema.examples.length > 0) {
          lines.push(`     * Example: ${JSON.stringify(fieldSchema.examples[0])}`);
        }
        if (fieldSchema.default !== undefined) {
          lines.push(`     * Default: ${JSON.stringify(fieldSchema.default)}`);
        }
        lines.push(`     */`);
      }

      // 타입 생성
      const javaType = schemaToJavaType(fieldName, fieldSchema, new Set());
      lines.push(`    private ${javaType} ${javaFieldName};`);
    }
  }

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * 중첩된 클래스 수집 (재귀적)
 */
function collectNestedClasses(
  fieldName: string,
  schema: JsonSchema,
  includeComments: boolean,
  useLombok: boolean,
  generatedClasses: Set<string>,
  result: string[]
): void {
  if (schema.type === 'object' && schema.properties) {
    const typeName = toPascalCase(fieldName);
    if (!generatedClasses.has(typeName)) {
      generatedClasses.add(typeName);

      // 이 클래스의 중첩된 클래스를 먼저 수집
      for (const [nestedFieldName, nestedFieldSchema] of Object.entries(schema.properties)) {
        collectNestedClasses(nestedFieldName, nestedFieldSchema, includeComments, useLombok, generatedClasses, result);
      }

      // 그 다음 이 클래스를 추가
      const nested = generateNestedClass(typeName, schema, includeComments, useLombok);
      result.push(nested);
    }
  } else if (schema.type === 'array' && schema.items) {
    const items = schema.items as JsonSchema;
    if (items.type === 'object' && items.properties) {
      const typeName = toPascalCase(fieldName);
      if (!generatedClasses.has(typeName)) {
        generatedClasses.add(typeName);

        // 이 클래스의 중첩된 클래스를 먼저 수집
        for (const [nestedFieldName, nestedFieldSchema] of Object.entries(items.properties)) {
          collectNestedClasses(nestedFieldName, nestedFieldSchema, includeComments, useLombok, generatedClasses, result);
        }

        // 그 다음 이 클래스를 추가
        const nested = generateNestedClass(typeName, items, includeComments, useLombok);
        result.push(nested);
      }
    }
  }
}

/**
 * JSON Schema 타입을 Java 타입으로 변환
 */
function schemaToJavaType(
  fieldName: string,
  schema: JsonSchema,
  generatedClasses: Set<string>
): string {
  // object 타입
  if (schema.type === 'object' && schema.properties) {
    const typeName = toPascalCase(fieldName);
    generatedClasses.add(typeName);
    return typeName;
  }

  // array 타입
  if (schema.type === 'array' && schema.items) {
    const items = schema.items as JsonSchema;

    if (items.type === 'object' && items.properties) {
      const typeName = toPascalCase(fieldName);
      generatedClasses.add(typeName);
      return `List<${typeName}>`;
    } else {
      const itemType = primitiveTypeToJava(items.type as string, items.format);
      return `List<${itemType}>`;
    }
  }

  // primitive 타입
  return primitiveTypeToJava(schema.type as string, schema.format);
}

/**
 * Primitive 타입 변환
 */
function primitiveTypeToJava(type: string, format?: string): string {
  switch (type) {
    case 'string':
      return 'String';
    case 'number':
      return 'Double';
    case 'integer':
      return 'Long';
    case 'boolean':
      return 'Boolean';
    case 'null':
      return 'Object';
    case 'array':
      return 'List<Object>';
    case 'object':
      return 'Map<String, Object>';
    default:
      return 'Object';
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

/**
 * fieldName을 camelCase로 변환
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
