"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import {
  createLocalUser,
  DEFAULT_ADMIN_USERNAME,
  isDefaultAdmin,
  listLocalUsers,
  setLocalUserActive,
  updateLocalUserPassword,
  type LocalUser,
} from "@/lib/localAuth";

export default function LocalUsersPanel() {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [passwordEditId, setPasswordEditId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listLocalUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar perfis"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) {
      setError("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createLocalUser({
        name: form.name,
        username: form.username,
        password: form.password,
      });
      setForm({ name: "", username: "", password: "" });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar perfil");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(user: LocalUser) {
    const deactivating = user.is_active !== false;
    const message = deactivating
      ? `Desativar o perfil ${user.name}?\n\nO inspetor deixa de entrar no app, mas as inspeções já feitas permanecem.`
      : `Reativar o perfil ${user.name}?`;
    if (!confirm(message)) return;
    setError("");
    try {
      await setLocalUserActive(user.id, !deactivating);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar perfil");
    }
  }

  async function handleSavePassword(userId: string) {
    const user = users.find((u) => u.id === userId);
    const minLength = user?.is_admin ? 8 : 6;
    if (newPassword.length < minLength) {
      setError(`Senha deve ter pelo menos ${minLength} caracteres`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateLocalUserPassword(userId, newPassword);
      setPasswordEditId(null);
      setNewPassword("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao alterar senha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Perfis do tablet</h1>
          <p className="text-sm text-slate-500">
            Cadastre os inspetores que podem acessar este dispositivo. Somente perfis criados aqui
            entram no app.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancelar" : "Novo inspetor"}
        </Button>
      </div>

      <Card className="mb-6" title="Administrador">
        <p className="text-sm text-slate-600">
          O usuário <strong>{DEFAULT_ADMIN_USERNAME}</strong> já vem no app e gerencia os perfis
          abaixo. Altere a senha após o primeiro acesso.
        </p>
      </Card>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {showForm && (
        <Card className="mb-6" title="Novo inspetor">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Usuário *"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoComplete="off"
            />
            <Input
              label="Senha (mín. 6 caracteres) *"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Criar perfil"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{user.name}</p>
                  <p className="text-sm text-slate-500">@{user.username}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {user.is_admin ? "Administrador" : "Inspetor"}
                    {user.is_active === false && " · Inativo"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setPasswordEditId(passwordEditId === user.id ? null : user.id);
                      setNewPassword("");
                    }}
                  >
                    {passwordEditId === user.id ? "Cancelar" : "Alterar senha"}
                  </Button>
                  {!isDefaultAdmin(user.id) && (
                    <Button
                      type="button"
                      variant={user.is_active !== false ? "danger" : "secondary"}
                      size="sm"
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.is_active !== false ? "Desativar" : "Reativar"}
                    </Button>
                  )}
                </div>
              </div>
              {passwordEditId === user.id && (
                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                  <Input
                    label="Nova senha"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={user.is_admin ? 8 : 6}
                    className="min-w-[12rem] flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => handleSavePassword(user.id)}
                  >
                    Salvar senha
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
