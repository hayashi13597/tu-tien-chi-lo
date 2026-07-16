"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { CosmicBackground } from "@/components/cosmic-background";
import { useAuth } from "@/lib/auth-context";

type Tab = "login" | "register";

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, register } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Client-side field validation surfaced only after a submit attempt, so the
  // form doesn't scold the user mid-typing.
  const [touched, setTouched] = useState(false);

  const usernameError =
    username.length > 0 && username.length < 3
      ? "Tên đạo hữu cần tối thiểu 3 ký tự"
      : null;
  const passwordError =
    password.length > 0 && password.length < 8
      ? "Mật khẩu cần tối thiểu 8 ký tự"
      : null;

  // Already logged in? Bounce to the dashboard.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (username.length < 3 || password.length < 8) return;
    setError(null);
    setSubmitting(true);
    try {
      if (tab === "login") {
        await login(username, password);
      } else {
        await register(username, password);
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <CosmicBackground />
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-title-zh">修仙之路</div>
          <div className="login-title-vi">TU TIÊN CHI LỘ</div>

          <div className="login-tab-group">
            <button
              type="button"
              className={`login-tab ${tab === "login" ? "active" : ""}`}
              onClick={() => setTab("login")}
            >
              Đăng Nhập
            </button>
            <button
              type="button"
              className={`login-tab ${tab === "register" ? "active" : ""}`}
              onClick={() => setTab("register")}
            >
              Đăng Ký
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="username" className="login-label">
                Tên Đạo Hữu
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={32}
                autoComplete="username"
                className="login-input"
                placeholder="3-32 ký tự"
                aria-invalid={touched && username.length < 3}
                aria-describedby="username-help"
              />
              {touched && usernameError ? (
                <p id="username-help" className="login-field-error">
                  {usernameError}
                </p>
              ) : (
                <p id="username-help" className="login-hint">
                  Từ 3 đến 32 ký tự
                </p>
              )}
            </div>
            <div className="login-field">
              <label htmlFor="password" className="login-label">
                Mật Khẩu
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={72}
                autoComplete={
                  tab === "login" ? "current-password" : "new-password"
                }
                className="login-input"
                placeholder="Tối thiểu 8 ký tự"
                aria-invalid={touched && password.length < 8}
                aria-describedby="password-help"
              />
              {touched && passwordError ? (
                <p id="password-help" className="login-field-error">
                  {passwordError}
                </p>
              ) : (
                <p id="password-help" className="login-hint">
                  Tối thiểu 8 ký tự
                </p>
              )}
            </div>

            {error && <p className="login-error">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="login-submit"
            >
              {submitting
                ? "Đang xử lý..."
                : tab === "login"
                  ? "Nhập Môn"
                  : "Khai Khởi Linh Căn"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
