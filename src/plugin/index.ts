/**
 * 피그마 플러그인 메인 엔트리포인트
 */

// __html__ 전역 변수 선언 (webpack DefinePlugin으로 주입됨)
declare const __html__: string;

import * as yaml from 'js-yaml';
import { findAllTableFrames, parseTableFrame } from './parser/tableParser';
import { buildHierarchy } from './parser/hierarchyBuilder';
import { buildJsonSchema } from './schema/jsonSchemaBuilder';
import { buildOpenApiDocument } from './schema/openApiBuilder';
import { generateTypeScriptFromSchema } from './converter/typescriptGenerator';
import { generateJavaFromSchema } from './converter/javaGenerator';
import { generateMySQLFromSchema } from './converter/mysqlGenerator';
import { generatePostgreSQLFromSchema } from './converter/postgresGenerator';
import { generateOracleFromSchema } from './converter/oracleGenerator';
import {
  generateTablesFromSchema,
  calculateTableLayout,
} from './generator/tableGenerator';
import { createMultipleTableFrames } from './generator/frameBuilder';
import { JsonSchema } from './types/schema';

// 플러그인 시작 로그
console.log('=== Figma to JSON Schema Plugin Starting ===');
console.log('Plugin loaded successfully');

// UI 표시
figma.showUI(__html__, { width: 500, height: 700 });
console.log('UI shown');

// UI로부터 메시지 수신
figma.ui.onmessage = async (msg) => {
  try {
    switch (msg.type) {
      case 'parse-selection':
        await handleParseSelection();
        break;

      case 'generate-json-schema':
        await handleGenerateJsonSchema(msg.options);
        break;

      case 'generate-openapi':
        await handleGenerateOpenApi(msg.options);
        break;

      case 'generate-typescript':
        await handleGenerateTypeScript(msg.options);
        break;

      case 'generate-java':
        await handleGenerateJava(msg.options);
        break;

      case 'generate-mysql':
        await handleGenerateMySQL(msg.options);
        break;

      case 'generate-postgres':
        await handleGeneratePostgreSQL(msg.options);
        break;

      case 'generate-oracle':
        await handleGenerateOracle(msg.options);
        break;

      case 'import-schema':
        await handleImportSchema(msg.schema, msg.options);
        break;

      case 'close':
        figma.closePlugin();
        break;

      default:
        figma.ui.postMessage({
          type: 'error',
          message: `Unknown message type: ${msg.type}`,
        });
    }
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * 선택된 노드 파싱
 */
async function handleParseSelection() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'error',
      message: '테이블이 포함된 Frame/Section을 선택하거나 테이블을 직접 선택해주세요.',
    });
    return;
  }

  // 선택된 노드들에서 테이블 찾기
  const tables = [];

  for (const node of selection) {
    if (node.type === 'FRAME' || node.type === 'SECTION') {
      // Frame/Section 자체가 테이블인지 확인
      if (node.type === 'FRAME') {
        const table = parseTableFrame(node);
        if (table) {
          tables.push(table);
        }
      }

      // Frame/Section 내부의 모든 테이블 찾기
      if ('children' in node) {
        const childTables = findAllTableFrames(node as FrameNode | SectionNode);
        tables.push(...childTables);
      }
    }
  }

  if (tables.length === 0) {
    figma.ui.postMessage({
      type: 'error',
      message: '선택한 영역에서 테이블을 찾을 수 없습니다.',
    });
    return;
  }

  console.log(`Found ${tables.length} tables in selection`);
  tables.forEach(t => console.log(`- ${t.title || 'Untitled'} (${t.rows.length} rows)`));

  figma.ui.postMessage({
    type: 'parse-success',
    tables: tables.map((t) => ({
      id: t.id,
      title: t.title,
      endpoint: t.endpoint,
      rowCount: t.rows.length,
    })),
  });
}

/**
 * JSON Schema 생성
 */
async function handleGenerateJsonSchema(options: any) {
  try {
    const selection = figma.currentPage.selection;
    let allTables = [];

    // 선택된 영역이 있으면 그 안에서만 테이블 찾기
    if (selection.length > 0) {
      for (const node of selection) {
        if (node.type === 'FRAME' || node.type === 'SECTION') {
          if (node.type === 'FRAME') {
            const table = parseTableFrame(node);
            if (table) {
              allTables.push(table);
            }
          }
          if ('children' in node) {
            const childTables = findAllTableFrames(node as FrameNode | SectionNode);
            allTables.push(...childTables);
          }
        }
      }
    } else {
      // 선택 없으면 전체 페이지
      allTables = findAllTableFrames(figma.currentPage);
    }

    if (allTables.length === 0) {
      throw new Error('테이블을 찾을 수 없습니다. Frame/Section을 선택하거나 테이블을 직접 선택해주세요.');
    }

    // 루트 테이블 찾기: 엔드포인트가 있거나, 가장 왼쪽 테이블
    let rootTable = allTables.find((t) => t.endpoint);
    if (!rootTable) {
      // 엔드포인트 없으면 가장 왼쪽(x가 가장 작은) 테이블을 루트로
      rootTable = allTables.reduce((leftmost, current) =>
        current.position.x < leftmost.position.x ? current : leftmost
      );
      console.log(`No endpoint found, using leftmost table as root: ${rootTable.title}`);
    }

    const relatedTables = findRelatedTables(rootTable, allTables);

    // 계층 구조 빌드
    const hierarchy = buildHierarchy(relatedTables);

    if (!hierarchy) {
      throw new Error('계층 구조를 생성할 수 없습니다.');
    }

    // JSON Schema 생성
    const schema = buildJsonSchema(hierarchy, {
      includeExamples: options?.includeExamples ?? true,
      schemaVersion: options?.schemaVersion,
    });

    // 포맷에 따라 JSON 또는 YAML로 변환
    let data: string;
    if (options?.format === 'yaml') {
      data = yaml.dump(schema, { indent: 2, lineWidth: -1 });
    } else {
      data = JSON.stringify(schema, null, 2);
    }

    // UI로 결과 전송
    figma.ui.postMessage({
      type: 'schema-generated',
      format: 'json-schema',
      data: data,
    });
  } catch (error) {
    throw error;
  }
}

/**
 * 특정 루트 테이블과 관련된 모든 테이블 찾기 (타입 이름 기반 재귀 검색)
 */
function findRelatedTables(rootTable: any, allTables: any[]): any[] {
  const related = new Set<string>(); // 테이블 ID로 중복 방지
  const relatedTables: any[] = [];

  // 테이블 title로 맵 생성
  const tablesByTitle = new Map<string, any>();
  for (const table of allTables) {
    if (table.title) {
      tablesByTitle.set(table.title, table);
    }
  }

  // 재귀적으로 관련 테이블 찾기
  function findChildren(table: any) {
    if (related.has(table.id)) return; // 이미 처리됨

    related.add(table.id);
    relatedTables.push(table);

    // 이 테이블의 모든 row에서 참조하는 타입 찾기
    for (const row of table.rows) {
      // 배열 표기 제거
      const typeName = row.type.replace(/\[\]$/, '').trim();

      // PascalCase 타입 체크 (커스텀 타입)
      if (typeName.length > 0 && /^[A-Z]/.test(typeName)) {
        const childTable = tablesByTitle.get(typeName);
        if (childTable && !related.has(childTable.id)) {
          findChildren(childTable); // 재귀 호출
        }
      }
    }
  }

  findChildren(rootTable);

  return relatedTables;
}

/**
 * TypeScript interface 생성
 */
async function handleGenerateTypeScript(options: any) {
  try {
    const selection = figma.currentPage.selection;
    let allTables = [];

    // 선택된 영역이 있으면 그 안에서만 테이블 찾기
    if (selection.length > 0) {
      for (const node of selection) {
        if (node.type === 'FRAME' || node.type === 'SECTION') {
          if (node.type === 'FRAME') {
            const table = parseTableFrame(node);
            if (table) {
              allTables.push(table);
            }
          }
          if ('children' in node) {
            const childTables = findAllTableFrames(node as FrameNode | SectionNode);
            allTables.push(...childTables);
          }
        }
      }
    } else {
      // 선택 없으면 전체 페이지
      allTables = findAllTableFrames(figma.currentPage);
    }

    if (allTables.length === 0) {
      throw new Error('테이블을 찾을 수 없습니다. Frame/Section을 선택하거나 테이블을 직접 선택해주세요.');
    }

    // 루트 테이블 찾기
    let rootTable = allTables.find((t) => t.endpoint);
    if (!rootTable) {
      rootTable = allTables.reduce((leftmost, current) =>
        current.position.x < leftmost.position.x ? current : leftmost
      );
    }

    const relatedTables = findRelatedTables(rootTable, allTables);

    // 계층 구조 빌드
    const hierarchy = buildHierarchy(relatedTables);

    if (!hierarchy) {
      throw new Error('계층 구조를 생성할 수 없습니다.');
    }

    // JSON Schema 생성
    const schema = buildJsonSchema(hierarchy, {
      includeExamples: true,
    });

    // TypeScript interface 생성
    const typescript = generateTypeScriptFromSchema(schema, {
      includeComments: options?.includeComments ?? true,
      exportInterfaces: options?.exportInterfaces ?? true,
    });

    // UI로 결과 전송
    figma.ui.postMessage({
      type: 'schema-generated',
      format: 'typescript',
      data: typescript,
      title: schema.title || 'Model',
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Java 클래스 생성
 */
async function handleGenerateJava(options: any) {
  try {
    const selection = figma.currentPage.selection;
    let allTables = [];

    // 선택된 영역이 있으면 그 안에서만 테이블 찾기
    if (selection.length > 0) {
      for (const node of selection) {
        if (node.type === 'FRAME' || node.type === 'SECTION') {
          if (node.type === 'FRAME') {
            const table = parseTableFrame(node);
            if (table) {
              allTables.push(table);
            }
          }
          if ('children' in node) {
            const childTables = findAllTableFrames(node as FrameNode | SectionNode);
            allTables.push(...childTables);
          }
        }
      }
    } else {
      // 선택 없으면 전체 페이지
      allTables = findAllTableFrames(figma.currentPage);
    }

    if (allTables.length === 0) {
      throw new Error('테이블을 찾을 수 없습니다. Frame/Section을 선택하거나 테이블을 직접 선택해주세요.');
    }

    // 루트 테이블 찾기
    let rootTable = allTables.find((t) => t.endpoint);
    if (!rootTable) {
      rootTable = allTables.reduce((leftmost, current) =>
        current.position.x < leftmost.position.x ? current : leftmost
      );
    }

    const relatedTables = findRelatedTables(rootTable, allTables);

    // 계층 구조 빌드
    const hierarchy = buildHierarchy(relatedTables);

    if (!hierarchy) {
      throw new Error('계층 구조를 생성할 수 없습니다.');
    }

    // JSON Schema 생성
    const schema = buildJsonSchema(hierarchy, {
      includeExamples: true,
    });

    // Java 클래스 생성
    const java = generateJavaFromSchema(schema, {
      includeComments: options?.includeComments ?? true,
      useLombok: true,
    });

    // UI로 결과 전송
    figma.ui.postMessage({
      type: 'schema-generated',
      format: 'java',
      data: java,
      title: schema.title || 'Model',
    });
  } catch (error) {
    throw error;
  }
}

/**
 * MySQL DDL 생성
 */
async function handleGenerateMySQL(options: any) {
  try {
    const selection = figma.currentPage.selection;
    let allTables = [];

    // 선택된 영역이 있으면 그 안에서만 테이블 찾기
    if (selection.length > 0) {
      for (const node of selection) {
        if (node.type === 'FRAME' || node.type === 'SECTION') {
          if (node.type === 'FRAME') {
            const table = parseTableFrame(node);
            if (table) {
              allTables.push(table);
            }
          }
          if ('children' in node) {
            const childTables = findAllTableFrames(node as FrameNode | SectionNode);
            allTables.push(...childTables);
          }
        }
      }
    } else {
      // 선택 없으면 전체 페이지
      allTables = findAllTableFrames(figma.currentPage);
    }

    if (allTables.length === 0) {
      throw new Error('테이블을 찾을 수 없습니다. Frame/Section을 선택하거나 테이블을 직접 선택해주세요.');
    }

    // 루트 테이블 찾기
    let rootTable = allTables.find((t) => t.endpoint);
    if (!rootTable) {
      rootTable = allTables.reduce((leftmost, current) =>
        current.position.x < leftmost.position.x ? current : leftmost
      );
    }

    const relatedTables = findRelatedTables(rootTable, allTables);

    // 계층 구조 빌드
    const hierarchy = buildHierarchy(relatedTables);

    if (!hierarchy) {
      throw new Error('계층 구조를 생성할 수 없습니다.');
    }

    // JSON Schema 생성
    const schema = buildJsonSchema(hierarchy, {
      includeExamples: true,
    });

    // MySQL DDL 생성
    const mysql = generateMySQLFromSchema(schema, {
      includeComments: options?.includeComments ?? true,
      engine: options?.engine || 'InnoDB',
      charset: options?.charset || 'utf8mb4',
    });

    // UI로 결과 전송
    figma.ui.postMessage({
      type: 'schema-generated',
      format: 'mysql',
      data: mysql,
    });
  } catch (error) {
    throw error;
  }
}

/**
 * PostgreSQL DDL 생성
 */
async function handleGeneratePostgreSQL(options: any) {
  try {
    const selection = figma.currentPage.selection;
    let allTables = [];

    // 선택된 영역이 있으면 그 안에서만 테이블 찾기
    if (selection.length > 0) {
      for (const node of selection) {
        if (node.type === 'FRAME' || node.type === 'SECTION') {
          if (node.type === 'FRAME') {
            const table = parseTableFrame(node);
            if (table) {
              allTables.push(table);
            }
          }
          if ('children' in node) {
            const childTables = findAllTableFrames(node as FrameNode | SectionNode);
            allTables.push(...childTables);
          }
        }
      }
    } else {
      // 선택 없으면 전체 페이지
      allTables = findAllTableFrames(figma.currentPage);
    }

    if (allTables.length === 0) {
      throw new Error('테이블을 찾을 수 없습니다. Frame/Section을 선택하거나 테이블을 직접 선택해주세요.');
    }

    // 루트 테이블 찾기
    let rootTable = allTables.find((t) => t.endpoint);
    if (!rootTable) {
      rootTable = allTables.reduce((leftmost, current) =>
        current.position.x < leftmost.position.x ? current : leftmost
      );
    }

    const relatedTables = findRelatedTables(rootTable, allTables);

    // 계층 구조 빌드
    const hierarchy = buildHierarchy(relatedTables);

    if (!hierarchy) {
      throw new Error('계층 구조를 생성할 수 없습니다.');
    }

    // JSON Schema 생성
    const schema = buildJsonSchema(hierarchy, {
      includeExamples: true,
    });

    // PostgreSQL DDL 생성
    const postgres = generatePostgreSQLFromSchema(schema, {
      includeComments: options?.includeComments ?? true,
    });

    // UI로 결과 전송
    figma.ui.postMessage({
      type: 'schema-generated',
      format: 'postgres',
      data: postgres,
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Oracle DDL 생성
 */
async function handleGenerateOracle(options: any) {
  try {
    const selection = figma.currentPage.selection;
    let allTables = [];

    // 선택된 영역이 있으면 그 안에서만 테이블 찾기
    if (selection.length > 0) {
      for (const node of selection) {
        if (node.type === 'FRAME' || node.type === 'SECTION') {
          if (node.type === 'FRAME') {
            const table = parseTableFrame(node);
            if (table) {
              allTables.push(table);
            }
          }
          if ('children' in node) {
            const childTables = findAllTableFrames(node as FrameNode | SectionNode);
            allTables.push(...childTables);
          }
        }
      }
    } else {
      // 선택 없으면 전체 페이지
      allTables = findAllTableFrames(figma.currentPage);
    }

    if (allTables.length === 0) {
      throw new Error('테이블을 찾을 수 없습니다. Frame/Section을 선택하거나 테이블을 직접 선택해주세요.');
    }

    // 루트 테이블 찾기
    let rootTable = allTables.find((t) => t.endpoint);
    if (!rootTable) {
      rootTable = allTables.reduce((leftmost, current) =>
        current.position.x < leftmost.position.x ? current : leftmost
      );
    }

    const relatedTables = findRelatedTables(rootTable, allTables);

    // 계층 구조 빌드
    const hierarchy = buildHierarchy(relatedTables);

    if (!hierarchy) {
      throw new Error('계층 구조를 생성할 수 없습니다.');
    }

    // JSON Schema 생성
    const schema = buildJsonSchema(hierarchy, {
      includeExamples: true,
    });

    // Oracle DDL 생성
    const oracle = generateOracleFromSchema(schema, {
      includeComments: options?.includeComments ?? true,
    });

    // UI로 결과 전송
    figma.ui.postMessage({
      type: 'schema-generated',
      format: 'oracle',
      data: oracle,
    });
  } catch (error) {
    throw error;
  }
}

/**
 * OpenAPI 문서 생성
 */
async function handleGenerateOpenApi(options: any) {
  try {
    // 현재 페이지의 모든 테이블 찾기
    const allTables = findAllTableFrames(figma.currentPage);

    if (allTables.length === 0) {
      throw new Error('테이블을 찾을 수 없습니다.');
    }

    // 엔드포인트별로 계층 구조 빌드
    const rootTables = allTables.filter((t) => t.endpoint);

    if (rootTables.length === 0) {
      throw new Error('엔드포인트 정보가 있는 테이블을 찾을 수 없습니다.');
    }

    const hierarchies = [];

    for (const rootTable of rootTables) {
      // 해당 엔드포인트와 관련된 테이블들 찾기
      const relatedTables = findRelatedTables(rootTable, allTables);

      const hierarchy = buildHierarchy(relatedTables);
      if (hierarchy) {
        hierarchies.push(hierarchy);
      }
    }

    // OpenAPI 문서 생성
    const openApiDoc = buildOpenApiDocument(hierarchies, {
      title: options?.title || 'API Documentation',
      version: options?.version || '1.0.0',
      description: options?.description,
      serverUrl: options?.serverUrl,
    });

    // UI로 결과 전송
    figma.ui.postMessage({
      type: 'schema-generated',
      format: 'openapi',
      data: JSON.stringify(openApiDoc, null, 2),
    });
  } catch (error) {
    throw error;
  }
}

/**
 * JSON Schema로부터 테이블 생성
 */
async function handleImportSchema(schemaText: string, options: any) {
  try {
    console.log('Received schema text:', schemaText);
    console.log('Schema text length:', schemaText.length);
    console.log('First 100 chars:', schemaText.substring(0, 100));

    // JSON 파싱
    const schema: JsonSchema = JSON.parse(schemaText);
    console.log('Parsed schema:', schema);

    // 테이블 생성
    const tables = generateTablesFromSchema(schema, {
      endpoint: options?.endpoint,
      title: options?.title,
    });

    // 선택된 Frame/Section이 있으면 그 위치를 기준으로 생성
    const selection = figma.currentPage.selection;
    let baseX = 0;
    let baseY = 0;
    let targetParent: BaseNode & ChildrenMixin = figma.currentPage;

    if (selection.length > 0) {
      const selectedNode = selection[0];

      // Frame/Section 내부에 생성
      if ((selectedNode.type === 'FRAME' || selectedNode.type === 'SECTION') && 'children' in selectedNode) {
        targetParent = selectedNode as FrameNode | SectionNode;
        baseX = 0;
        baseY = 0;
        console.log(`Generating tables inside selected ${selectedNode.type}: ${selectedNode.name}`);
      } else {
        // 선택된 노드 옆에 생성
        baseX = selectedNode.x + (selectedNode.width || 0) + 100;
        baseY = selectedNode.y;
        console.log(`Generating tables next to selected node at (${baseX}, ${baseY})`);
      }
    }

    // 레이아웃 계산 (기준 위치로부터 상대적으로)
    calculateTableLayout(tables);

    // 모든 테이블 위치를 기준점만큼 이동
    for (const table of tables) {
      table.position.x += baseX;
      table.position.y += baseY;
    }

    // 피그마 노드 생성
    const frameNodes = await createMultipleTableFrames(tables);

    // 생성된 노드들을 타겟 부모에 추가
    for (const frame of frameNodes) {
      targetParent.appendChild(frame);
    }

    // 생성된 노드들을 선택
    figma.currentPage.selection = frameNodes;
    figma.viewport.scrollAndZoomIntoView(frameNodes);

    figma.ui.postMessage({
      type: 'import-success',
      count: frameNodes.length,
    });

    figma.notify(`${frameNodes.length}개의 테이블이 생성되었습니다.`);
  } catch (error) {
    throw error;
  }
}

// 플러그인 초기화
console.log('Figma to JSON Schema plugin loaded');
