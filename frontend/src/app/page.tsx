"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlchemyCard } from "@/components/alchemy-card";
import { AlchemyDrawer } from "@/components/alchemy-drawer";
import { AttributePanel } from "@/components/attribute-panel";
import { BreakthroughButton } from "@/components/breakthrough-button";
import {
  BreakthroughOverlay,
  type BreakthroughPhase,
} from "@/components/breakthrough-overlay";
import { CongPhapModal } from "@/components/congphap-modal";
import { CosmicBackground } from "@/components/cosmic-background";
import { DantianFormation } from "@/components/dantian-formation";
import { ExpeditionCard } from "@/components/expedition-card";
import { ExpeditionDrawer } from "@/components/expedition-drawer";
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
import { useAlchemyQueue } from "@/hooks/use-alchemy-queue";
import { useCongPhap } from "@/hooks/use-congphap";
import { useCultivationState } from "@/hooks/use-cultivation-state";
import { useExpedition } from "@/hooks/use-expedition";
import { useMaterialInventory } from "@/hooks/use-material-inventory";
import { usePillInventory } from "@/hooks/use-pill-inventory";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { getCongPhapRarityMeta } from "@/lib/congphap-display";
import { formatSeconds } from "@/lib/format";
import { getRarityMeta } from "@/lib/pill-constants";
import { getRealmMeta, getSubStageName } from "@/lib/realm-constants";
import type {
  BreakthroughResult,
  PillEffectKind,
  RedeemResult,
  StartExpeditionInput,
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
  const [congPhapModalOpen, setCongPhapModalOpen] = useState(false);
  const [expeditionDrawerOpen, setExpeditionDrawerOpen] = useState(false);
  const [alchemyDrawerOpen, setAlchemyDrawerOpen] = useState(false);
  const [expeditionBusy, setExpeditionBusy] = useState(false);
  const [alchemyBusy, setAlchemyBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // One in-flight công pháp mutation at a time: every action re-reads the
  // list, so overlapping writes would race their own refetches.
  const [congPhapBusy, setCongPhapBusy] = useState(false);
  const {
    inventory,
    loading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory,
    consume,
  } = usePillInventory(pillModalOpen);
  const {
    owned: congPhapOwned,
    catalog: congPhapCatalog,
    loading: congPhapLoading,
    error: congPhapError,
    refetch: refetchCongPhap,
    equip: equipCongPhapAction,
    unequip: unequipCongPhapAction,
    levelUp: levelUpCongPhapAction,
  } = useCongPhap(congPhapModalOpen);
  const {
    branches: expeditionBranches,
    current: currentExpedition,
    loading: expeditionLoading,
    error: expeditionError,
    refetch: refetchExpedition,
    start: startExpeditionAction,
    claim: claimExpeditionAction,
  } = useExpedition(isAuthenticated);
  const {
    inventory: materialInventory,
    loading: materialLoading,
    error: materialError,
    refetch: refetchMaterials,
  } = useMaterialInventory(
    isAuthenticated &&
      (expeditionDrawerOpen || alchemyDrawerOpen || congPhapModalOpen),
  );
  const {
    recipes: alchemyRecipes,
    queue: alchemyQueue,
    profile: alchemyProfile,
    loading: alchemyLoading,
    error: alchemyError,
    refetch: refetchAlchemy,
    enqueue: enqueueAlchemyAction,
    rankUp: rankUpAlchemyAction,
    upgradeFurnace: upgradeFurnaceAction,
  } = useAlchemyQueue(alchemyDrawerOpen);
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

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [logout, router]);

  const handleStartExpedition = useCallback(
    async (input: StartExpeditionInput) => {
      setExpeditionBusy(true);
      try {
        await startExpeditionAction(input);
        addToast(
          "Bí Cảnh",
          "Đã khởi hành, chuyến đi vẫn tiếp tục khi bạn offline.",
          "purple",
        );
      } catch (err) {
        addToast(
          "Lỗi",
          err instanceof Error ? err.message : "Khởi hành thất bại",
          "danger",
        );
      } finally {
        setExpeditionBusy(false);
      }
    },
    [addToast, startExpeditionAction],
  );

  const handleClaimExpedition = useCallback(async () => {
    setExpeditionBusy(true);
    try {
      const result = await claimExpeditionAction();
      await refetch();
      await refetchMaterials();
      addToast(
        "Nhận thưởng bí cảnh",
        `Linh Thạch +${result.reward.linhThach} · ${result.reward.materials.length} loại nguyên liệu`,
        "success",
      );
    } catch (err) {
      addToast(
        "Lỗi",
        err instanceof Error ? err.message : "Nhận thưởng thất bại",
        "danger",
      );
    } finally {
      setExpeditionBusy(false);
    }
  }, [addToast, claimExpeditionAction, refetch, refetchMaterials]);

  const handleEnqueueAlchemy = useCallback(
    async (recipeId: string, quantity: number) => {
      setAlchemyBusy(true);
      try {
        await enqueueAlchemyAction(recipeId, quantity);
        await refetchMaterials();
        await refetch();
        addToast("Luyện Đan", `Đã xếp ${quantity} mẻ vào hàng đợi.`, "purple");
      } catch (err) {
        addToast(
          "Lỗi",
          err instanceof Error ? err.message : "Xếp hàng luyện đan thất bại",
          "danger",
        );
      } finally {
        setAlchemyBusy(false);
      }
    },
    [addToast, enqueueAlchemyAction, refetch, refetchMaterials],
  );

  const handleRankUpAlchemy = useCallback(async () => {
    setAlchemyBusy(true);
    try {
      await rankUpAlchemyAction();
    } catch (err) {
      addToast(
        "Luyện Đan",
        err instanceof Error ? err.message : "Không thăng cấp được",
        "danger",
      );
    } finally {
      setAlchemyBusy(false);
    }
  }, [addToast, rankUpAlchemyAction]);

  const handleUpgradeFurnace = useCallback(async () => {
    setAlchemyBusy(true);
    try {
      await upgradeFurnaceAction();
    } catch (err) {
      addToast(
        "Luyện Đan",
        err instanceof Error ? err.message : "Không nâng lò được",
        "danger",
      );
    } finally {
      setAlchemyBusy(false);
    }
  }, [addToast, upgradeFurnaceAction]);

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
                  : "Đã hồi phục khỏi trọng thương";
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

  // Wait-for-server, like handleUsePill: POST + refetch the list (inside the
  // hook), then pull the cultivation state so Linh Thạch, attributes and
  // battle power all reflect the committed result before we celebrate.
  const handleLevelUpCongPhap = useCallback(
    async (congPhapId: string) => {
      const entry = congPhapOwned.find((o) => o.def.id === congPhapId);
      setCongPhapBusy(true);
      try {
        const result = await levelUpCongPhapAction(congPhapId);
        await refetchMaterials();
        await refetch();
        if (entry) {
          particleRef.current?.spawnBurst(
            getCongPhapRarityMeta(entry.def.rarity).color,
            30,
          );
          addToast(
            "Nâng Cấp Công Pháp",
            `${entry.def.name} đạt cấp ${result.level}`,
            "purple",
          );
        }
      } catch (err) {
        addToast(
          "Lỗi",
          err instanceof Error ? err.message : "Nâng cấp thất bại",
          "danger",
        );
      } finally {
        setCongPhapBusy(false);
      }
    },
    [congPhapOwned, levelUpCongPhapAction, refetchMaterials, refetch, addToast],
  );

  const handleEquipCongPhap = useCallback(
    async (congPhapId: string, slot: number) => {
      setCongPhapBusy(true);
      try {
        await equipCongPhapAction(congPhapId, slot);
        addToast("Trang Bị", `Đã đặt vào ô ${slot + 1}`, "success");
      } catch (err) {
        addToast(
          "Lỗi",
          err instanceof Error ? err.message : "Trang bị thất bại",
          "danger",
        );
      } finally {
        setCongPhapBusy(false);
      }
    },
    [equipCongPhapAction, addToast],
  );

  const handleUnequipCongPhap = useCallback(
    async (congPhapId: string) => {
      setCongPhapBusy(true);
      try {
        await unequipCongPhapAction(congPhapId);
        addToast("Gỡ Trang Bị", "Đã gỡ công pháp khỏi ô", "info");
      } catch (err) {
        addToast(
          "Lỗi",
          err instanceof Error ? err.message : "Gỡ trang bị thất bại",
          "danger",
        );
      } finally {
        setCongPhapBusy(false);
      }
    },
    [unequipCongPhapAction, addToast],
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
        return { disabled: true, reason: "Không bị trọng thương" };
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
        "Độ kiếp thất bại, bạn đã bị trọng thương",
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
            onOpenCongPhap={() => setCongPhapModalOpen(true)}
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
            <AttributePanel state={state} />
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
            <ExpeditionCard
              current={currentExpedition}
              loading={expeditionLoading}
              error={expeditionError}
              now={now}
              onOpen={() => setExpeditionDrawerOpen(true)}
              onRetry={refetchExpedition}
            />
            <AlchemyCard
              queue={alchemyQueue}
              profile={alchemyProfile}
              inventory={materialInventory}
              loading={alchemyLoading}
              error={alchemyError ?? materialError}
              now={now}
              onOpen={() => setAlchemyDrawerOpen(true)}
              onRetry={() => {
                void refetchAlchemy();
                void refetchMaterials();
              }}
            />
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

      <CongPhapModal
        open={congPhapModalOpen}
        owned={congPhapOwned}
        catalog={congPhapCatalog}
        linhThach={state.linhThach}
        materialInventory={materialInventory}
        loading={congPhapLoading}
        error={congPhapError}
        busy={congPhapBusy}
        onRetry={refetchCongPhap}
        onClose={() => setCongPhapModalOpen(false)}
        onEquip={handleEquipCongPhap}
        onUnequip={handleUnequipCongPhap}
        onLevelUp={handleLevelUpCongPhap}
      />

      <RedeemModal
        open={redeemModalOpen}
        onClose={() => setRedeemModalOpen(false)}
        onSuccess={handleRedeemSuccess}
      />

      <ExpeditionDrawer
        open={expeditionDrawerOpen}
        branches={expeditionBranches}
        current={currentExpedition}
        loading={expeditionLoading}
        error={expeditionError}
        busy={expeditionBusy}
        now={now}
        onRetry={refetchExpedition}
        onClose={() => setExpeditionDrawerOpen(false)}
        onStart={handleStartExpedition}
        onClaim={handleClaimExpedition}
      />

      <AlchemyDrawer
        open={alchemyDrawerOpen}
        recipes={alchemyRecipes}
        queue={alchemyQueue}
        profile={alchemyProfile}
        inventory={materialInventory}
        linhThach={state.linhThach}
        loading={alchemyLoading || materialLoading}
        error={alchemyError ?? materialError}
        busy={alchemyBusy}
        now={now}
        onRetry={() => {
          void refetchAlchemy();
          void refetchMaterials();
        }}
        onClose={() => setAlchemyDrawerOpen(false)}
        onEnqueue={handleEnqueueAlchemy}
        onRankUp={handleRankUpAlchemy}
        onUpgradeFurnace={handleUpgradeFurnace}
      />
    </>
  );
}
