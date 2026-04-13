export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "BlueKiwi API",
    description: "에이전트 지침 시스템 API",
    version: "1.0.0",
  },
  servers: [{ url: "/", description: "Current server" }],
  tags: [
    { name: "Instructions", description: "에이전트 지침 CRUD" },
    { name: "Workflows", description: "워크플로 관리" },
    { name: "Workflow Nodes", description: "워크플로 노드 개별 CRUD" },
    { name: "Node Attachments", description: "워크플로 노드 첨부 파일 관리" },
    { name: "Tasks", description: "태스크 실행 및 모니터링" },
    { name: "Task Execution", description: "MCP 기반 태스크 실행 제어" },
    { name: "Credentials", description: "API 시크릿/인증정보 관리" },
    { name: "Folders", description: "폴더 및 공유 관리" },
  ],
  paths: {
    "/api/instructions": {
      get: {
        tags: ["Instructions"],
        summary: "지침 목록 조회",
        description: "필터링, 검색, 태그 조건으로 지침 목록을 조회합니다.",
        parameters: [
          {
            name: "agent_type",
            in: "query",
            schema: {
              type: "string",
              enum: ["general", "coding", "research", "writing", "data"],
            },
            description: "에이전트 유형으로 필터링",
          },
          {
            name: "active_only",
            in: "query",
            schema: { type: "string", enum: ["true", "false"] },
            description: "활성 지침만 조회",
          },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "제목/내용 검색어 (LIKE 매칭)",
          },
          {
            name: "tag",
            in: "query",
            schema: { type: "string" },
            description: "태그로 필터링",
          },
        ],
        responses: {
          "200": {
            description: "지침 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Instruction" },
                    },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Instructions"],
        summary: "지침 추가",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InstructionCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "생성된 지침",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Instruction" },
                  },
                },
              },
            },
          },
          "400": {
            description: "유효성 검증 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/instructions/{id}": {
      get: {
        tags: ["Instructions"],
        summary: "지침 단건 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "지침 상세",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Instruction" },
                  },
                },
              },
            },
          },
          "404": {
            description: "지침을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Instructions"],
        summary: "지침 수정",
        description:
          "부분 업데이트를 지원합니다. 변경할 필드만 전송하면 됩니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InstructionUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "수정된 지침",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Instruction" },
                  },
                },
              },
            },
          },
          "404": {
            description: "지침을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Instructions"],
        summary: "지침 삭제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "삭제 완료",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        deleted: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "지침을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/workflows": {
      get: {
        tags: ["Workflows"],
        summary: "워크플로 목록 조회",
        responses: {
          "200": {
            description: "워크플로 목록 (노드 포함)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/WorkflowWithNodes" },
                    },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Workflows"],
        summary: "워크플로 생성",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WorkflowCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "생성된 워크플로",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/WorkflowWithNodes" },
                  },
                },
              },
            },
          },
          "400": {
            description: "유효성 검증 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/workflows/{id}": {
      get: {
        tags: ["Workflows"],
        summary: "워크플로 단건 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "워크플로 상세",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/WorkflowWithNodes" },
                  },
                },
              },
            },
          },
          "404": {
            description: "워크플로를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Workflows"],
        summary: "워크플로 수정",
        description: "nodes 배열을 전송하면 기존 노드를 모두 교체합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WorkflowCreate" },
            },
          },
        },
        responses: {
          "200": {
            description: "수정된 워크플로",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/WorkflowWithNodes" },
                  },
                },
              },
            },
          },
          "404": {
            description: "워크플로를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Workflows"],
        summary: "워크플로 삭제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "삭제 완료",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        deleted: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "워크플로를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 목록 조회",
        parameters: [
          {
            name: "workflow_id",
            in: "query",
            schema: { type: "integer" },
            description: "워크플로 ID로 필터링",
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["pending", "running", "completed", "failed"],
            },
            description: "상태로 필터링",
          },
        ],
        responses: {
          "200": {
            description: "태스크 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TaskWithLogs" },
                    },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Tasks"],
        summary: "태스크 생성 (워크플로 실행 시작)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workflow_id"],
                properties: { workflow_id: { type: "integer" } },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "생성된 태스크",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Task" } },
                },
              },
            },
          },
          "400": {
            description: "유효성 검증 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "워크플로를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/tasks/{id}": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 상세 조회 (로그 포함)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "태스크 상세",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/TaskWithLogs" },
                  },
                },
              },
            },
          },
          "404": {
            description: "태스크를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Tasks"],
        summary: "태스크 상태 변경",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["pending", "running", "completed", "failed"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "수정된 태스크",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Task" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/tasks/{id}/logs": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 로그 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "로그 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TaskLog" },
                    },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Tasks"],
        summary: "태스크 로그 추가",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["node_id", "step_order"],
                properties: {
                  node_id: { type: "integer" },
                  step_order: { type: "integer" },
                  output: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["running", "completed", "failed"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "생성된 로그",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/TaskLog" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/credentials": {
      get: {
        tags: ["Credentials"],
        summary: "Credential 목록 조회",
        description:
          "등록된 credential 목록을 반환합니다. secrets는 마스킹됩니다.",
        responses: {
          "200": {
            description: "Credential 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/CredentialMasked" },
                    },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Credentials"],
        summary: "Credential 생성",
        description:
          "새 credential을 생성합니다. secrets는 key-value 객체로 전달합니다.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["service_name"],
                properties: {
                  service_name: {
                    type: "string",
                    example: "threads",
                    description: "서비스 식별자",
                  },
                  description: { type: "string", example: "Threads Graph API" },
                  secrets: {
                    type: "object",
                    example: {
                      ACCESS_TOKEN: "ig_xxx...",
                      USER_ID: "123456",
                    },
                    description: "API 키/시크릿 key-value 객체",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "생성된 credential (secrets 마스킹)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/CredentialMasked" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/credentials/{id}": {
      get: {
        tags: ["Credentials"],
        summary: "Credential 상세 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "Credential 상세 (secrets 마스킹, linked_nodes 포함)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      allOf: [
                        { $ref: "#/components/schemas/CredentialMasked" },
                        {
                          type: "object",
                          properties: {
                            linked_nodes: {
                              type: "integer",
                              description: "연결된 노드 수",
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["Credentials"],
        summary: "Credential 수정",
        description:
          "credential을 수정합니다. secrets의 빈 값은 기존 값을 유지합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  service_name: { type: "string" },
                  description: { type: "string" },
                  secrets: {
                    type: "object",
                    description: "수정할 키-값. 빈 문자열이면 기존 값 유지.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "수정된 credential (secrets 마스킹)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/CredentialMasked" },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Credentials"],
        summary: "Credential 삭제",
        description:
          "credential을 삭제합니다. 연결된 노드의 credential_id는 NULL로 변경됩니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "삭제 완료",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        deleted: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    // ─── Workflow Nodes (individual CRUD) ───
    "/api/workflows/{id}/nodes": {
      post: {
        tags: ["Workflow Nodes"],
        summary: "노드 추가 (끝 또는 중간 삽입)",
        description:
          "after 쿼리 파라미터 없으면 끝에 추가, after=N이면 step N 뒤에 삽입. loop 노드는 loop_back_to 설정 가능.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "after",
            in: "query",
            schema: { type: "integer" },
            description: "이 step_order 뒤에 삽입 (생략 시 끝에 추가)",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NodeCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "생성된 노드",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/WorkflowNode" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/workflows/{id}/nodes/{nodeId}": {
      patch: {
        tags: ["Workflow Nodes"],
        summary: "노드 부분 수정",
        description:
          "변경할 필드만 전송. inline instruction은 instruction 필드로 직접 수정 가능.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "워크플로 ID",
          },
          {
            name: "nodeId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "노드 ID",
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NodeUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "수정된 노드",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/WorkflowNode" },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Workflow Nodes"],
        summary: "노드 삭제",
        description: "노드 삭제 후 후속 노드의 step_order를 자동 재정렬.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "nodeId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "삭제 완료",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        deleted: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/workflows/{id}/nodes/{nodeId}/attachments": {
      get: {
        tags: ["Node Attachments"],
        summary: "노드 첨부 파일 목록 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "워크플로 ID",
          },
          {
            name: "nodeId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "노드 ID",
          },
        ],
        responses: {
          "200": {
            description: "첨부 파일 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/NodeAttachment" },
                    },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
          "404": {
            description: "워크플로 또는 노드를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Node Attachments"],
        summary: "노드 첨부 파일 업로드",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "워크플로 ID",
          },
          {
            name: "nodeId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "노드 ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "업로드할 첨부 파일",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "업로드된 첨부 파일",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/NodeAttachment" },
                  },
                },
              },
            },
          },
          "400": {
            description: "유효성 검증 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "워크플로 또는 노드를 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/workflows/{id}/nodes/{nodeId}/attachments/{attachId}": {
      get: {
        tags: ["Node Attachments"],
        summary: "노드 첨부 파일 다운로드",
        description:
          "텍스트 파일은 JSON으로 내용을 반환하고, 바이너리 파일은 원본 바이트를 다운로드합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "워크플로 ID",
          },
          {
            name: "nodeId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "노드 ID",
          },
          {
            name: "attachId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "첨부 파일 ID",
          },
        ],
        responses: {
          "200": {
            description: "첨부 파일 내용",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      $ref: "#/components/schemas/NodeAttachmentContent",
                    },
                  },
                },
              },
              "application/octet-stream": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          "404": {
            description: "첨부 파일을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Node Attachments"],
        summary: "노드 첨부 파일 삭제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "워크플로 ID",
          },
          {
            name: "nodeId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "노드 ID",
          },
          {
            name: "attachId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "첨부 파일 ID",
          },
        ],
        responses: {
          "200": {
            description: "삭제 완료",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        deleted: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "첨부 파일을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    // ─── Task Execution (MCP-driven) ───
    "/api/tasks/{id}/execute": {
      post: {
        tags: ["Task Execution"],
        summary: "단계 실행 결과 제출 (execute_step)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ExecuteStep" },
            },
          },
        },
        responses: {
          "200": {
            description:
              "실행 결과. next_action이 있으면 후속 조치 필요 (wait_for_human_approval 또는 loop_back)",
          },
        },
      },
    },
    "/api/tasks/{id}/advance": {
      post: {
        tags: ["Task Execution"],
        summary: "다음 단계로 진행 또는 현재 단계 조회 (peek)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  peek: {
                    type: "boolean",
                    description: "true이면 진행하지 않고 현재 단계 정보만 반환",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "다음 단계 정보 또는 현재 단계 조회 결과",
          },
          "403": {
            description: "HITL 단계 승인 필요",
          },
          "412": {
            description: "현재 단계 미완료",
          },
        },
      },
    },
    "/api/tasks/{id}/request-approval": {
      post: {
        tags: ["Task Execution"],
        summary: "HITL 승인 요청",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "승인 요청 완료" } },
      },
    },
    "/api/tasks/{id}/approve": {
      post: {
        tags: ["Task Execution"],
        summary: "HITL 단계 승인",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "승인 완료" } },
      },
    },
    "/api/tasks/{id}/rewind": {
      post: {
        tags: ["Task Execution"],
        summary: "이전 단계로 되감기",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["to_step"],
                properties: { to_step: { type: "integer" } },
              },
            },
          },
        },
        responses: { "200": { description: "되감기 완료" } },
      },
    },
    "/api/tasks/{id}/complete": {
      post: {
        tags: ["Task Execution"],
        summary: "태스크 완료/실패 처리",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["completed", "failed"],
                  },
                  summary: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "완료 처리됨" } },
      },
    },
    "/api/tasks/{id}/respond": {
      get: {
        tags: ["Task Execution"],
        summary: "Visual Selection 응답 폴링",
        description: "에이전트가 사용자의 Visual Selection 응답을 폴링합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "web_response가 null이면 아직 응답 없음",
          },
        },
      },
      post: {
        tags: ["Task Execution"],
        summary: "Visual Selection 응답 제출",
        description: "웹 UI에서 사용자가 선택한 값을 제출합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["node_id", "response"],
                properties: {
                  node_id: { type: "integer" },
                  response: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "응답 저장 완료" } },
      },
    },
    "/api/tasks/{id}/visual": {
      post: {
        tags: ["Task Execution"],
        summary: "Visual HTML 제출 (set_visual_html)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["node_id", "html"],
                properties: {
                  node_id: { type: "integer" },
                  html: {
                    type: "string",
                    description: "Visual Selection UI HTML",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Visual HTML 저장 완료" } },
      },
    },
    // ─── Folders ───
    "/api/folders": {
      get: {
        tags: ["Folders"],
        summary: "폴더 목록 조회",
        parameters: [
          {
            name: "parent_id",
            in: "query",
            schema: { type: "integer" },
            description: "상위 폴더 ID로 필터링",
          },
        ],
        responses: { "200": { description: "폴더 목록" } },
      },
      post: {
        tags: ["Folders"],
        summary: "폴더 생성",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  parent_id: { type: "integer" },
                  visibility: {
                    type: "string",
                    enum: ["personal", "group", "public", "inherit"],
                    default: "personal",
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "생성된 폴더" } },
      },
    },
  },
  components: {
    schemas: {
      Instruction: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "코드 리뷰 규칙" },
          content: {
            type: "string",
            example: "모든 PR에 보안 취약점을 우선 검토합니다.",
          },
          agent_type: {
            type: "string",
            enum: ["general", "coding", "research", "writing", "data"],
            example: "coding",
          },
          tags: {
            type: "string",
            description: "JSON 배열 문자열",
            example: '["보안","필수"]',
          },
          priority: {
            type: "integer",
            description: "높을수록 우선",
            example: 10,
          },
          is_active: { type: "integer", enum: [0, 1], example: 1 },
          created_at: {
            type: "string",
            format: "date-time",
            example: "2026-04-07 05:54:12",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            example: "2026-04-07 05:54:12",
          },
        },
      },
      InstructionCreate: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", example: "코드 리뷰 규칙" },
          content: {
            type: "string",
            default: "",
            example: "모든 PR에 보안 취약점을 우선 검토합니다.",
          },
          agent_type: {
            type: "string",
            enum: ["general", "coding", "research", "writing", "data"],
            default: "general",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            default: [],
            example: ["보안", "필수"],
          },
          priority: { type: "integer", default: 0, example: 10 },
        },
      },
      InstructionUpdate: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          agent_type: {
            type: "string",
            enum: ["general", "coding", "research", "writing", "data"],
          },
          tags: { type: "array", items: { type: "string" } },
          priority: { type: "integer" },
          is_active: { type: "boolean" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "NOT_FOUND" },
              message: { type: "string", example: "지침을 찾을 수 없습니다" },
            },
          },
        },
      },
      WorkflowNode: {
        type: "object",
        properties: {
          id: { type: "integer" },
          workflow_id: { type: "integer" },
          step_order: { type: "integer", example: 1 },
          title: { type: "string", example: "PR 목록 수집" },
          instruction: { type: "string" },
          instruction_id: {
            type: "integer",
            nullable: true,
            description: "참조하는 instruction template ID (null이면 inline)",
          },
          node_type: {
            type: "string",
            enum: ["action", "gate", "loop"],
            example: "action",
          },
          hitl: {
            type: "boolean",
            default: false,
            description: "action 노드에서 사람 승인 필요 여부",
          },
          visual_selection: {
            type: "boolean",
            default: false,
            description: "gate 노드에서 HTML 클릭 선택 UI 사용 여부",
          },
          loop_back_to: {
            type: "integer",
            nullable: true,
            description: "loop 노드의 반복 대상 step_order",
          },
          auto_advance: {
            type: "integer",
            enum: [0, 1],
            description: "1=자동 진행 (action), 0=수동 (gate/loop)",
          },
          credential_id: { type: "integer", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      NodeCreate: {
        type: "object",
        required: ["title", "node_type"],
        properties: {
          title: { type: "string" },
          instruction: { type: "string" },
          node_type: {
            type: "string",
            enum: ["action", "gate", "loop"],
          },
          hitl: { type: "boolean" },
          visual_selection: { type: "boolean" },
          loop_back_to: { type: "integer" },
          credential_id: { type: "integer" },
          instruction_id: { type: "integer" },
        },
      },
      NodeUpdate: {
        type: "object",
        description:
          "변경할 필드만 전송. inline instruction은 instruction 필드로 직접 수정.",
        properties: {
          title: { type: "string" },
          instruction: { type: "string" },
          node_type: { type: "string", enum: ["action", "gate", "loop"] },
          hitl: { type: "boolean" },
          visual_selection: { type: "boolean" },
          loop_back_to: { type: "integer" },
          credential_id: { type: "integer" },
          instruction_id: { type: "integer" },
        },
      },
      NodeAttachment: {
        type: "object",
        properties: {
          id: { type: "integer" },
          filename: { type: "string" },
          mime_type: { type: "string" },
          size_bytes: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      NodeAttachmentContent: {
        allOf: [
          { $ref: "#/components/schemas/NodeAttachment" },
          {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Text file content (text files only)",
              },
            },
          },
        ],
      },
      ExecuteStep: {
        type: "object",
        required: ["node_id", "output", "status"],
        properties: {
          node_id: { type: "integer" },
          output: { type: "string" },
          status: { type: "string", enum: ["completed", "success", "failed"] },
          visual_html: { type: "string" },
          loop_continue: {
            type: "boolean",
            description: "true면 loop 반복, false면 loop 종료",
          },
          context_snapshot: { type: "object" },
          structured_output: { type: "object" },
          artifacts: { type: "array" },
          session_id: { type: "string" },
          user_name: { type: "string" },
          model_id: { type: "string" },
        },
      },
      WorkflowWithNodes: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string", example: "코드 리뷰 워크플로" },
          description: {
            type: "string",
            example: "PR 리뷰를 단계적으로 수행합니다",
          },
          nodes: {
            type: "array",
            items: { $ref: "#/components/schemas/WorkflowNode" },
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      WorkflowCreate: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", example: "코드 리뷰 워크플로" },
          description: { type: "string", default: "" },
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                instruction: { type: "string" },
              },
            },
          },
        },
      },
      Task: {
        type: "object",
        properties: {
          id: { type: "integer" },
          workflow_id: { type: "integer" },
          status: {
            type: "string",
            enum: ["pending", "running", "completed", "failed"],
          },
          current_step: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      TaskLog: {
        type: "object",
        properties: {
          id: { type: "integer" },
          task_id: { type: "integer" },
          node_id: { type: "integer" },
          step_order: { type: "integer" },
          status: { type: "string", enum: ["running", "completed", "failed"] },
          output: { type: "string" },
          started_at: { type: "string", format: "date-time" },
          completed_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      TaskWithLogs: {
        type: "object",
        properties: {
          id: { type: "integer" },
          workflow_id: { type: "integer" },
          workflow_title: { type: "string", nullable: true },
          status: { type: "string" },
          current_step: { type: "integer" },
          logs: {
            type: "array",
            items: { $ref: "#/components/schemas/TaskLog" },
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      CredentialMasked: {
        type: "object",
        description:
          "Credential (secrets 마스킹됨). 원본 secrets는 MCP를 통해서만 접근 가능.",
        properties: {
          id: { type: "integer" },
          service_name: {
            type: "string",
            example: "threads",
            description: "서비스 식별자",
          },
          description: { type: "string" },
          secrets_masked: {
            type: "object",
            example: {
              ACCESS_TOKEN: "ig_FGA...****7k2Q",
              USER_ID: "1234****5678",
            },
            description:
              "마스킹된 시크릿 (10자 이상: 앞6+****+뒤4, 10자 미만: 앞2+****)",
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
};
