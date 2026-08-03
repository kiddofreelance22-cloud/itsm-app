"use client";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AdminUser } from "@/types/admin";

interface UserFormDialogProps {
  open: boolean;
  user?: AdminUser | null;
  isLoading?: boolean;
  onSubmit: (data: {
    username: string;
    email: string;
    fullName: string;
    phone?: string;
    password?: string;
    isActive?: boolean;
  }) => Promise<boolean>;
  onClose: () => void;
}

export function UserFormDialog({
  open, user, isLoading = false, onSubmit, onClose,
}: UserFormDialogProps) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    username: "", email: "", fullName: "", phone: "", password: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone ?? "",
        password: "",
      });
    } else {
      setForm({ username: "", email: "", fullName: "", phone: "", password: "" });
    }
  }, [user, open]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSubmit({
      username: form.username,
      email: form.email,
      fullName: form.fullName,
      phone: form.phone || undefined,
      password: form.password || undefined,
    });
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Create User"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.fullName} onChange={set("fullName")} required />
            </div>
            <div className="space-y-1.5">
              <Label>Username *</Label>
              <Input value={form.username} onChange={set("username")} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={set("email")} required />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input type="tel" value={form.phone} onChange={set("phone")} />
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label>New Password (leave blank to keep)</Label>
              <Input
                type="password"
                value={form.password}
                onChange={set("password")}
                minLength={6}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading && <Spinner size="sm" />}
              {isEdit ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
