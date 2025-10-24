import React, { useState, useEffect, useRef } from 'react';

interface LiveEditorProps {
  initialCode: string;
  language: 'typescript' | 'java' | 'json' | 'yaml';
  onCodeChange: (code: string) => void;
}

export default function LiveEditor({ initialCode, language, onCodeChange }: LiveEditorProps) {
  const [code, setCode] = useState(initialCode);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // 첫 마운트 시에만 initialCode 반영
    if (isInitialMount.current) {
      setCode(initialCode);
      isInitialMount.current = false;
    }
    // 이후에는 사용자 편집 내용 유지 (외부에서 덮어쓰지 않음)
  }, [initialCode]);

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCode(value);

    // 기존 타이머 취소
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce to avoid too many updates
    timeoutRef.current = setTimeout(() => {
      onCodeChange(value);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab 키 처리 (들여쓰기)
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = code.substring(0, start) + '  ' + code.substring(end);

      setCode(newValue);

      // 커서 위치 조정
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);

      // Tab으로 추가된 내용도 전송
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onCodeChange(newValue);
      }, 500);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <textarea
        value={code}
        onChange={handleEditorChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        style={{
          flex: 1,
          width: '100%',
          padding: '12px',
          fontFamily: "'Monaco', 'Menlo', 'Courier New', monospace",
          fontSize: '13px',
          lineHeight: '1.6',
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          border: 'none',
          outline: 'none',
          resize: 'none',
          whiteSpace: 'pre',
          overflowWrap: 'normal',
          overflowX: 'auto',
        }}
      />
    </div>
  );
}
