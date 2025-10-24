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

// documentchange 이벤트를 사용하기 위해 모든 페이지 로드
(async () => {
  try {
    await figma.loadAllPagesAsync();
    console.log('All pages loaded for documentchange support');
  } catch (error) {
    console.error('Failed to load pages:', error);
  }
})();

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

      case 'live-editor-update':
        // Live Editor 업데이트는 에러를 UI에 전달하지 않음 (조용히 처리)
        await handleLiveEditorUpdate(msg);
        break;

      case 'live-editor-mode-enter':
        isLiveEditorMode = true;
        liveEditorFormat = msg.format || 'typescript';
        // 현재 선택 저장
        savedSelection = figma.currentPage.selection;
        console.log('[Plugin] Live editor mode entered, saved selection:', savedSelection.length);

        // 선택이 없으면 마지막 생성된 스키마 title로 테이블 찾기
        if (savedSelection.length === 0 && lastGeneratedSchemaTitle) {
          console.log('[Plugin] No selection, searching for table:', lastGeneratedSchemaTitle);
          const allNodes = figma.currentPage.findAll(node =>
            node.type === 'FRAME' &&
            (node as FrameNode).name === lastGeneratedSchemaTitle
          );
          if (allNodes.length > 0) {
            savedSelection = allNodes;
            console.log('[Plugin] Found', allNodes.length, 'matching frames');
          } else {
            // 정확한 이름으로 못 찾으면 포함 검색
            console.log('[Plugin] Trying partial match...');
            const partialMatch = figma.currentPage.findAll(node =>
              node.type === 'FRAME' &&
              (node as FrameNode).name.includes(lastGeneratedSchemaTitle)
            );
            if (partialMatch.length > 0) {
              savedSelection = partialMatch;
              console.log('[Plugin] Found', partialMatch.length, 'frames with partial match');
            }
          }
        }
        break;

      case 'live-editor-mode-exit':
        isLiveEditorMode = false;
        savedSelection = [];
        console.log('[Plugin] Live editor mode exited');
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
    // Live Editor 업데이트가 아닌 경우에만 에러 표시
    if (msg.type !== 'live-editor-update') {
      figma.ui.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } else {
      // Live Editor는 콘솔에만 로그
      console.error('Live editor update error:', error);
    }
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

    // 생성된 스키마 title 저장 (Live Editor용)
    lastGeneratedSchemaTitle = schema.title || 'Schema';

    // UI로 결과 전송
    figma.ui.postMessage({
      type: 'schema-generated',
      format: 'json-schema',
      data: data,
      title: schema.title || 'Schema',
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

/**
 * Live Editor에서 코드 변경 시 Figma 테이블 업데이트
 */
async function handleLiveEditorUpdate(msg: any) {
  console.log('[Plugin] handleLiveEditorUpdate called');
  console.log('[Plugin] Language:', msg.language);
  console.log('[Plugin] Code length:', msg.code?.length);

  try {
    let schema: JsonSchema | null = null;

    // JSON과 YAML만 지원 (TypeScript/Java는 복잡한 파서가 필요해 Live Edit 불가)
    switch (msg.language) {
      case 'json':
        console.log('[Plugin] Parsing JSON...');
        try {
          schema = JSON.parse(msg.code) as JsonSchema;
          console.log('[Plugin] JSON parsed successfully:', schema.title);
        } catch (error) {
          // JSON 파싱 실패 시 조용히 무시 (사용자가 입력 중일 수 있음)
          console.log('[Plugin] JSON parsing in progress...');
          return;
        }
        break;

      case 'yaml':
        console.log('[Plugin] Parsing YAML...');
        try {
          schema = yaml.load(msg.code) as JsonSchema;
          console.log('[Plugin] YAML parsed successfully:', schema.title);
        } catch (error) {
          // YAML 파싱 실패 시 조용히 무시 (사용자가 입력 중일 수 있음)
          console.log('[Plugin] YAML parsing in progress...');
          return;
        }
        break;

      case 'typescript':
      case 'java':
        // TypeScript와 Java는 읽기 전용 (편집 시 Figma 업데이트 안 됨)
        console.log('[Plugin] TypeScript/Java not supported for live editing');
        return;

      default:
        console.error('[Plugin] Unsupported language:', msg.language);
        return;
    }

    if (!schema || typeof schema !== 'object') {
      // 유효하지 않은 스키마는 조용히 무시
      console.log('[Plugin] Invalid schema, waiting for valid input...');
      return;
    }

    // 스키마가 최소한의 구조를 가지고 있는지 검증
    if (!schema.type || (schema.type === 'object' && !schema.properties)) {
      console.log('[Plugin] Incomplete schema, waiting for more input...');
      return;
    }

    console.log('[Plugin] Schema validated, starting table update...');

    // Live Editor 모드에서는 저장된 선택 사용, 아니면 현재 선택 사용
    const selection = savedSelection.length > 0 ? savedSelection : figma.currentPage.selection;
    console.log('[Plugin] Using selection count:', selection.length);
    console.log('[Plugin] Using saved selection:', savedSelection.length > 0);

    const existingFrames: FrameNode[] = [];

    for (const node of selection) {
      console.log('[Plugin] Node type:', node.type, 'Name:', node.name);
      if (node.type === 'FRAME') {
        existingFrames.push(node as FrameNode);
        console.log('[Plugin] Found frame:', node.name);
      }
    }

    if (existingFrames.length === 0) {
      console.log('[Plugin] No FRAME nodes in selection');
      // SECTION이나 다른 타입도 처리
      for (const node of selection) {
        if ('children' in node && (node.type === 'SECTION' || node.type === 'GROUP')) {
          console.log('[Plugin] Found container:', node.type, node.name);
          // 내부의 FRAME 찾기
          const frames = (node as ChildrenMixin).children.filter(
            child => child.type === 'FRAME'
          ) as FrameNode[];
          existingFrames.push(...frames);
          console.log('[Plugin] Found', frames.length, 'frames inside', node.type);
        }
      }
    }

    if (existingFrames.length === 0) {
      console.log('[Plugin] No tables found for live update');
      return;
    }

    // 메인 테이블 찾기 (첫 번째 또는 가장 왼쪽)
    const mainFrame = existingFrames.reduce((leftmost, current) =>
      current.x < leftmost.x ? current : leftmost
    );
    console.log('[Plugin] Main frame:', mainFrame.name);

    // 기존 테이블의 행 데이터 파싱
    console.log('[Plugin] Parsing existing rows...');
    const existingRows = parseFrameToRows(mainFrame);
    console.log('[Plugin] Existing rows:', existingRows.length);

    // 새로운 스키마에서 필요한 행 데이터 생성
    console.log('[Plugin] Converting schema to rows...');
    const newRows = schemaToRows(schema);
    console.log('[Plugin] New rows:', newRows.length);

    // 변경사항 계산
    console.log('[Plugin] Calculating changes...');
    const changes = calculateRowChanges(existingRows, newRows);
    console.log('[Plugin] Changes:', {
      added: changes.added.length,
      removed: changes.removed.length,
      modified: changes.modified.length
    });

    // 변경사항이 너무 많으면 (50% 이상) 전체 재생성
    const changeRatio = (changes.added.length + changes.removed.length) / Math.max(existingRows.length, 1);
    console.log('[Plugin] Change ratio:', changeRatio);

    if (changeRatio > 0.5 && existingRows.length > 3) {
      console.log('[Plugin] Too many changes, skipping live update');
      return;
    }

    // 변경사항 적용
    console.log('[Plugin] Applying changes...');
    await applyRowChanges(mainFrame, changes);

    console.log(`[Plugin] Live editor complete: updated ${changes.modified.length} rows, added ${changes.added.length}, removed ${changes.removed.length}`);
  } catch (error) {
    // 테이블 생성 중 오류 발생 시 조용히 무시
    console.error('Error updating tables:', error instanceof Error ? error.message : error);
  }
}

/**
 * Figma Frame을 행 데이터로 변환
 */
interface RowData {
  key: string; // 필드명
  type: string; // 타입
  required: boolean;
  description?: string;
  example?: string;
  default?: string;
}

function parseFrameToRows(frame: FrameNode): RowData[] {
  const rows: RowData[] = [];

  try {
    // 기존 tableParser 사용
    const tableData = parseTableFrame(frame);

    console.log('[Plugin] parseTableFrame result:', tableData);
    console.log('[Plugin] Has fields?', tableData?.fields?.length);

    if (tableData && tableData.fields) {
      console.log('[Plugin] Processing', tableData.fields.length, 'fields from parser');
      for (const field of tableData.fields) {
        rows.push({
          key: field.name,
          type: field.type,
          required: field.required,
          description: field.description,
          example: field.example,
          default: field.default,
        });
      }
    } else {
      console.log('[Plugin] tableData or fields is null/undefined');
    }
  } catch (error) {
    console.error('[Plugin] Error parsing frame to rows:', error);
  }

  console.log('[Plugin] parseFrameToRows returning', rows.length, 'rows');
  return rows;
}

/**
 * JSON Schema를 행 데이터로 변환
 */
function schemaToRows(schema: JsonSchema): RowData[] {
  const rows: RowData[] = [];

  if (schema.type === 'object' && schema.properties) {
    const required = schema.required || [];

    for (const [key, fieldSchema] of Object.entries(schema.properties)) {
      rows.push({
        key,
        type: fieldSchema.type as string || 'any',
        required: required.includes(key),
        description: fieldSchema.description,
        example: fieldSchema.examples?.[0]?.toString(),
        default: fieldSchema.default?.toString(),
      });
    }
  }

  return rows;
}

/**
 * 행 변경사항 계산
 */
interface RowChanges {
  added: RowData[];
  removed: RowData[];
  modified: { old: RowData; new: RowData }[];
}

function calculateRowChanges(existingRows: RowData[], newRows: RowData[]): RowChanges {
  const changes: RowChanges = {
    added: [],
    removed: [],
    modified: [],
  };

  const existingMap = new Map(existingRows.map(r => [r.key, r]));
  const newMap = new Map(newRows.map(r => [r.key, r]));

  // 추가된 행 찾기
  for (const newRow of newRows) {
    if (!existingMap.has(newRow.key)) {
      changes.added.push(newRow);
    }
  }

  // 삭제된 행 찾기
  for (const existingRow of existingRows) {
    if (!newMap.has(existingRow.key)) {
      changes.removed.push(existingRow);
    }
  }

  // 수정된 행 찾기
  for (const newRow of newRows) {
    const existingRow = existingMap.get(newRow.key);
    if (existingRow) {
      if (
        existingRow.type !== newRow.type ||
        existingRow.required !== newRow.required ||
        existingRow.description !== newRow.description ||
        existingRow.example !== newRow.example ||
        existingRow.default !== newRow.default
      ) {
        changes.modified.push({ old: existingRow, new: newRow });
      }
    }
  }

  return changes;
}

/**
 * 변경사항을 Figma Frame에 적용
 */
async function applyRowChanges(frame: FrameNode, changes: RowChanges): Promise<void> {
  // 수정된 행만 업데이트
  for (const { old: oldRow, new: newRow } of changes.modified) {
    await updateRowInFrame(frame, oldRow.key, newRow);
  }

  // 추가/삭제는 복잡하므로 로그만
  if (changes.added.length > 0) {
    console.log(`${changes.added.length} fields added - regenerate table to see them`);
  }
  if (changes.removed.length > 0) {
    console.log(`${changes.removed.length} fields removed - regenerate table to clean up`);
  }
}

/**
 * Frame에서 특정 키의 행 찾아서 업데이트
 */
async function updateRowInFrame(frame: FrameNode, key: string, newData: RowData): Promise<void> {
  // Frame 내의 모든 TextNode를 순회하며 해당 키를 가진 행 찾기
  const textNodes: TextNode[] = [];

  function collectTextNodes(node: SceneNode) {
    if (node.type === 'TEXT') {
      textNodes.push(node as TextNode);
    } else if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        collectTextNodes(child);
      }
    }
  }

  collectTextNodes(frame);

  // 각 TextNode에서 키를 찾아서 업데이트
  for (const textNode of textNodes) {
    const text = textNode.characters;

    // 이 TextNode가 해당 키를 포함하는지 확인
    if (text.startsWith(key + '\t') || text.startsWith(key + ' ')) {
      try {
        // 폰트 로드
        await figma.loadFontAsync(textNode.fontName as FontName);

        // 텍스트 업데이트
        const parts = [
          newData.key,
          newData.type,
          newData.required ? '✓' : '',
          newData.description || '',
          newData.example || '',
          newData.default || '',
        ];

        textNode.characters = parts.join('\t');
        console.log(`Updated field: ${key}`);
        break;
      } catch (error) {
        console.error(`Error updating text node for ${key}:`, error);
      }
    }
  }
}

// Figma 문서 변경 감지 (Live Editor 모드에서 사용)
// 현재는 비활성화 - 양방향 동기화 시 충돌 문제 때문에
// 사용자가 JSON 편집 → Figma 업데이트 → documentchange 발생 → JSON 원복
// 이 문제를 해결하려면 더 정교한 동기화 로직 필요
let isLiveEditorMode = false;
let liveEditorFormat: 'typescript' | 'java' | 'json' | 'yaml' = 'typescript';
let savedSelection: readonly SceneNode[] = [];
let lastGeneratedSchemaTitle: string = '';

// documentchange 이벤트는 일단 비활성화
// figma.on('documentchange', async (event) => {
//   if (!isLiveEditorMode) return;
//
//   // 노드 변경 감지
//   for (const change of event.documentChanges) {
//     if (
//       change.type === 'PROPERTY_CHANGE' ||
//       change.type === 'CREATE' ||
//       change.type === 'DELETE'
//     ) {
//       // 변경 감지 시 스키마 재생성하여 UI로 전송
//       try {
//         await syncFigmaToLiveEditor();
//       } catch (error) {
//         console.error('Live editor sync error:', error);
//       }
//       break; // 한 번만 실행
//     }
//   }
// });

/**
 * Figma 테이블 → Live Editor 코드 동기화
 */
async function syncFigmaToLiveEditor() {
  try {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) return;

    // 선택된 테이블들 파싱
    const allTables = findAllTableFrames(selection);

    if (allTables.length === 0) return;

    // 루트 테이블 찾기
    let rootTable = allTables.find((t) => t.endpoint);
    if (!rootTable) {
      rootTable = allTables.reduce((leftmost, current) =>
        current.position.x < leftmost.position.x ? current : leftmost
      );
    }

    const relatedTables = findRelatedTables(rootTable, allTables);
    const hierarchy = buildHierarchy(relatedTables);

    if (!hierarchy) return;

    // JSON Schema 생성
    const schema = buildJsonSchema(hierarchy, {
      includeExamples: true,
    });

    // Format에 맞게 변환
    let code: string;

    switch (liveEditorFormat) {
      case 'typescript':
        code = generateTypeScriptFromSchema(schema, {
          includeComments: true,
          exportInterfaces: true,
        });
        break;

      case 'java':
        code = generateJavaFromSchema(schema, {
          includeComments: true,
        });
        break;

      case 'json':
        code = JSON.stringify(schema, null, 2);
        break;

      case 'yaml':
        code = yaml.dump(schema, { indent: 2, lineWidth: -1 });
        break;

      default:
        return;
    }

    // UI로 업데이트 전송
    figma.ui.postMessage({
      type: 'live-editor-sync',
      code,
    });
  } catch (error) {
    console.error('Sync error:', error);
  }
}

// 플러그인 초기화
console.log('Figma to JSON Schema plugin loaded');
