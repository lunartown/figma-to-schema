/**
 * JSON Schema 및 OpenAPI 스키마 타입
 */

import type { OpenAPIV3 } from 'openapi-types';

export type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

/**
 * JSON Schema Draft 7
 */
export interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: JsonSchemaType | JsonSchemaType[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  enum?: any[];
  const?: any;

  // Validation keywords
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;

  // Format
  format?: string;

  // Composition
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;

  // Metadata
  default?: any;
  examples?: any[];

  // Additional
  additionalProperties?: boolean | JsonSchema;
  additionalItems?: boolean | JsonSchema;
}

/**
 * OpenAPI 3.x 문서
 */
export interface OpenApiDocument extends OpenAPIV3.Document {
  // OpenAPI 표준 준수
}

/**
 * Export 옵션
 */
export interface ExportOptions {
  format: 'openapi' | 'json-schema' | 'typescript';
  version?: string; // OpenAPI: '3.0.0' | '3.1.0', JSON Schema: 'draft-07' | '2020-12'
  includeExamples?: boolean;
  prettify?: boolean;
}

/**
 * 변환 결과
 */
export interface ConversionResult {
  success: boolean;
  data?: string; // JSON or TypeScript code
  error?: string;
  warnings?: string[];
}
