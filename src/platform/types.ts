export interface OpenedFile {
  name: string;
  data: Uint8Array;
  /** desktop: absolute path; web: FileSystemFileHandle */
  path?: string;
  handle?: unknown;
}

export interface SaveTarget {
  name: string;
  path?: string;
  handle?: unknown;
}

export interface BackupEntry {
  id: string;
  projectId: string;
  name: string;
  time: number;
  daily: boolean;
  size: number;
}

export interface RecoveryEntry {
  projectId: string;
  name: string;
  time: number;
  /** true when changes were never written to the real file */
  unsaved: boolean;
  path?: string;
}

export interface RecentEntry {
  name: string;
  path?: string;
  projectId?: string;
  time: number;
  /** web: stored only in the browser library */
  library?: boolean;
}

export interface Platform {
  kind: 'web' | 'desktop';
  canSaveInPlace: boolean;
  open(accept: string[]): Promise<OpenedFile | null>;
  /** save to an existing target (no dialog) */
  write(target: SaveTarget, data: Uint8Array): Promise<boolean>;
  /** ask for a location and save */
  saveAs(suggested: string, data: Uint8Array, ext: string, mime: string): Promise<SaveTarget | null>;
  /** export a file (download on the web, save dialog on desktop) */
  exportFile(suggested: string, data: Uint8Array | string, mime: string): Promise<void>;
  /** desktop only: render HTML to PDF through Chromium */
  printToPDF?(html: string, opts: { pageWidthIn: number; pageHeightIn: number }): Promise<Uint8Array | null>;
  /** open the print dialog for HTML */
  print(html: string): Promise<void>;

  writeRecovery(e: RecoveryEntry, data: Uint8Array): Promise<void>;
  listRecovery(): Promise<RecoveryEntry[]>;
  readRecovery(projectId: string): Promise<Uint8Array | null>;
  clearRecovery(projectId: string): Promise<void>;

  writeBackup(projectId: string, name: string, data: Uint8Array): Promise<void>;
  listBackups(projectId?: string): Promise<BackupEntry[]>;
  readBackup(id: string): Promise<Uint8Array | null>;
  openBackupFolder?(): void;

  recent(): Promise<RecentEntry[]>;
  addRecent(e: RecentEntry): Promise<void>;
  removeRecent(e: RecentEntry): Promise<void>;
  /** desktop: read a file by path (recent files) */
  readPath?(path: string): Promise<OpenedFile | null>;
  /** files passed on the command line / double-clicked */
  pendingOpen?(): Promise<OpenedFile | null>;
  onMenu?(cb: (cmd: string) => void): void;
  setTitle(t: string): void;
  setDirty?(dirty: boolean): void;
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, v: string | null): Promise<void>;
  addSpellWord?(w: string): void;
  checkForUpdates?(): void;
  appVersion(): string;
}
