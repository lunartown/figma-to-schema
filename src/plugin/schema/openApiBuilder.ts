/**
 * 테이블 계층 구조로부터 OpenAPI 3.x 문서 생성
 */

import { TableHierarchy } from '../types/table';
import { OpenApiDocument } from '../types/schema';
import { buildSchemaForSection } from './jsonSchemaBuilder';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * 여러 테이블 계층으로부터 OpenAPI 문서 생성
 */
export function buildOpenApiDocument(
  hierarchies: TableHierarchy[],
  options?: {
    title?: string;
    version?: string;
    description?: string;
    serverUrl?: string;
  }
): OpenApiDocument {
  const paths: OpenAPIV3.PathsObject = {};

  for (const hierarchy of hierarchies) {
    const endpoint = hierarchy.root.endpoint;

    if (!endpoint) {
      console.warn('Hierarchy root has no endpoint info, skipping');
      continue;
    }

    const path = endpoint.path;
    const method = endpoint.method.toLowerCase() as Lowercase<typeof endpoint.method>;

    if (!paths[path]) {
      paths[path] = {};
    }

    // Operation 생성
    const operation = buildOperation(hierarchy, options);
    paths[path][method] = operation;
  }

  const doc: OpenApiDocument = {
    openapi: '3.0.0',
    info: {
      title: options?.title || 'API Documentation',
      version: options?.version || '1.0.0',
      description: options?.description,
    },
    paths,
  };

  if (options?.serverUrl) {
    doc.servers = [
      {
        url: options.serverUrl,
      },
    ];
  }

  return doc;
}

/**
 * Operation 생성 (하나의 엔드포인트)
 */
function buildOperation(
  hierarchy: TableHierarchy,
  options?: any
): OpenAPIV3.OperationObject {
  const root = hierarchy.root;
  const method = root.endpoint!.method;

  const operation: OpenAPIV3.OperationObject = {
    summary: root.title || `${method} ${root.endpoint!.path}`,
    responses: {},
  };

  // Request Body (POST, PUT, PATCH)
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const requestSchema = buildSchemaForSection(root, hierarchy, {
      includeExamples: true,
    });

    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: requestSchema as any,
        },
      },
    };
  }

  // Response (200 OK)
  const responseSchema = buildSchemaForSection(root, hierarchy, {
    includeExamples: true,
  });

  operation.responses['200'] = {
    description: 'Successful response',
    content: {
      'application/json': {
        schema: responseSchema as any,
      },
    },
  };

  return operation;
}

/**
 * 단일 테이블 계층에서 OpenAPI PathItem 생성
 */
export function buildPathItem(hierarchy: TableHierarchy): OpenAPIV3.PathItemObject {
  const root = hierarchy.root;

  if (!root.endpoint) {
    throw new Error('Root table must have endpoint info');
  }

  const method = root.endpoint.method.toLowerCase() as Lowercase<typeof root.endpoint.method>;

  const pathItem: OpenAPIV3.PathItemObject = {};

  const operation = buildOperation(hierarchy);
  pathItem[method] = operation;

  return pathItem;
}
