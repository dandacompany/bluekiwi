export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "OmegaRod API",
    description: "에이전트 지침 관리 시스템 API",
    version: "1.0.0",
  },
  servers: [{ url: "/", description: "Current server" }],
  tags: [
    { name: "Instructions", description: "에이전트 지침 CRUD" },
    { name: "Chains", description: "체인(워크플로) 관리" },
    { name: "Tasks", description: "태스크 실행 및 모니터링" },
    { name: "Credentials", description: "API 시크릿/인증정보 관리" },
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
    "/api/chains": {
      get: {
        tags: ["Chains"],
        summary: "체인 목록 조회",
        responses: {
          "200": {
            description: "체인 목록 (노드 포함)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ChainWithNodes" },
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
        tags: ["Chains"],
        summary: "체인 생성",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChainCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "생성된 체인",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/ChainWithNodes" },
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
    "/api/chains/{id}": {
      get: {
        tags: ["Chains"],
        summary: "체인 단건 조회",
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
            description: "체인 상세",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/ChainWithNodes" },
                  },
                },
              },
            },
          },
          "404": {
            description: "체인을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Chains"],
        summary: "체인 수정",
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
              schema: { $ref: "#/components/schemas/ChainCreate" },
            },
          },
        },
        responses: {
          "200": {
            description: "수정된 체인",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/ChainWithNodes" },
                  },
                },
              },
            },
          },
          "404": {
            description: "체인을 찾을 수 없음",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Chains"],
        summary: "체인 삭제",
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
            description: "체인을 찾을 수 없음",
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
            name: "chain_id",
            in: "query",
            schema: { type: "integer" },
            description: "체인 ID로 필터링",
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
        summary: "태스크 생성 (체인 실행 시작)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["chain_id"],
                properties: { chain_id: { type: "integer" } },
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
            description: "체인을 찾을 수 없음",
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
                required: ["service_name", "title"],
                properties: {
                  service_name: {
                    type: "string",
                    example: "threads",
                    description: "서비스 식별자",
                  },
                  title: {
                    type: "string",
                    example: "단테 Threads 계정",
                    description: "사람이 읽는 이름",
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
                  title: { type: "string" },
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
      ChainNode: {
        type: "object",
        properties: {
          id: { type: "integer" },
          chain_id: { type: "integer" },
          step_order: { type: "integer", example: 1 },
          title: { type: "string", example: "PR 목록 수집" },
          instruction: {
            type: "string",
            example: "현재 레포의 열린 PR 목록을 수집하세요.",
          },
          created_at: { type: "string", format: "date-time" },
        },
      },
      ChainWithNodes: {
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
            items: { $ref: "#/components/schemas/ChainNode" },
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      ChainCreate: {
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
          chain_id: { type: "integer" },
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
          chain_id: { type: "integer" },
          chain_title: { type: "string", nullable: true },
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
          title: {
            type: "string",
            example: "단테 Threads 계정",
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
