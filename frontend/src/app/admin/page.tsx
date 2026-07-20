"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertIcon,
  ChartIcon,
  MountainIcon,
  ShieldIcon,
} from "@/components/icons";
import { fetchAdminStats } from "@/lib/api";
import type { AdminStats } from "@/lib/types";

export default function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchAdminStats());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Không tải được số liệu";
      // A refresh-proof 401 means the session is gone — back to login.
      if (message === "Authentication expired") {
        router.replace("/login");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Bar widths are relative to the most-populated realm so the largest bar
  // always spans full width regardless of absolute player counts.
  const maxCount = stats
    ? Math.max(1, ...stats.realmDistribution.map((r) => r.count))
    : 1;

  // Most-populated realm, derived client-side (no extra API) for the 4th KPI.
  const topRealm = useMemo(() => {
    if (!stats || stats.realmDistribution.length === 0) return null;
    return stats.realmDistribution.reduce((a, b) =>
      b.count > a.count ? b : a,
    );
  }, [stats]);

  return (
    <section>
      <div className="admin-topbar">
        <h2>Thống kê tổng quan</h2>
        <button
          type="button"
          className="admin-btn"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Đang tải…" : "Làm mới"}
        </button>
      </div>

      {error && (
        <div className="admin-error">
          <span>{error}</span>
          <button
            type="button"
            className="admin-btn"
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      )}

      {stats && (
        <>
          <div className="admin-kpi">
            <div className="admin-kpi-tile admin-kpi-tile--jade">
              <div className="value">{stats.totalUsers}</div>
              <div className="label">
                <ChartIcon width={16} height={16} />
                Tổng người chơi
              </div>
            </div>
            <div className="admin-kpi-tile admin-kpi-tile--gold">
              <div className="value">{stats.totalAdmins}</div>
              <div className="label">
                <ShieldIcon width={16} height={16} />
                Quản trị viên
              </div>
            </div>
            <div className="admin-kpi-tile admin-kpi-tile--red">
              <div className="value">{stats.punishedCount}</div>
              <div className="label">
                <AlertIcon width={16} height={16} />
                Đang chịu phạt
              </div>
            </div>
            <div className="admin-kpi-tile admin-kpi-tile--purple">
              <div className="value">{topRealm ? topRealm.realmName : "—"}</div>
              <div className="label">
                <MountainIcon width={16} height={16} />
                Cảnh giới đông nhất
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-dist-head">
              <h3>Phân bố cảnh giới</h3>
              <span className="total">{stats.totalUsers} người</span>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cảnh giới</th>
                  <th style={{ width: "45%" }}>Phân bố</th>
                  <th className="num">Số người</th>
                  <th className="num">Tỉ lệ</th>
                </tr>
              </thead>
              <tbody>
                {stats.realmDistribution.map((r) => (
                  <tr key={r.realmMajor}>
                    <td>{r.realmName}</td>
                    <td className="admin-bar-cell">
                      <div
                        className="admin-bar"
                        style={{ width: `${(r.count / maxCount) * 100}%` }}
                      />
                    </td>
                    <td className="num">{r.count}</td>
                    <td className="num">
                      {stats.totalUsers > 0
                        ? Math.round((r.count / stats.totalUsers) * 100)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
                {stats.realmDistribution.length === 0 && (
                  <tr>
                    <td colSpan={4}>Chưa có nhân vật nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
