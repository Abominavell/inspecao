"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { api, UserAccount } from "@/lib/api";

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    is_staff: false,
  });

  function load() {
    setLoading(true);
    setError("");
    api
      .getUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar usuários"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        is_staff: form.is_staff,
        is_active: true,
      });
      setForm({ name: "", email: "", password: "", is_staff: false });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: UserAccount) {
    if (!confirm(`Excluir o usuário ${user.email}?`)) return;
    setError("");
    try {
      await api.deleteUser(user.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir usuário");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuários</h1>
          <p className="text-sm text-slate-500">Cadastro de inspetores e administradores</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancelar" : "Novo usuário"}
        </Button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {showForm && (
        <Card className="mb-6" title="Novo usuário">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="E-mail *"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Senha *"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_staff}
                onChange={(e) => setForm({ ...form, is_staff: e.target.checked })}
                className="h-4 w-4 rounded border-border text-emserh-green"
              />
              Administrador (pode gerenciar usuários)
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Criar usuário"}
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
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div>
                <p className="font-semibold text-slate-800">{user.name || user.email}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {user.is_staff ? "Administrador" : "Inspetor"}
                  {!user.is_active && " · Inativo"}
                </p>
              </div>
              <Button type="button" variant="danger" size="sm" onClick={() => handleDelete(user)}>
                Excluir
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
