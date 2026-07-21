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
import { HeaderMenu } from "@/components/header-menu";
import { LingqiBar } from "@/components/lingqi-bar";
import { LoadingScreen } from "@/components/loading-screen";
import {
  ParticleCanvas,
  type ParticleCanvasHandle,
} from "@/components/particle-canvas";
import { PillModal } from "@/components/pill-modal";
import { RealmPath } from "@/components/realm-path";
import { RedeemModal } from "@/components/redeem-modal";
import { StatsPanel } from "@/components/stats-panel";
import { ToastContainer } from "@/components/toast-container";
import { useCultivationState } from "@/hooks/use-cultivation-state";
import { usePillInventory } from "@/hooks/use-pill-inventory";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { formatSeconds } from "@/lib/format";
import { getRarityMeta } from "@/lib/pill-constants";
import { getRealmMeta, getSubStageName } from "@/lib/realm-constants";
import type {
  BreakthroughResult,
  PillEffectKind,
  RedeemResult,
} from "@/lib/types";

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
    cultivationBuffRemaining,
    effectiveRate,
    breakthroughBonusPct,
  } = useCultivationState(
    isAuthenticated,
    useCallback(() => router.replace("/login"), [router]),
  );
  const { toasts, addToast, removeToast } = useToast();
  const [phase, setPhase] = useState<BreakthroughPhase>("idle");
  const [pillModalOpen, setPillModalOpen] = useState(false);
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const {
    inventory,
    loading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory,
    consume,
  } = usePillInventory(pillModalOpen);
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

  const handleUsePill = useCallback(
    async (pillId: string) => {
      const item = inventory.find((p) => p.id === pillId);
      try {
        await consume(pillId); // POST /pills/consume + refetch inventory
        await refetch(); // pull authoritative cultivation state (buff/boost/linhKhi)
        if (item) {
          const color = getRarityMeta(item.rarity).color;
          particleRef.current?.spawnBurst(
            color,
            item.effectKind === "linhKhi" ? 40 : 30,
          );
          const msg =
            item.effectKind === "linhKhi"
              ? `Hấp thu ${item.amount} linh khí`
              : item.effectKind === "cultivationBuff"
                ? `Buff kích hoạt: ${item.name}`
                : item.effectKind === "breakthroughBoost"
                  ? `+${item.bonusPct}% đột phá`
                  : "Trạng thái trừng phạt đã được gỡ";
          addToast(
            "Dùng Đan",
            msg,
            item.effectKind === "clearPunishment" ? "success" : "purple",
          );
        }
      } catch (err) {
        addToast(
          "Lỗi",
          err instanceof Error ? err.message : "Dùng đan thất bại",
          "danger",
        );
      }
    },
    [inventory, consume, refetch, addToast],
  );

  const isPillDisabled = useCallback(
    (kind: PillEffectKind): { disabled: boolean; reason?: string } => {
      if (!state) return { disabled: true };
      if (
        (kind === "linhKhi" || kind === "breakthroughBoost") &&
        state.isMaxStage
      ) {
        return { disabled: true, reason: "Đã đạt cực cảnh" };
      }
      if (kind === "clearPunishment" && punishmentRemaining === null) {
        return { disabled: true, reason: "Không bị trừng phạt" };
      }
      return { disabled: false };
    },
    [state, punishmentRemaining],
  );

  const handleRedeemSuccess = useCallback(
    (result: RedeemResult) => {
      particleRef.current?.spawnBurst("#ffd76a", 40);
      addToast(
        "Đổi Code Thành Công",
        result.rewards.map((r) => `${r.name} ×${r.quantity}`).join(", "),
        "success",
      );
      refetch();
    },
    [addToast, refetch],
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

    // The server resets the breakthrough boost on any resolved attempt; the
    // refetch below pulls the authoritative state (breakthroughBonusPct: 0).
    refetch();
  }, [addToast, refetch]);

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
  // 10s server polls. The server still enforces the real check on POST.
  const canBreakthrough =
    !state.isMaxStage && displayLinhKhi >= state.linhKhiRequired;

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
          <HeaderMenu
            onOpenPills={() => setPillModalOpen(true)}
            onOpenRedeem={() => setRedeemModalOpen(true)}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <main className="app-main">
        <div className="cultivation-grid">
          <div className="hud-col hud-col-left">
            <StatsPanel
              state={state}
              punishmentRemaining={punishmentRemaining}
              effectiveRate={effectiveRate}
            />
            {(cultivationBuffRemaining !== null ||
              breakthroughBonusPct > 0) && (
              <div className="buff-strip">
                {cultivationBuffRemaining !== null &&
                  state.cultivationBuffMultiplier && (
                    <span className="buff-chip">
                      Tăng tốc ×{state.cultivationBuffMultiplier} (
                      {formatSeconds(cultivationBuffRemaining)})
                    </span>
                  )}
                {breakthroughBonusPct > 0 && (
                  <span className="buff-chip">
                    +{breakthroughBonusPct}% đột phá
                  </span>
                )}
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
              linhKhi={displayLinhKhi}
              linhKhiRequired={state.linhKhiRequired}
            />

            <BreakthroughButton
              canBreakthrough={canBreakthrough}
              isMaxStage={state.isMaxStage}
              busy={phase !== "idle"}
              punishedRemaining={punishmentRemaining}
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
        loading={inventoryLoading}
        error={inventoryError}
        onRetry={refetchInventory}
        onClose={() => setPillModalOpen(false)}
        onUse={handleUsePill}
        isDisabled={isPillDisabled}
      />

      <RedeemModal
        open={redeemModalOpen}
        onClose={() => setRedeemModalOpen(false)}
        onSuccess={handleRedeemSuccess}
      />
    </>
  );
}
