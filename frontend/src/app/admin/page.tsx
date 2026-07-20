"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertIcon, ChartIcon, ShieldIcon } from "@/components/icons";
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

  return (
    <section>
      <div className="admin-toolbar">
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
          <div className="admin-cards">
            <div className="admin-card admin-card--jade">
              <span className="admin-card-icon">
                <ChartIcon width={22} height={22} />
              </span>
              <div className="value">{stats.totalUsers}</div>
              <div className="label">Tổng người chơi</div>
            </div>
            <div className="admin-card admin-card--gold">
              <span className="admin-card-icon">
                <ShieldIcon width={22} height={22} />
              </span>
              <div className="value">{stats.totalAdmins}</div>
              <div className="label">Quản trị viên</div>
            </div>
            <div className="admin-card admin-card--red">
              <span className="admin-card-icon">
                <AlertIcon width={22} height={22} />
              </span>
              <div className="value">{stats.punishedCount}</div>
              <div className="label">Đang chịu phạt</div>
            </div>
          </div>

          <h3>Phân bố cảnh giới</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cảnh giới</th>
                <th>Số người</th>
                <th style={{ width: "50%" }}>Tỉ lệ</th>
              </tr>
            </thead>
            <tbody>
              {stats.realmDistribution.map((r) => (
                <tr key={r.realmMajor}>
                  <td>{r.realmName}</td>
                  <td>{r.count}</td>
                  <td>
                    <div className="admin-bar-cell">
                      <div
                        className="admin-bar"
                        style={{ width: `${(r.count / maxCount) * 100}%` }}
                      />
                      <span className="admin-bar-pct">
                        {stats.totalUsers > 0
                          ? Math.round((r.count / stats.totalUsers) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {stats.realmDistribution.length === 0 && (
                <tr>
                  <td colSpan={3}>Chưa có nhân vật nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
