export interface ModificationTarget {
    // 파일의 절대 경로 또는 워크스페이스 상대 경로
    filePath: string;

    // 하이라이트할 줄 번호 배열 (기본적으로 1-indexed 사용을 권장)
    lines: number[];

    // (선택 사항) 해당 라인을 왜 고치는지에 대한 설명
    reason?: string;

    // (선택 사항) 변경 유형: 'logic_change' | 'refactor' | 'suggestion'
    // 유형에 따라 형광펜 색상을 다르게 적용할 수 있습니다.
    changeType?: 'logic_change' | 'refactor' | 'suggestion';
}

/**
 * AI 에이전트로부터 수신할 전체 메시지 구조
 */
export interface AgentModificationPlan {
    // 작업의 고유 ID (여러 수정을 관리할 경우 필요)
    planId: string;

    // 수정 대상 파일들의 목록
    targets: ModificationTarget[];

    // 에이전트의 상태 (예: 'planning', 'applying', 'completed')
    status: 'suggestion' | 'confirmed';
}