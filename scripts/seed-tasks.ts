#!/usr/bin/env -S npx tsx
import { Pool, type PoolClient } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://bluekiwi:bluekiwi_dev_2026@localhost:5433/bluekiwi";

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

type TaskSeedStatus = "pending" | "running" | "completed" | "failed";

type SeedComment = {
  stepOrder: number;
  comment: string;
  author: string;
};

type SeedArtifact = {
  stepOrder: number;
  title: string;
  url?: string;
  filePath?: string;
};

type SeedLog = {
  stepOrder: number;
  status: TaskSeedStatus | "running" | "pending" | "completed" | "failed";
  title: string;
  nodeType: "action" | "gate" | "loop";
  output: string;
  durationSeconds: number;
  modelId?: string;
  userName?: string;
  iteration?: number;
  structuredOutput?: {
    assistant_output: string;
    user_input?: string;
    thinking?: string;
  };
  visualHtml?: string;
};

type SeedTask = {
  status: TaskSeedStatus;
  currentStep: number;
  context: string;
  summary: string;
  logs: SeedLog[];
  comments: SeedComment[];
  artifacts?: SeedArtifact[];
};

type WorkflowNodeSeed = {
  stepOrder: number;
  title: string;
  nodeType: "action" | "gate" | "loop";
  instruction: string;
  autoAdvance: boolean;
  loopBackTo?: number | null;
};

const WORKFLOW_TITLE = "bluekiwi UI Demo Workflow";

const WORKFLOW_NODES: WorkflowNodeSeed[] = [
  {
    stepOrder: 1,
    title: "요구사항 이해",
    nodeType: "action",
    instruction: "사용자 목표를 파악하고 핵심 요구사항을 정리한다.",
    autoAdvance: true,
  },
  {
    stepOrder: 2,
    title: "리스크 게이트",
    nodeType: "gate",
    instruction: "요건에 대한 정책/보안 리스크를 선별하고 이슈를 기록한다.",
    autoAdvance: false,
  },
  {
    stepOrder: 3,
    title: "반복 검토",
    nodeType: "loop",
    instruction: "필요할 경우 결과를 반복 보완한다.",
    autoAdvance: false,
    loopBackTo: 2,
  },
  {
    stepOrder: 4,
    title: "최종 정리",
    nodeType: "action",
    instruction: "최종 정리본을 작성하고 실행 가능한 아웃풋을 남긴다.",
    autoAdvance: true,
  },
];

const TASK_SEEDS: SeedTask[] = [
  {
    status: "completed",
    currentStep: 4,
    context: "실행 가능한 UX 개선 체크리스트 정리",
    summary:
      "요구사항 정리가 완료되어 최종 결과물 작성까지 모두 성공적으로 종료된 데모 태스크.",
    logs: [
      {
        stepOrder: 1,
        status: "completed",
        title: "요구사항 이해",
        nodeType: "action",
        output:
          "요구사항 정리 완료.\n\n- 목표: 지침 페이지 가독성 향상\n- 제약: shadcn 기반 디자인 가이드 준수\n- 산출물: 개선 항목 12개",
        durationSeconds: 68,
        userName: "system",
        modelId: "demo-model-1",
        structuredOutput: {
          user_input: "현재 요구사항은 지침 페이지 UX를 개선하는 것입니다.",
          assistant_output:
            "요청을 충족하기 위해 현재 구조를 유지한 상태에서 카드 밀도와 간격, 마크다운 렌더링 개선을 제안합니다.",
          thinking:
            "요구사항 충돌이 있는지, 기존 디자인 변수를 먼저 정리해야 함.",
        },
      },
      {
        stepOrder: 2,
        status: "completed",
        title: "리스크 게이트",
        nodeType: "gate",
        output:
          "탐지된 리스크: 인증 화면에서 `title`과 `service`가 중복 표시될 수 있음.\n\n추천 조치:\n- 단일 소스 텍스트 사용",
        durationSeconds: 34,
        modelId: "demo-model-1",
      },
      {
        stepOrder: 3,
        status: "completed",
        title: "반복 검토",
        nodeType: "loop",
        output: "반복 1/2: 체크리스트 및 컴포넌트 간 일관성 확인 완료.",
        durationSeconds: 42,
        modelId: "demo-model-1",
        iteration: 1,
      },
      {
        stepOrder: 3,
        status: "completed",
        title: "반복 검토",
        nodeType: "loop",
        output: "반복 2/2: 카드 헤더 구분색과 태그 입력 UX를 보강하여 확정.",
        durationSeconds: 36,
        modelId: "demo-model-1",
        iteration: 2,
      },
      {
        stepOrder: 4,
        status: "completed",
        title: "최종 정리",
        nodeType: "action",
        output: "최종 아티팩트: 디자인 가이드 검수 보고서와 샘플 뷰 반영 완료.",
        durationSeconds: 55,
        modelId: "demo-model-1",
        visualHtml: "<div><h1>Demo complete</h1><p>All good.</p></div>",
      },
    ],
    comments: [
      {
        stepOrder: 1,
        author: "planner",
        comment:
          "요구사항 범위가 합리적입니다. 즉시 반영 가능한 항목만 남기겠습니다.",
      },
      {
        stepOrder: 2,
        author: "reviewer",
        comment:
          "게이트 단계에서 중복 텍스트 표시 문제가 확인되어 조치가 반영됐습니다.",
      },
      {
        stepOrder: 4,
        author: "operator",
        comment: "최종 요약과 산출물이 예상대로 작성되었습니다.",
      },
    ],
    artifacts: [
      {
        stepOrder: 4,
        title: "design-guide-checklist.md",
        filePath: "/tmp/demo/design-guide-checklist.md",
      },
    ],
  },
  {
    status: "running",
    currentStep: 3,
    context: "인증 토큰 기반 크리덴셜 카드 UX 테스트",
    summary: "루프 검토 단계에서 사용자 피드백 반영 중.",
    logs: [
      {
        stepOrder: 1,
        status: "completed",
        title: "요구사항 이해",
        nodeType: "action",
        output: "요청: 카드 컴팩트 모드에서 편집 상태로 전환 UX 필요.",
        durationSeconds: 49,
        userName: "designer",
        modelId: "demo-model-2",
      },
      {
        stepOrder: 2,
        status: "completed",
        title: "리스크 게이트",
        nodeType: "gate",
        output: "리스크: 카드 클릭 이벤트가 헤더 편집 모드와 충돌 가능성 있음.",
        durationSeconds: 26,
      },
      {
        stepOrder: 3,
        status: "running",
        title: "반복 검토",
        nodeType: "loop",
        output: "현재 반복 2차, 사용자 확인 텍스트/버튼 동작 정의 중.",
        durationSeconds: 12,
        modelId: "demo-model-2",
        iteration: 1,
      },
    ],
    comments: [
      {
        stepOrder: 3,
        author: "operator",
        comment: "현재 편집 모드 이동은 더블클릭으로만 트리거되도록 조정 필요.",
      },
    ],
    artifacts: [
      {
        stepOrder: 3,
        title: "credential-card-prototype.html",
        filePath: "/tmp/demo/credential-card-prototype.html",
      },
    ],
  },
  {
    status: "failed",
    currentStep: 2,
    context: "워크플로우 중단 테스트 (실패 시나리오)",
    summary: "검증 단계에서 정책 조건 충족 실패로 종료.",
    logs: [
      {
        stepOrder: 1,
        status: "completed",
        title: "요구사항 이해",
        nodeType: "action",
        output: "요청사항 수신 및 실행 계획 수립 완료.",
        durationSeconds: 36,
        modelId: "demo-model-3",
      },
      {
        stepOrder: 2,
        status: "failed",
        title: "리스크 게이트",
        nodeType: "gate",
        output:
          "실패: API 응답 형식 불일치로 필수 체크리스트를 충족하지 못해 중단.",
        durationSeconds: 18,
        modelId: "demo-model-3",
      },
    ],
    comments: [
      {
        stepOrder: 2,
        author: "qa",
        comment:
          "테스트 데이터 응답 스키마가 명세와 다릅니다. 스키마 확정이 필요합니다.",
      },
    ],
    artifacts: [
      {
        stepOrder: 2,
        title: "failure-log.json",
        filePath: "/tmp/demo/failure-log.json",
      },
    ],
  },
];

function nowAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

async function ensureWorkflow(client: PoolClient) {
  const { rows: existing } = await client.query(
    "SELECT id FROM workflows WHERE title = $1 LIMIT 1",
    [WORKFLOW_TITLE],
  );
  if (existing.length > 0) return existing[0].id as number;

  const workflowInsert = await client.query<{ id: number }>(
    `INSERT INTO workflows (title, description) VALUES ($1, $2) RETURNING id`,
    [WORKFLOW_TITLE, "BlueKiwi 태스크 카드 UI 점검용 데모 워크플로우"],
  );
  return workflowInsert.rows[0].id;
}

async function ensureWorkflowNodes(client: PoolClient, workflowId: number) {
  const nodes: number[] = [];

  for (const seed of WORKFLOW_NODES) {
    const { rows } = await client.query<{ id: number }>(
      "SELECT id FROM workflow_nodes WHERE workflow_id = $1 AND step_order = $2 LIMIT 1",
      [workflowId, seed.stepOrder],
    );

    if (rows.length > 0) {
      const nodeId = rows[0].id;
      await client.query(
        `UPDATE workflow_nodes
         SET title = $1, node_type = $2, instruction = $3, auto_advance = $4, loop_back_to = $5
         WHERE id = $6`,
        [
          seed.title,
          seed.nodeType,
          seed.instruction,
          seed.autoAdvance ? 1 : 0,
          seed.loopBackTo ?? null,
          nodeId,
        ],
      );
      nodes.push(nodeId);
      continue;
    }

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO workflow_nodes
       (workflow_id, step_order, node_type, title, instruction, auto_advance, loop_back_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        workflowId,
        seed.stepOrder,
        seed.nodeType,
        seed.title,
        seed.instruction,
        seed.autoAdvance ? 1 : 0,
        seed.loopBackTo ?? null,
      ],
    );
    nodes.push(inserted.rows[0].id);
  }

  return nodes;
}

async function createTaskSeed(
  client: PoolClient,
  workflowId: number,
  seed: SeedTask,
  nodes: number[],
) {
  const task = await client.query<{ id: number }>(
    `INSERT INTO tasks
     (workflow_id, status, current_step, context, summary)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [workflowId, seed.status, seed.currentStep, seed.context, seed.summary],
  );
  const taskId = task.rows[0].id;

  const nodeByStep = new Map<number, number>(
    WORKFLOW_NODES.map((node) => [
      node.stepOrder,
      nodes[node.stepOrder - 1],
    ]).filter((pair): pair is [number, number] => pair[1] !== undefined),
  );

  for (let i = 0; i < seed.logs.length; i += 1) {
    const log = seed.logs[i];
    const nodeId = nodeByStep.get(log.stepOrder);
    if (!nodeId) {
      throw new Error(
        `workflow node missing for step_order=${log.stepOrder} (task context=${seed.context})`,
      );
    }

    const startedAt = nowAgo(7200 + i * 120 + (log.iteration ?? 0) * 30);
    const completedAt = nowAgo(7200 - i * 80 - (log.iteration ?? 0) * 10);

    await client.query(
      `INSERT INTO task_logs
       (task_id, node_id, step_order, status, output, node_title, node_type, model_id, user_name,
        started_at, completed_at, structured_output, visual_html)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        taskId,
        nodeId,
        log.stepOrder,
        log.status,
        log.output,
        log.title,
        log.nodeType,
        log.modelId ?? null,
        log.userName ?? "system",
        startedAt,
        completedAt,
        log.structuredOutput ? JSON.stringify(log.structuredOutput) : null,
        log.visualHtml ?? null,
      ],
    );
  }

  for (const comment of seed.comments) {
    await client.query(
      `INSERT INTO task_comments (task_id, step_order, comment, created_at)
       VALUES ($1, $2, $3, $4)`,
      [
        taskId,
        comment.stepOrder,
        `[${comment.author}] ${comment.comment}`,
        nowAgo(2400 + comment.stepOrder * 50),
      ],
    );
  }

  if (seed.artifacts && seed.artifacts.length > 0) {
    for (const artifact of seed.artifacts) {
      await client.query(
        `INSERT INTO task_artifacts (task_id, step_order, artifact_type, title, file_path, url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          taskId,
          artifact.stepOrder,
          "file",
          artifact.title,
          artifact.filePath ?? null,
          artifact.url ?? null,
        ],
      );
    }
  }

  return taskId;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const workflowId = await ensureWorkflow(client);
    const nodeIds = await ensureWorkflowNodes(client, workflowId);

    const inserted: number[] = [];
    for (const seed of TASK_SEEDS) {
      const taskId = await createTaskSeed(client, workflowId, seed, nodeIds);
      inserted.push(taskId);
    }

    await client.query("COMMIT");

    console.log("✅ seed-tasks completed");
    console.log(`Workflow: ${WORKFLOW_TITLE} (id=${workflowId})`);
    console.log(`Inserted ${inserted.length} tasks: ${inserted.join(", ")}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("seed-tasks failed:", error);
  process.exit(1);
});
