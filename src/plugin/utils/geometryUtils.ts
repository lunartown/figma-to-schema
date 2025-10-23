/**
 * 좌표 및 레이아웃 관련 유틸리티
 */

import { Position, Size } from '../types/table';

/**
 * 노드의 절대 위치 가져오기
 */
export function getAbsolutePosition(node: SceneNode): Position {
  // absoluteTransform을 사용해 절대 좌표 계산
  if ('absoluteTransform' in node && node.absoluteTransform) {
    const transform = node.absoluteTransform;
    return {
      x: transform[0][2],
      y: transform[1][2],
    };
  }

  // 폴백: 상대 좌표
  if ('x' in node && 'y' in node) {
    return {
      x: node.x,
      y: node.y,
    };
  }

  return { x: 0, y: 0 };
}

/**
 * 노드의 크기 가져오기
 */
export function getSize(node: SceneNode): Size | null {
  if ('width' in node && 'height' in node) {
    return {
      width: node.width,
      height: node.height,
    };
  }
  return null;
}

/**
 * 두 노드가 수직으로 정렬되어 있는지 확인 (y 좌표 범위가 겹침)
 */
export function isVerticallyAligned(
  node1: { position: Position; size: Size },
  node2: { position: Position; size: Size },
  tolerance: number = 50
): boolean {
  const y1Start = node1.position.y;
  const y1End = node1.position.y + node1.size.height;
  const y2Start = node2.position.y;
  const y2End = node2.position.y + node2.size.height;

  // 범위가 겹치거나 허용 범위 내에 있는지
  const overlap =
    (y1Start <= y2End + tolerance && y1End >= y2Start - tolerance) ||
    (y2Start <= y1End + tolerance && y2End >= y1Start - tolerance);

  return overlap;
}

/**
 * 노드가 다른 노드의 오른쪽에 있는지
 */
export function isRightOf(
  leftNode: { position: Position },
  rightNode: { position: Position },
  minGap: number = 50
): boolean {
  return rightNode.position.x >= leftNode.position.x + minGap;
}

/**
 * x 좌표 기준으로 노드들을 레벨별로 그룹화
 */
export function groupByXPosition<T extends { position: Position }>(
  items: T[],
  gapThreshold: number = 150
): T[][] {
  if (items.length === 0) return [];

  // x 좌표 기준으로 정렬
  const sorted = [...items].sort((a, b) => a.position.x - b.position.x);

  const levels: T[][] = [];
  let currentLevel: T[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];

    // x 좌표 차이가 임계값보다 작으면 같은 레벨
    if (Math.abs(current.position.x - previous.position.x) < gapThreshold) {
      currentLevel.push(current);
    } else {
      // 새 레벨 시작
      levels.push(currentLevel);
      currentLevel = [current];
    }
  }

  // 마지막 레벨 추가
  if (currentLevel.length > 0) {
    levels.push(currentLevel);
  }

  return levels;
}

/**
 * 가장 가까운 아이템 찾기
 */
export function findClosest<T extends { position: Position }>(
  items: T[],
  targetY: number
): T | null {
  if (items.length === 0) return null;

  let closest = items[0];
  let minDistance = Math.abs(items[0].position.y - targetY);

  for (let i = 1; i < items.length; i++) {
    const distance = Math.abs(items[i].position.y - targetY);
    if (distance < minDistance) {
      minDistance = distance;
      closest = items[i];
    }
  }

  return closest;
}

/**
 * y 좌표 기준으로 정렬
 */
export function sortByY<T extends { position: Position }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position.y - b.position.y);
}
