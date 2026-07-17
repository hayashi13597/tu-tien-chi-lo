"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BreakthroughButton } from "@/components/breakthrough-button";
import {
  BreakthroughOverlay,
  type BreakthroughPhase,
} from "@/components/breakthrough-overlay";
import { CosmicBackground } from "@/components/cosmic-background";
import { DantianFormation } from "@/components/dantian-formation";
import { LogoutIcon } from "@/components/icons";
import { LingqiBar } from "@/components/lingqi-bar";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ParticleCanvas,
  type ParticleCanvasHandle,
} from "@/components/particle-canvas";
import { PillInventoryButton } from "@/components/pill-inventory-button";
import { PillModal } from "@/components/pill-modal";
import { RealmPath } from "@/components/realm-path";
import { StatsPanel } from "@/components/stats-panel";
import { ToastContainer } from "@/components/toast-container";
import { useCultivationState } from "@/hooks/use-cultivation-state";
import {
  type ConsumeCallbacks,
  usePillInventory,
} from "@/hooks/use-pill-inventory";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { getRealmMeta, getSubStageName } from "@/lib/realm-constants";
import type { BreakthroughResult, PillEffectKind } from "@/lib/types";

export default function Home() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const {
    state,
    error,
    loading,
    refetch,
    displayLinhKhi,
    punishmentRemaining,
  } = useCultivationState(
    isAuthenticated,
    useCallback(() => router.replace("/login"), [router]),
  );
  const { toasts, addToast, removeToast } = useToast();
  const [phase, setPhase] = useState<BreakthroughPhase>("idle");
  const [pillModalOpen, setPillModalOpen] = useState(false);
  const [linhKhiBonus, setLinhKhiBonus] = useState(0);
  const [punishmentCleared, setPunishmentCleared] = useState(false);
  const {
    inventory,
    activeBuffs,
    breakthroughBonusPct,
    consume,
    clearBreakthroughBoost,
    now: pillNow,
  } = usePillInventory();
  const particleRef = useRef<ParticleCanvasHandle>(null);
  // The POST result/error is stashed here while the tribulation animation plays,
  // then read in handleTribulationComplete to resolve success/failure.
  const breakthroughResultRef = useRef<BreakthroughResult | null>(null);
  const breakthroughErrorRef = useRef<string | null>(null);

  // Redirect to login once the auth probe resolves as unauthenticated.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Ambient absorption particles every 2s while idle.
  useEffect(() => {
    if (!isAuthenticated || !state) return;
    const interval = setInterval(() => {
      if (phase === "idle") {
        particleRef.current?.spawnAbsorption(3);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated, state, phase]);

  // Once the server poll shows punishment is gone, drop the local clear flag so
  // a future punishment isn't masked by a stale flag.
  useEffect(() => {
    if (punishmentRemaining === null) setPunishmentCleared(false);
  }, [punishmentRemaining]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [logout, router]);

  const handleSuccess = useCallback((result: BreakthroughResult) => {
    breakthroughResultRef.current = result;
  }, []);

  const handleFailure = useCallback((result: BreakthroughResult) => {
    breakthroughResultRef.current = result;
  }, []);

  const handleError = useCallback(
    (message: string) => {
      breakthroughErrorRef.current = message;
      if (phase === "idle") {
        addToast("Lỗi", message, "danger");
      }
    },
    [phase, addToast],
  );

  const handleBreakthroughClick = useCallback(async () => {
    if (phase !== "idle") return;
    breakthroughResultRef.current = null;
    breakthroughErrorRef.current = null;
    setPhase("tribulating");
    addToast("Thiên Kiếp", "Kiếp vân hội tụ, chuẩn bị đón kiếp!", "purple");
  }, [phase, addToast]);

  const effectiveState = state;

  const handleUsePill = useCallback(
    (pillId: string) => {
      const callbacks: ConsumeCallbacks = {
        onLinhKhi: (amount, color) => {
          setLinhKhiBonus((b) => b + amount);
          particleRef.current?.spawnBurst(color, 40);
          addToast("Dùng Đan", `Hấp thu ${amount} linh khí`, "success");
        },
        onCultivationBuff: (label, color) => {
          particleRef.current?.spawnBurst(color, 30);
          addToast("Dược Lực", `Buff kích hoạt: ${label}`, "purple");
        },
        onBreakthroughBoost: (label, color) => {
          particleRef.current?.spawnBurst(color, 30);
          addToast("Dược Lực", label, "purple");
        },
        onClearPunishment: (color) => {
          setPunishmentCleared(true);
          particleRef.current?.spawnBurst(color, 30);
          addToast("Giải Phạt", "Trạng thái trừng phạt đã được gỡ", "success");
        },
      };
      consume(pillId, callbacks);
    },
    [consume, addToast],
  );

  const isPillDisabled = useCallback(
    (kind: PillEffectKind): { disabled: boolean; reason?: string } => {
      if (!effectiveState) return { disabled: true };
      if (
        (kind === "linhKhi" || kind === "breakthroughBoost") &&
        effectiveState.isMaxStage
      ) {
        return { disabled: true, reason: "Đã đạt cực cảnh" };
      }
      if (
        kind === "clearPunishment" &&
        (punishmentRemaining === null || punishmentCleared)
      ) {
        return { disabled: true, reason: "Không bị trừng phạt" };
      }
      return { disabled: false };
    },
    [effectiveState, punishmentRemaining, punishmentCleared],
  );

  // Called when the tribulation animation finishes: resolve the stashed result.
  const handleTribulationComplete = useCallback(() => {
    const result = breakthroughResultRef.current;
    const errMsg = breakthroughErrorRef.current;

    if (errMsg) {
      setPhase("idle");
      addToast("Lỗi", errMsg, "danger");
      return;
    }

    if (!result) {
      setPhase("idle");
      return;
    }

    if (result.success) {
      setPhase("success");
      const newMeta = getRealmMeta(result.character.realmMajor);
      particleRef.current?.spawnBurst(newMeta.color, 80);
      addToast("Đột Phá Thành Công", `Đã đạt tới ${newMeta.name}!`, "success");
      setTimeout(() => setPhase("idle"), 1800);
    } else {
      setPhase("failure");
      addToast(
        "Độ Kiếp Thất Bại",
        "Tổn thất linh khí, cần tu luyện lại",
        "danger",
      );
      setTimeout(() => setPhase("idle"), 1500);
    }

    clearBreakthroughBoost();
    refetch();
  }, [addToast, refetch, clearBreakthroughBoost]);

  if (isLoading || loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  if (!state) {
    return (
      <>
        <CosmicBackground />
        <div className="login-wrapper">
          <div className="login-card" style={{ textAlign: "center" }}>
            <p style={{ color: "var(--red)", marginBottom: "1rem" }}>
              {error ?? "Không có dữ liệu nhân vật"}
            </p>
            <button type="button" className="login-submit" onClick={refetch}>
              Thử Lại
            </button>
          </div>
        </div>
      </>
    );
  }

  const meta = getRealmMeta(state.realmMajor);
  const subName = getSubStageName(state.realmSub);

  // Enable the button off the same interpolated value the progress bar shows,
  // so the bar reaching full and the button unlocking stay in sync between the
  // 10s server polls. The server still enforces the real check on POST, and
  // refetch reconciles any client-side optimism afterwards.
  const shownLinhKhi = displayLinhKhi + linhKhiBonus;
  const shownPunishment = punishmentCleared ? null : punishmentRemaining;
  const canBreakthrough =
    !state.isMaxStage && shownLinhKhi >= state.linhKhiRequired;

  return (
    <>
      <CosmicBackground />
      <LoadingScreen />
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <header className="app-header">
        <div>
          <div className="logo">修仙之路</div>
          <div className="logo-en">TU TIÊN CHI LỘ</div>
        </div>
        <div className="cultivator-info">
          <div className="cultivator-badge">
            <div className="cultivator-name">{meta.name} Đạo Hữu</div>
            <div className="cultivator-title">{subName} · Tu Tiên Giả</div>
          </div>
          <PillInventoryButton onClick={() => setPillModalOpen(true)} />
          <button
            type="button"
            className="header-action"
            onClick={handleLogout}
          >
            <LogoutIcon />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="cultivation-grid">
          <div className="hud-col hud-col-left">
            <StatsPanel state={state} punishmentRemaining={shownPunishment} />
            {activeBuffs.length > 0 && (
              <div className="buff-strip">
                {activeBuffs.map((b) => (
                  <span key={b.kind} className="buff-chip">
                    {b.kind === "cultivationBuff" && b.expiresAt
                      ? `${b.label} (${Math.max(0, Math.ceil((b.expiresAt - pillNow) / 1000))}s)`
                      : b.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <section className="cultivation-stage">
            <DantianFormation />
            <ParticleCanvas ref={particleRef} />

            <div className="realm-display">
              <div className="realm-label">HIỆN TẠI CẢNH GIỚI</div>
              <div className="realm-name">{meta.name}</div>
              <div className="realm-sub">{subName}</div>
              <div className="realm-desc">{meta.desc}</div>
            </div>

            <LingqiBar
              linhKhi={shownLinhKhi}
              linhKhiRequired={state.linhKhiRequired}
            />

            <BreakthroughButton
              canBreakthrough={canBreakthrough}
              isMaxStage={state.isMaxStage}
              busy={phase !== "idle"}
              punishedRemaining={shownPunishment}
              onSuccess={handleSuccess}
              onFailure={handleFailure}
              onError={handleError}
              onAttempt={handleBreakthroughClick}
              bonusPct={breakthroughBonusPct}
            />
          </section>

          <div className="hud-col hud-col-right">
            <RealmPath currentRealmMajor={state.realmMajor} />
          </div>
        </div>
      </main>

      <BreakthroughOverlay
        phase={phase}
        successColor={meta.color}
        onComplete={handleTribulationComplete}
      />

      <PillModal
        open={pillModalOpen}
        inventory={inventory}
        onClose={() => setPillModalOpen(false)}
        onUse={handleUsePill}
        isDisabled={isPillDisabled}
      />
    </>
  );
}
