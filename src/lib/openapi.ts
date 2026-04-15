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
    { name: "Settings", description: "설정 및 관리 작업" },
    { name: "Folders", description: "폴더 및 공유 관리" },
    { name: "Auth", description: "인증 및 사용자 세션 관리" },
    { name: "Users", description: "사용자 관리 (admin 전용)" },
    { name: "API Keys", description: "API 키 발급 및 관리" },
    { name: "Invites", description: "팀 초대 관리" },
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
              enum: ["pending", "running", "completed", "failed", "timed_out"],
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
                    enum: [
                      "pending",
                      "running",
                      "completed",
                      "failed",
                      "timed_out",
                    ],
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
      delete: {
        tags: ["Tasks"],
        summary: "태스크 삭제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "삭제 완료" },
          "404": { description: "태스크를 찾을 수 없음" },
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
    "/api/workflows/{id}/node-items/{nodeId}": {
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
    "/api/workflows/{id}/node-items/{nodeId}/attachments": {
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
    "/api/workflows/{id}/node-items/{nodeId}/attachments/{attachId}": {
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
        description:
          "에이전트가 사용자의 Visual Selection 응답을 폴링합니다. node_id를 지정하면 해당 노드의 응답 이력을 순서대로 반환합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "node_id",
            in: "query",
            required: false,
            schema: { type: "integer" },
            description:
              "특정 노드 ID. 지정하면 최신 응답 대신 해당 노드의 history 배열을 반환합니다.",
          },
        ],
        responses: {
          "200": {
            description: "web_response가 null이면 아직 응답 없음",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      oneOf: [
                        {
                          type: "object",
                          properties: {
                            task_id: { type: "integer" },
                            node_id: { type: "integer" },
                            step_order: { type: "integer" },
                            web_response: {
                              description: "가장 최근의 응답",
                            },
                          },
                        },
                        {
                          type: "object",
                          properties: {
                            task_id: { type: "integer" },
                            node_id: { type: "integer" },
                            history: {
                              type: "array",
                              description:
                                "해당 node_id에 대해 저장된 응답 이력 (오래된 순)",
                              items: {
                                type: "object",
                                properties: {
                                  iteration: { type: "integer" },
                                  web_response: {
                                    description: "파싱된 응답 payload",
                                  },
                                  created_at: {
                                    type: "string",
                                    format: "date-time",
                                  },
                                },
                              },
                            },
                          },
                        },
                        {
                          type: "object",
                          properties: {
                            task_id: { type: "integer" },
                            web_response: {
                              nullable: true,
                              description: "응답이 아직 없으면 null",
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
                  response: {
                    oneOf: [
                      { type: "string" },
                      {
                        type: "object",
                        description:
                          "Structured VS payload. Common keys include selections, values, ranking, matrix, comment, fields, and option_comments.",
                      },
                    ],
                  },
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
        description:
          "Visual Selector UI를 저장합니다. 전체 HTML 문서뿐 아니라 프레임에 삽입되는 fragment 기반 콘텐츠도 지원하며, fragment는 bk-* 컴포넌트 클래스를 사용해 작성할 수 있습니다.",
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
                    description:
                      "Visual Selection UI HTML. 전체 문서 또는 bk-* 컴포넌트를 사용하는 fragment 기반 콘텐츠를 전달할 수 있습니다.",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Visual HTML 저장 완료" } },
      },
    },
    "/api/settings/cleanup-visual-html": {
      post: {
        tags: ["Settings"],
        summary: "완료된 태스크의 visual_html 정리",
        description:
          "superuser 전용 엔드포인트입니다. 완료된 태스크 로그에 남아 있는 visual_html 값을 정리하고 삭제된 개수를 반환합니다.",
        responses: {
          "200": {
            description: "정리 완료",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        cleared: {
                          type: "integer",
                          description: "null 처리된 visual_html 레코드 수",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "403": {
            description: "superuser 권한 필요",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
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
    // ─── Folders: {id} CRUD + shares + visibility + transfer ───
    "/api/folders/{id}": {
      get: {
        tags: ["Folders"],
        summary: "폴더 단건 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "폴더 상세" },
          "404": { description: "폴더 없음" },
        },
      },
      put: {
        tags: ["Folders"],
        summary: "폴더 수정",
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
                  name: { type: "string" },
                  description: { type: "string" },
                  visibility: {
                    type: "string",
                    enum: ["personal", "group", "public", "inherit"],
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "수정된 폴더" } },
      },
      delete: {
        tags: ["Folders"],
        summary: "폴더 삭제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "삭제 완료" } },
      },
    },
    "/api/folders/{id}/shares": {
      get: {
        tags: ["Folders"],
        summary: "폴더 공유 목록",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "공유 목록" } },
      },
      post: {
        tags: ["Folders"],
        summary: "폴더 그룹 공유",
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
                required: ["group_id", "access_level"],
                properties: {
                  group_id: { type: "integer" },
                  access_level: {
                    type: "string",
                    enum: ["reader", "contributor"],
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "공유 생성" } },
      },
    },
    "/api/folders/{id}/shares/{groupId}": {
      delete: {
        tags: ["Folders"],
        summary: "폴더 그룹 공유 해제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "groupId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "해제 완료" } },
      },
    },
    "/api/folders/{id}/visibility": {
      post: {
        tags: ["Folders"],
        summary: "폴더 visibility 변경",
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
                required: ["visibility"],
                properties: {
                  visibility: {
                    type: "string",
                    enum: ["personal", "group", "public"],
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "업데이트된 폴더" } },
      },
    },
    "/api/folders/{id}/transfer": {
      post: {
        tags: ["Folders"],
        summary: "폴더 소유권 이전",
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
                required: ["new_owner_id"],
                properties: { new_owner_id: { type: "integer" } },
              },
            },
          },
        },
        responses: { "200": { description: "이전 완료" } },
      },
    },
    // ─── Instructions: visibility + transfer ───
    "/api/instructions/{id}/visibility": {
      post: {
        tags: ["Instructions"],
        summary: "지침 visibility override 설정",
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
                  override: {
                    type: "string",
                    enum: ["personal", "group", "public"],
                    nullable: true,
                    description: "null이면 폴더 visibility 상속",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "업데이트된 지침" } },
      },
    },
    "/api/instructions/{id}/transfer": {
      post: {
        tags: ["Instructions"],
        summary: "지침 소유권 이전",
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
                required: ["new_owner_id"],
                properties: { new_owner_id: { type: "integer" } },
              },
            },
          },
        },
        responses: { "200": { description: "이전 완료" } },
      },
    },
    // ─── Workflows: versions, activate, deactivate, shares, visibility, transfer ───
    "/api/workflows/{id}/versions": {
      get: {
        tags: ["Workflows"],
        summary: "워크플로 버전 목록",
        description: "동일 family_root_id를 가진 모든 버전을 반환합니다.",
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
            description: "버전 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        family_root_id: { type: "integer" },
                        active_version_id: {
                          type: "integer",
                          nullable: true,
                        },
                        versions: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "integer" },
                              title: { type: "string" },
                              version: { type: "string" },
                              is_active: { type: "boolean" },
                              parent_workflow_id: {
                                type: "integer",
                                nullable: true,
                              },
                              created_at: {
                                type: "string",
                                format: "date-time",
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
          },
          "404": { description: "워크플로 없음" },
        },
      },
    },
    "/api/workflows/{id}/activate": {
      post: {
        tags: ["Workflows"],
        summary: "워크플로 버전 활성화",
        description:
          "같은 family 내 기존 활성 버전을 비활성화하고 지정 버전을 활성화합니다.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "활성화 결과 (already_active 포함)" },
          "403": { description: "권한 없음" },
          "404": { description: "워크플로 없음" },
        },
      },
    },
    "/api/workflows/{id}/deactivate": {
      post: {
        tags: ["Workflows"],
        summary: "워크플로 버전 비활성화",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "비활성화 완료" },
          "404": { description: "워크플로 없음" },
        },
      },
    },
    "/api/workflows/{id}/shares": {
      get: {
        tags: ["Workflows"],
        summary: "워크플로 공유 목록",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "공유 목록 (group_name 포함)" } },
      },
      post: {
        tags: ["Workflows"],
        summary: "워크플로 그룹 공유 (upsert)",
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
                required: ["group_id", "access_level"],
                properties: {
                  group_id: { type: "integer" },
                  access_level: {
                    type: "string",
                    enum: ["reader", "contributor"],
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "공유 생성/업데이트" } },
      },
    },
    "/api/workflows/{id}/shares/{groupId}": {
      delete: {
        tags: ["Workflows"],
        summary: "워크플로 그룹 공유 해제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "groupId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "해제 완료" } },
      },
    },
    "/api/workflows/{id}/visibility": {
      post: {
        tags: ["Workflows"],
        summary: "워크플로 visibility override 설정",
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
                  override: {
                    type: "string",
                    enum: ["personal", "group", "public"],
                    nullable: true,
                    description: "null이면 폴더 visibility 상속",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "업데이트된 워크플로" } },
      },
    },
    "/api/workflows/{id}/transfer": {
      post: {
        tags: ["Workflows"],
        summary: "워크플로 소유권 이전",
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
                required: ["new_owner_id"],
                properties: { new_owner_id: { type: "integer" } },
              },
            },
          },
        },
        responses: { "200": { description: "이전 완료" } },
      },
    },
    // ─── Tasks: start, timeout-stale (new endpoints) ───
    "/api/tasks/start": {
      post: {
        tags: ["Tasks"],
        summary: "워크플로 태스크 시작 (start_workflow)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TaskStart" },
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
                  properties: {
                    data: { $ref: "#/components/schemas/TaskWithLogs" },
                  },
                },
              },
            },
          },
          "400": { description: "유효성 검증 실패" },
          "404": { description: "워크플로 없음" },
        },
      },
    },
    "/api/tasks/timeout-stale": {
      get: {
        tags: ["Tasks"],
        summary: "비활성 태스크 조회 (dry-run)",
        description:
          "timeout_minutes 이상 비활성 상태인 running/timed_out 태스크 목록을 반환합니다. 실제 상태 변경은 없습니다.",
        parameters: [
          {
            name: "timeout_minutes",
            in: "query",
            schema: { type: "integer", default: 120 },
            description: "비활성 기준 시간(분)",
          },
        ],
        responses: { "200": { description: "비활성 태스크 목록" } },
      },
      post: {
        tags: ["Tasks"],
        summary: "비활성 태스크 일괄 timed_out 전환",
        description:
          "timeout_minutes 이상 비활성 상태인 running 태스크를 timed_out으로 전환합니다. bk-start 스킬이 워크플로 실행 전 호출합니다.",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  timeout_minutes: { type: "integer", default: 120 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "전환 결과",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        timed_out_count: { type: "integer" },
                        task_ids: {
                          type: "array",
                          items: { type: "integer" },
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
    },
    "/api/tasks/{id}/heartbeat": {
      post: {
        tags: ["Task Execution"],
        summary: "단계 진행 상황 핑 (heartbeat)",
        description:
          "진행 중인 단계 로그에 진행 메시지를 추가하여 태스크 활성 상태를 유지합니다.",
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
                required: ["node_id", "progress"],
                properties: {
                  node_id: { type: "integer" },
                  progress: {
                    type: "string",
                    description: "진행 상황 메시지 (로그에 append됨)",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "핑 완료" } },
      },
    },
    "/api/tasks/{id}/comments": {
      get: {
        tags: ["Tasks"],
        summary: "태스크 댓글 목록",
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
            description: "댓글 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TaskComment" },
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
        summary: "태스크 댓글 추가",
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
                required: ["step_order", "comment"],
                properties: {
                  step_order: { type: "integer" },
                  comment: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "생성된 댓글",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/TaskComment" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/tasks/{id}/findings": {
      get: {
        tags: ["Tasks"],
        summary: "컴플라이언스 소견 목록 (list_findings)",
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
            description: "소견 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        findings: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/ComplianceFinding",
                          },
                        },
                        total: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Tasks"],
        summary: "컴플라이언스 소견 저장 (save_findings)",
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
                required: ["findings"],
                properties: {
                  findings: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/ComplianceFindingInput",
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "저장된 소견 수",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        inserted: { type: "integer" },
                        ids: { type: "array", items: { type: "integer" } },
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
    "/api/tasks/{id}/feedback": {
      post: {
        tags: ["Tasks"],
        summary: "피드백 저장 (save_feedback)",
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
                required: ["feedback"],
                properties: {
                  feedback: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["question", "answer"],
                      properties: {
                        question: { type: "string" },
                        answer: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "피드백 저장 완료" } },
      },
    },
    // ─── Credentials: reveal, shares, transfer (existing /api/credentials and /api/credentials/{id} defined above) ───
    "/api/credentials/{id}/reveal": {
      get: {
        tags: ["Credentials"],
        summary: "인증정보 원본 secrets 조회",
        description: "editor 이상 권한의 소유자/공유 수신자만 호출 가능합니다.",
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
            description: "복호화된 secrets (평문)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      additionalProperties: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          "403": { description: "권한 없음" },
        },
      },
    },
    "/api/credentials/{id}/shares": {
      get: {
        tags: ["Credentials"],
        summary: "인증정보 공유 목록",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "공유 목록" } },
      },
      post: {
        tags: ["Credentials"],
        summary: "인증정보 그룹 공유",
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
                required: ["group_id", "access_level"],
                properties: {
                  group_id: { type: "integer" },
                  access_level: {
                    type: "string",
                    enum: ["use", "manage"],
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "공유 생성" } },
      },
    },
    "/api/credentials/{id}/shares/{groupId}": {
      delete: {
        tags: ["Credentials"],
        summary: "인증정보 그룹 공유 해제",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
          {
            name: "groupId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "해제 완료" } },
      },
    },
    "/api/credentials/{id}/transfer": {
      post: {
        tags: ["Credentials"],
        summary: "인증정보 소유권 이전",
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
                required: ["new_owner_id"],
                properties: { new_owner_id: { type: "integer" } },
              },
            },
          },
        },
        responses: { "200": { description: "이전 완료" } },
      },
    },
    // ─── Auth ───
    "/api/auth/setup": {
      post: {
        tags: ["Auth"],
        summary: "초기 슈퍼유저 생성",
        description:
          "첫 번째 계정 생성 전에만 사용 가능합니다 (/setup 페이지에서 호출).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "슈퍼유저 생성 완료" },
          "409": { description: "이미 사용자가 존재함" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "로그인",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "로그인 성공 (JWT 쿠키 발급)" },
          "401": { description: "인증 실패" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "로그아웃",
        responses: { "200": { description: "로그아웃 완료" } },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "현재 사용자 정보",
        responses: {
          "200": { description: "사용자 프로필 및 API 키 목록" },
          "401": { description: "미인증" },
        },
      },
      put: {
        tags: ["Auth"],
        summary: "프로필 수정 (이메일 등)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "업데이트된 프로필" } },
      },
    },
    "/api/auth/me/groups": {
      get: {
        tags: ["Auth"],
        summary: "현재 사용자가 속한 그룹 목록",
        responses: { "200": { description: "그룹 목록" } },
      },
    },
    "/api/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "비밀번호 변경",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["current_password", "new_password"],
                properties: {
                  current_password: { type: "string" },
                  new_password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "변경 완료" },
          "401": { description: "현재 비밀번호 불일치" },
        },
      },
    },
    "/api/auth/dashboard": {
      get: {
        tags: ["Auth"],
        summary: "대시보드 통계",
        description: "워크플로, 태스크, 최근 활동 요약을 반환합니다.",
        responses: { "200": { description: "대시보드 데이터" } },
      },
    },
    // ─── API Keys ───
    "/api/apikeys": {
      get: {
        tags: ["API Keys"],
        summary: "내 API 키 목록",
        responses: { "200": { description: "API 키 목록 (key_hash 제외)" } },
      },
      post: {
        tags: ["API Keys"],
        summary: "API 키 발급",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  expires_at: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "발급된 API 키 (key는 이 응답에서만 평문 제공됨)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        key: {
                          type: "string",
                          description: "bk_ 접두사 포함 원본 키 (1회만 노출)",
                        },
                        prefix: { type: "string" },
                        name: { type: "string" },
                        expires_at: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                        created_at: { type: "string", format: "date-time" },
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
    "/api/apikeys/{id}": {
      delete: {
        tags: ["API Keys"],
        summary: "API 키 폐기",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "폐기 완료" },
          "404": { description: "없음" },
        },
      },
    },
    // ─── Users (admin) ───
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "사용자 목록 (admin 전용)",
        responses: {
          "200": { description: "사용자 목록" },
          "403": { description: "권한 없음" },
        },
      },
      post: {
        tags: ["Users"],
        summary: "사용자 생성 (admin 전용)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                  email: { type: "string", format: "email" },
                  role: {
                    type: "string",
                    enum: ["admin", "editor", "viewer"],
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "생성된 사용자" } },
      },
    },
    "/api/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "사용자 단건 조회",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "사용자 정보" },
          "404": { description: "없음" },
        },
      },
      put: {
        tags: ["Users"],
        summary: "사용자 수정 (admin 전용)",
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
                  email: { type: "string" },
                  role: {
                    type: "string",
                    enum: ["admin", "editor", "viewer"],
                  },
                  is_active: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "수정된 사용자" } },
      },
      delete: {
        tags: ["Users"],
        summary: "사용자 삭제 (superuser 전용)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "삭제 완료" } },
      },
    },
    // ─── Invites ───
    "/api/invites": {
      get: {
        tags: ["Invites"],
        summary: "초대 목록 (admin 전용)",
        responses: { "200": { description: "초대 목록" } },
      },
      post: {
        tags: ["Invites"],
        summary: "초대 생성 (admin 전용)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "role"],
                properties: {
                  email: { type: "string", format: "email" },
                  role: {
                    type: "string",
                    enum: ["admin", "editor", "viewer"],
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "초대 토큰 포함 응답" } },
      },
    },
    "/api/invites/{id}": {
      delete: {
        tags: ["Invites"],
        summary: "초대 취소 (admin 전용)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "취소 완료" } },
      },
    },
    "/api/invites/accept/{token}": {
      post: {
        tags: ["Invites"],
        summary: "초대 수락 (계정 생성)",
        description:
          "초대 토큰으로 계정을 생성합니다. `bluekiwi accept` CLI 명령어가 이 엔드포인트를 호출합니다.",
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "계정 생성 및 API 키 발급 완료" },
          "400": { description: "만료 또는 사용된 토큰" },
        },
      },
    },
    // ─── Settings: Groups ───
    "/api/settings/groups": {
      get: {
        tags: ["Settings"],
        summary: "사용자 그룹 목록",
        responses: { "200": { description: "그룹 목록" } },
      },
      post: {
        tags: ["Settings"],
        summary: "그룹 생성 (admin 전용)",
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
                },
              },
            },
          },
        },
        responses: { "201": { description: "생성된 그룹" } },
      },
    },
    "/api/settings/groups/{id}": {
      get: {
        tags: ["Settings"],
        summary: "그룹 단건 조회 (멤버 포함)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "그룹 상세" } },
      },
      put: {
        tags: ["Settings"],
        summary: "그룹 수정 (admin 전용)",
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
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "수정된 그룹" } },
      },
      delete: {
        tags: ["Settings"],
        summary: "그룹 삭제 (admin 전용)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "삭제 완료" } },
      },
    },
    "/api/settings/groups/{id}/members": {
      get: {
        tags: ["Settings"],
        summary: "그룹 멤버 목록",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { "200": { description: "멤버 목록" } },
      },
      post: {
        tags: ["Settings"],
        summary: "그룹 멤버 추가 (admin 전용)",
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
                required: ["user_id"],
                properties: { user_id: { type: "integer" } },
              },
            },
          },
        },
        responses: { "201": { description: "멤버 추가 완료" } },
      },
      delete: {
        tags: ["Settings"],
        summary: "그룹 멤버 제거 (admin 전용)",
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
                required: ["user_id"],
                properties: { user_id: { type: "integer" } },
              },
            },
          },
        },
        responses: { "200": { description: "멤버 제거 완료" } },
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
            enum: ["pending", "running", "completed", "failed", "timed_out"],
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
          status: {
            type: "string",
            enum: ["pending", "running", "completed", "failed", "skipped"],
          },
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
      CredentialCreate: {
        type: "object",
        required: ["service_name"],
        properties: {
          service_name: { type: "string", example: "github" },
          description: { type: "string" },
          secrets: {
            type: "object",
            additionalProperties: { type: "string" },
            example: { ACCESS_TOKEN: "ghp_..." },
          },
          folder_id: { type: "integer", nullable: true },
        },
      },
      CredentialUpdate: {
        type: "object",
        properties: {
          service_name: { type: "string" },
          description: { type: "string" },
          secrets: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          folder_id: { type: "integer", nullable: true },
        },
      },
      TaskStart: {
        type: "object",
        required: ["workflow_id"],
        properties: {
          workflow_id: { type: "integer" },
          context: {
            type: "string",
            description: "태스크 초기 컨텍스트 (사용자 목표 등)",
          },
          session_meta: {
            type: "object",
            description: "에이전트 세션 메타데이터",
          },
          provider_slug: {
            type: "string",
            example: "claude-code",
            description: "에이전트 런타임 슬러그",
          },
          model_slug: {
            type: "string",
            example: "claude-sonnet-4-6",
            description: "사용 모델 슬러그",
          },
        },
      },
      TaskComment: {
        type: "object",
        properties: {
          id: { type: "integer" },
          task_id: { type: "integer" },
          step_order: { type: "integer" },
          rule_id: { type: "string", nullable: true },
          severity: { type: "string", nullable: true },
          comment: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      ComplianceFinding: {
        type: "object",
        properties: {
          id: { type: "integer" },
          task_id: { type: "integer" },
          step_order: { type: "integer", nullable: true },
          rule_id: { type: "string" },
          severity: {
            type: "string",
            enum: ["BLOCK", "REVIEW", "WARN", "INFO"],
          },
          summary: { type: "string" },
          detail: { type: "string", nullable: true },
          fix: { type: "string", nullable: true },
          authority: { type: "string", nullable: true },
          file_path: { type: "string", nullable: true },
          line_number: { type: "integer", nullable: true },
          source: { type: "string", nullable: true },
          metadata: { type: "object", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      ComplianceFindingInput: {
        type: "object",
        required: ["rule_id", "severity", "summary"],
        properties: {
          rule_id: { type: "string" },
          severity: {
            type: "string",
            enum: ["BLOCK", "REVIEW", "WARN", "INFO"],
          },
          summary: { type: "string" },
          detail: { type: "string" },
          fix: { type: "string" },
          authority: { type: "string" },
          file_path: { type: "string" },
          line_number: { type: "integer" },
          source: { type: "string" },
          step_order: { type: "integer" },
          metadata: { type: "object" },
        },
      },
    },
  },
};
