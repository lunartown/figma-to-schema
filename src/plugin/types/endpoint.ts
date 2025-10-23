/**
 * API 엔드포인트 구조
 */

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  summary?: string;
  description?: string;
  request?: ApiSchema;
  response?: ApiSchema;
  examples?: {
    request?: any;
    response?: any;
  };
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * API 스키마 (Request/Response 공통)
 */
export interface ApiSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, ApiSchemaProperty>;
  items?: ApiSchemaProperty; // array인 경우
  required?: string[];
  description?: string;
}

export interface ApiSchemaProperty {
  type: string;
  description?: string;
  example?: any;
  required?: boolean;
  properties?: Record<string, ApiSchemaProperty>; // nested object
  items?: ApiSchemaProperty; // array
  enum?: any[];
  format?: string; // date-time, email, uri 등
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/**
 * Depth 기반 필드 (테이블 행과 대응)
 */
export interface DepthField {
  depth: number;
  path: string[]; // ['user', 'address', 'city']
  field: string;
  type: string;
  required: boolean;
  description: string;
  example?: any;
}
