import type {
  SessionCatalogEntry,
  SessionCatalogSnapshot,
  SessionRef,
  WorkspaceCatalogEntry,
  WorkspaceCatalogSnapshot,
  WorkspaceId,
  WorktreeCatalogEntry,
  WorktreeCatalogSnapshot,
  WorktreeId,
} from "./types.js";

export interface CatalogStorage {
  workspaces: {
    listWorkspaces(): Promise<WorkspaceCatalogSnapshot>;
    getWorkspace(workspaceId: WorkspaceId): Promise<WorkspaceCatalogEntry | undefined>;
    upsertWorkspace(entry: WorkspaceCatalogEntry): Promise<void>;
    deleteWorkspace(workspaceId: WorkspaceId): Promise<void>;
  };
  sessions: {
    listSessions(workspaceId?: WorkspaceId): Promise<SessionCatalogSnapshot>;
    getSession(sessionRef: SessionRef): Promise<SessionCatalogEntry | undefined>;
    /** Writes the entry; its stoppedReplyId is ignored, the stored one is kept. */
    upsertSession(entry: SessionCatalogEntry): Promise<void>;
    /**
     * The only writer of stoppedReplyId: sets it, or clears it with undefined. Resolves
     * false, writing nothing, when the session has no entry yet.
     */
    setStoppedReplyId(sessionRef: SessionRef, replyId: string | undefined): Promise<boolean>;
    deleteSession(sessionRef: SessionRef): Promise<void>;
  };
  worktrees: {
    listWorktrees(workspaceId?: WorkspaceId): Promise<WorktreeCatalogSnapshot>;
    getWorktree(worktreeId: WorktreeId): Promise<WorktreeCatalogEntry | undefined>;
    upsertWorktree(entry: WorktreeCatalogEntry): Promise<void>;
    deleteWorktree(worktreeId: WorktreeId): Promise<void>;
    replaceWorkspaceWorktrees(
      workspaceId: WorkspaceId,
      entries: readonly WorktreeCatalogEntry[],
    ): Promise<void>;
  };
}

export interface SessionFileCatalogStorage extends CatalogStorage {
  getSessionFile(sessionRef: SessionRef): Promise<string | undefined>;
  setSessionFile(sessionRef: SessionRef, sessionFile: string): Promise<void>;
  deleteSessionFile(sessionRef: SessionRef): Promise<void>;
  /** Replaces the workspace's entries, keeping each stored entry's stoppedReplyId. */
  replaceWorkspaceSessions(
    workspaceId: WorkspaceId,
    entries: readonly SessionCatalogEntry[],
    sessionFiles: Readonly<Record<string, string>>,
  ): Promise<void>;
}
