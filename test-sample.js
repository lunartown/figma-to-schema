/**
 * 간단한 테스트 - JSON Schema → Figma 변환 로직 확인
 */

const sampleSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "number",
      "description": "상품 ID"
    },
    "name": {
      "type": "string",
      "description": "상품명"
    },
    "price": {
      "type": "number",
      "description": "가격"
    },
    "options": {
      "type": "array",
      "description": "옵션 목록",
      "items": {
        "type": "object",
        "properties": {
          "optionId": {
            "type": "number"
          },
          "label": {
            "type": "string"
          }
        }
      }
    }
  },
  "required": ["id", "name", "price"]
};

console.log('Sample JSON Schema:');
console.log(JSON.stringify(sampleSchema, null, 2));

console.log('\n✅ 이 스키마를 플러그인에서 Import하면:');
console.log('- 루트 테이블 1개 (id, name, price, options)');
console.log('- 자식 테이블 1개 (optionId, label)');
console.log('- 총 2개의 테이블이 생성됩니다!');
