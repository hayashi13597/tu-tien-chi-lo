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
import { RealmPath } from "@/components/realm-path";
import { StatsPanel } from "@/components/stats-panel";
import { ToastContainer } from "@/components/toast-container";
import { useCultivationState } from "@/hooks/use-cultivation-state";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { getRealmMeta, getSubStageName } from "@/lib/realm-constants";
import type { BreakthroughResult } from "@/lib/types";

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
            <StatsPanel
              state={state}
              punishmentRemaining={punishmentRemaining}
            />
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
              canBreakthrough={state.canBreakthrough}
              isMaxStage={state.isMaxStage}
              punishedRemaining={punishmentRemaining}
              onSuccess={handleSuccess}
              onFailure={handleFailure}
              onError={handleError}
              onAttempt={handleBreakthroughClick}
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
    </>
  );
}
