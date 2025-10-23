/**
 * 색상 관련 유틸리티 함수
 */

import { RGB } from '../types/table';

/**
 * 두 RGB 색상이 허용 범위 내에서 유사한지 확인
 */
export function colorsMatch(color1: RGB, color2: RGB, tolerance: number = 0.1): boolean {
  return (
    Math.abs(color1.r - color2.r) <= tolerance &&
    Math.abs(color1.g - color2.g) <= tolerance &&
    Math.abs(color1.b - color2.b) <= tolerance
  );
}

/**
 * Figma의 Paint에서 RGB 추출
 */
export function extractRGB(fills: readonly Paint[] | typeof figma.mixed): RGB | null {
  if (!fills || fills === figma.mixed || fills.length === 0) {
    return null;
  }

  const solidFill = fills.find((fill) => fill.type === 'SOLID') as SolidPaint | undefined;
  if (!solidFill) {
    return null;
  }

  return {
    r: solidFill.color.r,
    g: solidFill.color.g,
    b: solidFill.color.b,
  };
}

/**
 * 특정 색상 패턴인지 확인
 */
export function hasColor(node: SceneNode, targetColor: RGB, tolerance: number = 0.1): boolean {
  if (!('fills' in node)) {
    return false;
  }

  const rgb = extractRGB(node.fills);
  if (!rgb) {
    return false;
  }

  return colorsMatch(rgb, targetColor, tolerance);
}

/**
 * RGB를 Figma Paint로 변환
 */
export function rgbToPaint(rgb: RGB): SolidPaint {
  return {
    type: 'SOLID',
    color: { r: rgb.r, g: rgb.g, b: rgb.b },
  };
}
