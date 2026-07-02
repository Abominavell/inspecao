"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { api } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  if (!open) return null;

  function handleClose() {
    setError("");
    setSuccess("");
    setForm({ current_password: "", new_password: "", confirm_password: "" });
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.new_password !== form.confirm_password) {
      setError("A confirmação da nova senha não confere");
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(form.current_password, form.new_password);
      setSuccess("Senha alterada com sucesso");
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao alterar senha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-semibold text-slate-800">Alterar senha</h2>
        <p className="mb-4 text-sm text-slate-500">Informe sua senha atual e a nova senha</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Senha atual *"
            type="password"
            value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })}
            required
            autoComplete="current-password"
          />
          <Input
            label="Nova senha *"
            type="password"
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
            minLength={8}
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirmar nova senha *"
            type="password"
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
            minLength={8}
            required
            autoComplete="new-password"
          />

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {success && (
            <p className="rounded-lg bg-emserh-green-light p-3 text-sm text-emserh-green-dark">
              {success}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              {success ? "Fechar" : "Cancelar"}
            </Button>
            {!success && (
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
