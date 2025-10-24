import React, { useState, useEffect } from 'react';
import LiveEditor from './LiveEditor';

type Mode = 'figma-to-schema' | 'schema-to-figma' | 'live-editor';
type Format = 'json-schema' | 'domain-model' | 'sql-ddl';
type DomainModelLang = 'typescript' | 'java';
type SqlDialect = 'mysql' | 'postgres' | 'oracle';
type SchemaFormat = 'json' | 'yaml';

interface Message {
  type: string;
  [key: string]: any;
}

// 샘플 스키마 상수
const SAMPLE_SCHEMA = `{
  "title": "User API Response",
  "type": "object",
  "description": "Complete user profile with nested structures",
  "required": ["id", "email", "profile", "permissions"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique user identifier",
      "examples": ["usr_123abc"]
    },
    "email": {
      "type": "string",
      "description": "User email address",
      "examples": ["user@example.com"]
    },
    "username": {
      "type": "string",
      "description": "Display username",
      "default": "anonymous",
      "examples": ["johndoe"]
    },
    "profile": {
      "type": "object",
      "description": "User profile information",
      "required": ["firstName", "lastName", "address"],
      "properties": {
        "firstName": {
          "type": "string",
          "description": "User first name",
          "examples": ["John"]
        },
        "lastName": {
          "type": "string",
          "description": "User last name",
          "examples": ["Doe"]
        },
        "age": {
          "type": "number",
          "description": "User age",
          "default": 18,
          "examples": [30]
        },
        "bio": {
          "type": "string",
          "description": "User biography",
          "examples": ["Software engineer from Seoul"]
        },
        "address": {
          "type": "object",
          "description": "User address details",
          "required": ["city", "country"],
          "properties": {
            "street": {
              "type": "string",
              "description": "Street address",
              "examples": ["123 Main St"]
            },
            "city": {
              "type": "string",
              "description": "City name",
              "examples": ["Seoul"]
            },
            "state": {
              "type": "string",
              "description": "State or province",
              "examples": ["Seoul"]
            },
            "country": {
              "type": "string",
              "description": "Country code",
              "default": "KR",
              "examples": ["KR"]
            },
            "postalCode": {
              "type": "string",
              "description": "Postal code",
              "examples": ["12345"]
            }
          }
        },
        "socialLinks": {
          "type": "object",
          "description": "Social media links",
          "properties": {
            "twitter": {
              "type": "string",
              "description": "Twitter handle",
              "examples": ["@johndoe"]
            },
            "github": {
              "type": "string",
              "description": "GitHub username",
              "examples": ["johndoe"]
            },
            "linkedin": {
              "type": "string",
              "description": "LinkedIn profile URL",
              "examples": ["https://linkedin.com/in/johndoe"]
            }
          }
        }
      }
    },
    "permissions": {
      "type": "array",
      "description": "User permission list",
      "items": {
        "type": "object",
        "required": ["resource", "actions"],
        "properties": {
          "resource": {
            "type": "string",
            "description": "Resource identifier",
            "examples": ["users"]
          },
          "actions": {
            "type": "array",
            "description": "Allowed actions",
            "items": {
              "type": "string",
              "examples": ["read", "write", "delete"]
            }
          },
          "scope": {
            "type": "string",
            "description": "Permission scope",
            "default": "own",
            "examples": ["own", "team", "global"]
          }
        }
      }
    },
    "teams": {
      "type": "array",
      "description": "Teams user belongs to",
      "items": {
        "type": "object",
        "required": ["id", "name", "role"],
        "properties": {
          "id": {
            "type": "string",
            "description": "Team ID",
            "examples": ["team_123"]
          },
          "name": {
            "type": "string",
            "description": "Team name",
            "examples": ["Engineering"]
          },
          "role": {
            "type": "string",
            "description": "User role in team",
            "default": "member",
            "examples": ["member", "admin", "owner"]
          },
          "joinedAt": {
            "type": "string",
            "description": "Join timestamp",
            "examples": ["2024-01-01T00:00:00Z"]
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "description": "Additional metadata",
      "properties": {
        "createdAt": {
          "type": "string",
          "description": "Account creation timestamp",
          "examples": ["2024-01-01T00:00:00Z"]
        },
        "updatedAt": {
          "type": "string",
          "description": "Last update timestamp",
          "examples": ["2024-03-15T12:30:00Z"]
        },
        "lastLoginAt": {
          "type": "string",
          "description": "Last login timestamp",
          "examples": ["2024-03-15T09:00:00Z"]
        },
        "preferences": {
          "type": "object",
          "description": "User preferences",
          "properties": {
            "theme": {
              "type": "string",
              "description": "UI theme preference",
              "default": "light",
              "examples": ["dark", "light"]
            },
            "language": {
              "type": "string",
              "description": "Preferred language",
              "default": "en",
              "examples": ["ko", "en"]
            },
            "notifications": {
              "type": "object",
              "description": "Notification settings",
              "properties": {
                "email": {
                  "type": "boolean",
                  "description": "Email notifications enabled",
                  "default": true,
                  "examples": [true]
                },
                "push": {
                  "type": "boolean",
                  "description": "Push notifications enabled",
                  "default": false,
                  "examples": [false]
                },
                "sms": {
                  "type": "boolean",
                  "description": "SMS notifications enabled",
                  "default": false,
                  "examples": [false]
                }
              }
            }
          }
        }
      }
    }
  }
}`;

function App() {
  console.log('=== App component rendering ===');

  const [mode, setMode] = useState<Mode>('figma-to-schema');
  const [format, setFormat] = useState<Format>('json-schema');
  const [schemaFormat, setSchemaFormat] = useState<SchemaFormat>('json');
  const [domainModelLang, setDomainModelLang] = useState<DomainModelLang>('typescript');
  const [sqlDialect, setSqlDialect] = useState<SqlDialect>('mysql');
  const [result, setResult] = useState<string>('');
  const [schemaTitle, setSchemaTitle] = useState<string>('');
  const [inputSchema, setInputSchema] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [includeComments, setIncludeComments] = useState(true);
  const [useSampleSchema, setUseSampleSchema] = useState(false);
  const [liveEditorCode, setLiveEditorCode] = useState<string>('');
  const [liveEditorLang, setLiveEditorLang] = useState<'typescript' | 'java' | 'json' | 'yaml'>('typescript');

  useEffect(() => {
    console.log('App useEffect: Setting up message listener');
    // 플러그인으로부터 메시지 수신
    window.onmessage = (event: MessageEvent<Message>) => {
      const msg = event.data.pluginMessage;

      if (!msg) return;

      switch (msg.type) {
        case 'schema-generated':
          setResult(msg.data);
          setSchemaTitle(msg.title || '');
          setLoading(false);
          break;

        case 'import-success':
          alert(`${msg.count}개의 테이블이 생성되었습니다!`);
          setLoading(false);
          break;

        case 'error':
          setError(msg.message);
          setLoading(false);
          break;

        case 'tables-found':
          alert(`${msg.count}개의 테이블을 찾았습니다.`);
          break;

        // live-editor-sync는 제거 - 단방향 동기화만 지원 (JSON → Figma)
        // case 'live-editor-sync':
        //   setLiveEditorCode(msg.code);
        //   break;
      }
    };
  }, []);

  const handleGenerateSchema = () => {
    setError('');
    setResult('');
    setLoading(true);

    if (format === 'json-schema') {
      parent.postMessage(
        {
          pluginMessage: {
            type: 'generate-json-schema',
            options: {
              includeExamples: true,
              format: schemaFormat,
            },
          },
        },
        '*'
      );
    } else if (format === 'domain-model') {
      if (domainModelLang === 'typescript') {
        parent.postMessage(
          {
            pluginMessage: {
              type: 'generate-typescript',
              options: {
                includeComments: includeComments,
                exportInterfaces: true,
              },
            },
          },
          '*'
        );
      } else if (domainModelLang === 'java') {
        parent.postMessage(
          {
            pluginMessage: {
              type: 'generate-java',
              options: {
                includeComments: includeComments,
              },
            },
          },
          '*'
        );
      }
    } else if (format === 'sql-ddl') {
      if (sqlDialect === 'mysql') {
        parent.postMessage(
          {
            pluginMessage: {
              type: 'generate-mysql',
              options: {
                includeComments: includeComments,
              },
            },
          },
          '*'
        );
      } else if (sqlDialect === 'postgres') {
        parent.postMessage(
          {
            pluginMessage: {
              type: 'generate-postgres',
              options: {
                includeComments: includeComments,
              },
            },
          },
          '*'
        );
      } else if (sqlDialect === 'oracle') {
        parent.postMessage(
          {
            pluginMessage: {
              type: 'generate-oracle',
              options: {
                includeComments: includeComments,
              },
            },
          },
          '*'
        );
      }
    }
  };

  const handleImportSchema = () => {
    if (!inputSchema.trim()) {
      setError('Please enter a schema.');
      return;
    }

    try {
      JSON.parse(inputSchema);
    } catch (e) {
      setError('Invalid JSON format.');
      return;
    }

    setError('');
    setLoading(true);

    parent.postMessage(
      {
        pluginMessage: {
          type: 'import-schema',
          schema: inputSchema,
          options: {},
        },
      },
      '*'
    );
  };

  const handleCopyToClipboard = () => {
    try {
      // Fallback 방식: textarea 사용
      const textarea = document.createElement('textarea');
      textarea.value = result;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();

      const success = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (success) {
        alert('Schema copied to clipboard!');
      } else {
        alert('Failed to copy. Please select and copy the text manually.');
      }
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Failed to copy. Please select and copy the text manually.');
    }
  };

  const handleDownload = () => {
    const mimeType = (format === 'domain-model' || format === 'sql-ddl') ? 'text/plain' :
                     (format === 'json-schema' && schemaFormat === 'yaml') ? 'text/yaml' : 'application/json';
    const blob = new Blob([result], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    let filename = 'schema.json';
    if (format === 'domain-model') {
      const baseName = schemaTitle || 'Model';
      filename = domainModelLang === 'typescript' ? `${baseName}.ts` : `${baseName}.java`;
    } else if (format === 'sql-ddl') {
      filename = 'schema.sql';
    } else if (format === 'json-schema') {
      filename = schemaFormat === 'yaml' ? 'schema.yaml' : 'schema.json';
    }

    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Figma ↔ JSON Schema</h1>
      </div>

      <div className="mode-selector">
        <button
          className={mode === 'figma-to-schema' ? 'active' : ''}
          onClick={() => setMode('figma-to-schema')}
        >
          Figma → Schema
        </button>
        <button
          className={mode === 'schema-to-figma' ? 'active' : ''}
          onClick={() => setMode('schema-to-figma')}
        >
          Schema → Figma
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {mode === 'live-editor' ? (
        <div className="live-editor-container">
          <div className="live-editor-header">
            <h2>Live Editor</h2>
            <button
              onClick={() => {
                setMode('figma-to-schema');
                // 플러그인에 Live Editor 모드 종료 알림
                parent.postMessage(
                  {
                    pluginMessage: {
                      type: 'live-editor-mode-exit',
                    },
                  },
                  '*'
                );
              }}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Back
            </button>
          </div>
          <div className="live-editor-content">
            <LiveEditor
              initialCode={liveEditorCode}
              language={liveEditorLang}
              onCodeChange={(code) => {
                console.log('[UI] Code changed, length:', code.length);
                console.log('[UI] Language:', liveEditorLang);
                console.log('[UI] Sending live-editor-update message to plugin');

                // 모든 파싱은 플러그인 코드에서 수행
                // UI에서는 단순히 코드 문자열만 전송
                parent.postMessage(
                  {
                    pluginMessage: {
                      type: 'live-editor-update',
                      code,
                      language: liveEditorLang,
                    },
                  },
                  '*'
                );

                console.log('[UI] Message sent');
              }}
            />
          </div>
        </div>
      ) : mode === 'figma-to-schema' ? (
        <div className="section">
          <h2>Generate Schema</h2>

          <div className="format-selector">
            <label>
              <input
                type="radio"
                value="json-schema"
                checked={format === 'json-schema'}
                onChange={(e) => setFormat(e.target.value as Format)}
              />
              JSON Schema
            </label>
            <label>
              <input
                type="radio"
                value="domain-model"
                checked={format === 'domain-model'}
                onChange={(e) => setFormat(e.target.value as Format)}
              />
              Domain Model
            </label>
            <label>
              <input
                type="radio"
                value="sql-ddl"
                checked={format === 'sql-ddl'}
                onChange={(e) => setFormat(e.target.value as Format)}
              />
              SQL DDL
            </label>
          </div>

          {format === 'json-schema' && (
            <div className="schema-format-options">
              <div className="format-type-selector">
                <label>
                  <input
                    type="radio"
                    value="json"
                    checked={schemaFormat === 'json'}
                    onChange={(e) => setSchemaFormat(e.target.value as SchemaFormat)}
                  />
                  JSON
                </label>
                <label>
                  <input
                    type="radio"
                    value="yaml"
                    checked={schemaFormat === 'yaml'}
                    onChange={(e) => setSchemaFormat(e.target.value as SchemaFormat)}
                  />
                  YAML
                </label>
              </div>
            </div>
          )}

          {format === 'domain-model' && (
            <div className="domain-model-options">
              <div className="lang-selector">
                <label>
                  <input
                    type="radio"
                    value="typescript"
                    checked={domainModelLang === 'typescript'}
                    onChange={(e) => setDomainModelLang(e.target.value as DomainModelLang)}
                  />
                  TypeScript
                </label>
                <label>
                  <input
                    type="radio"
                    value="java"
                    checked={domainModelLang === 'java'}
                    onChange={(e) => setDomainModelLang(e.target.value as DomainModelLang)}
                  />
                  Java
                </label>
              </div>
              <label className="comment-option">
                <input
                  type="checkbox"
                  checked={includeComments}
                  onChange={(e) => setIncludeComments(e.target.checked)}
                />
                Include Comments
              </label>
            </div>
          )}

          {format === 'sql-ddl' && (
            <div className="sql-options">
              <div className="db-selector">
                <label>
                  <input
                    type="radio"
                    value="mysql"
                    checked={sqlDialect === 'mysql'}
                    onChange={(e) => setSqlDialect(e.target.value as SqlDialect)}
                  />
                  MySQL
                </label>
                <label>
                  <input
                    type="radio"
                    value="postgres"
                    checked={sqlDialect === 'postgres'}
                    onChange={(e) => setSqlDialect(e.target.value as SqlDialect)}
                  />
                  PostgreSQL
                </label>
                <label>
                  <input
                    type="radio"
                    value="oracle"
                    checked={sqlDialect === 'oracle'}
                    onChange={(e) => setSqlDialect(e.target.value as SqlDialect)}
                  />
                  Oracle
                </label>
              </div>
              <label className="comment-option">
                <input
                  type="checkbox"
                  checked={includeComments}
                  onChange={(e) => setIncludeComments(e.target.checked)}
                />
                Include Comments
              </label>
            </div>
          )}

          <button
            className="primary-button"
            onClick={handleGenerateSchema}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Schema'}
          </button>

          {result && (
            <div className="result-section">
              <div className="result-header">
                <h3>Generated Schema</h3>
                <div className="result-actions">
                  <button onClick={handleCopyToClipboard}>Copy</button>
                  <button onClick={handleDownload}>Download</button>
                  {/* Live Edit는 JSON Schema (JSON/YAML)만 지원 */}
                  {format === 'json-schema' && (
                    <button
                      onClick={() => {
                        setLiveEditorCode(result);
                        const lang = schemaFormat === 'yaml' ? 'yaml' : 'json';
                        setLiveEditorLang(lang);
                        setMode('live-editor');

                        // 플러그인에 Live Editor 모드 진입 알림
                        parent.postMessage(
                          {
                            pluginMessage: {
                              type: 'live-editor-mode-enter',
                              format: lang,
                            },
                          },
                          '*'
                        );
                      }}
                      style={{
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Live edit JSON Schema - bidirectional sync with Figma tables"
                    >
                      Live Edit
                    </button>
                  )}
                </div>
              </div>
              <pre className="result-preview">{result}</pre>
            </div>
          )}
        </div>
      ) : (
        <div className="section">
          <h2>Import Schema</h2>

          <div className="options" style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={useSampleSchema}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseSampleSchema(checked);
                  if (checked) {
                    setInputSchema(SAMPLE_SCHEMA);
                  } else {
                    setInputSchema('');
                  }
                }}
              />
              Use Sample Schema
            </label>
          </div>

          <textarea
            className="schema-input"
            placeholder="Paste JSON Schema here..."
            value={inputSchema}
            onChange={(e) => setInputSchema(e.target.value)}
            rows={15}
          />

          <button
            className="primary-button"
            onClick={handleImportSchema}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Create Tables'}
          </button>
        </div>
      )}

      <div className="footer">
        <button
          className="close-button"
          onClick={() =>
            parent.postMessage({ pluginMessage: { type: 'close' } }, '*')
          }
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default App;
