export interface CultivationState {
  realmMajor: number;
  realmSub: number;
  realmName: string;
  linhKhi: number;
  linhKhiRequired: number;
  canBreakthrough: boolean;
  isMaxStage: boolean;
  punishedUntil: string | null;
  cultivationRate: number;
}

export interface BreakthroughResult {
  success: boolean;
  character: {
    id: string;
    userId: string;
    realmMajor: number;
    realmSub: number;
    linhKhi: number;
    lastUpdateAt: string;
    breakthroughFails: number;
    punishedUntil: string | null;
    createdAt: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface ToastItem {
  id: number;
  title: string;
  message: string;
  type: "success" | "danger" | "purple" | "info";
}
