"use client";

// PRD_양식편집기_상세 §18 Phase 0: "편집 명령과 undo/redo 모델", §19: "모든 상태 변경은
// undo 가능한 명령으로 구현한다". 서버가 진실의 원천이므로 각 명령은 do/undo 모두
// 실제 API 호출을 수행한다 (로컬 상태만 되돌리는 게 아니다).
import { useCallback, useRef, useState } from "react";

export type Command = {
  label: string;
  do: () => Promise<void> | void;
  undo: () => Promise<void> | void;
};

export function useCommandStack() {
  const undoStack = useRef<Command[]>([]);
  const redoStack = useRef<Command[]>([]);
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });
  const sync = () => setCounts({ undo: undoStack.current.length, redo: redoStack.current.length });

  const run = useCallback(async (cmd: Command) => {
    await cmd.do();
    undoStack.current.push(cmd);
    redoStack.current = [];
    sync();
  }, []);

  // 이미 실행된 명령(예: 드래그가 끝나 서버에 이미 반영된 이동)을 스택에만 등록할 때 사용.
  const record = useCallback((cmd: Command) => {
    undoStack.current.push(cmd);
    redoStack.current = [];
    sync();
  }, []);

  const undo = useCallback(async () => {
    const cmd = undoStack.current.pop();
    if (!cmd) return;
    await cmd.undo();
    redoStack.current.push(cmd);
    sync();
  }, []);

  const redo = useCallback(async () => {
    const cmd = redoStack.current.pop();
    if (!cmd) return;
    await cmd.do();
    undoStack.current.push(cmd);
    sync();
  }, []);

  return {
    run,
    record,
    undo,
    redo,
    canUndo: counts.undo > 0,
    canRedo: counts.redo > 0,
  };
}
