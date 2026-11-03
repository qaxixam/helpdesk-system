"use client";

import { useState } from "react";
import { categorySchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Layers, Loader2 } from "lucide-react";

export function CreateCategoryModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPriority, setDefaultPriority] = useState<
    "Low" | "Medium" | "High" | "Urgent"
  >("Medium");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = categorySchema.safeParse({
      name,
      description,
      defaultPriority,
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0] || "",
        description: fieldErrors.description?.[0] || "",
        defaultPriority: fieldErrors.defaultPriority?.[0] || "",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create category");
      } else {
        toast.success(`Category "${data.category.name}" created!`);
        setName("");
        setDescription("");
        setDefaultPriority("Medium");
        setOpen(false);
        onCreated();
      }
    } catch {
      toast.error("Network error while creating category");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer">
        <Layers className="h-3.5 w-3.5 text-[#00D2B4]" />
        <span>+ Add Category</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Create Clinical IT Category
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Category Name
            </Label>
            <Input
              required
              placeholder="e.g. PACS Imaging / Epic EHR / Radiology Network"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl text-xs"
            />
            {errors.name && (
              <p className="text-[11px] text-rose-600 font-medium">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Default SLA Priority
            </Label>
            <Select
              value={defaultPriority}
              onValueChange={(val) => {
                if (val)
                  setDefaultPriority(val as "Low" | "Medium" | "High" | "Urgent");
              }}
            >
              <SelectTrigger className="w-full rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="Urgent">
                  Urgent (1h response / 8h resolution)
                </SelectItem>
                <SelectItem value="High">
                  High (4h response / 24h resolution)
                </SelectItem>
                <SelectItem value="Medium">
                  Medium (8h response / 48h resolution)
                </SelectItem>
                <SelectItem value="Low">
                  Low (24h response / 72h resolution)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Description & Clinical Scope
            </Label>
            <Textarea
              rows={3}
              required
              placeholder="Clinical hardware and software systems covered by this category..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl text-xs"
            />
            {errors.description && (
              <p className="text-[11px] text-rose-600 font-medium">
                {errors.description}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-[#6052E9] hover:bg-[#4F46E5] text-white rounded-xl font-bold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Save Category"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

