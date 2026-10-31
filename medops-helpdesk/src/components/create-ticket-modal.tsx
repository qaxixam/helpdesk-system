"use client";

import { useState } from "react";
import { createTicketSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Plus, Paperclip, X, Loader2 } from "lucide-react";

interface CategoryOption {
    _id: string;
    name: string;
    description: string;
    defaultPriority: "Low" | "Medium" | "High" | "Urgent";
}

interface AttachmentItem {
    name: string;
    url: string;
    publicId?: string;
}

export function CreateTicketModal({
    categories,
    onCreated,
}: {
    categories: CategoryOption[];
    onCreated: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Urgent">(
        "Medium"
    );
    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    function handleCategoryChange(catId: string) {
        setCategory(catId);
        const found = categories.find((c) => c._id === catId);
        if (found?.defaultPriority) {
            setPriority(found.defaultPriority);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (attachments.length + files.length > 3) {
            toast.error("Maximum 3 file attachments allowed per ticket");
            return;
        }

        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) {
                    toast.error(data.error || `Failed to upload ${file.name}`);
                } else if (data.attachment) {
                    setAttachments((prev) => [...prev, data.attachment]);
                }
            }
        } catch {
            toast.error("Error uploading file");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    }

    function removeAttachment(index: number) {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrors({});

        const parsed = createTicketSchema.safeParse({
            title,
            description,
            category,
            priority,
            attachments,
        });

        if (!parsed.success) {
            const fieldErrors = parsed.error.flatten().fieldErrors;
            setErrors({
                title: fieldErrors.title?.[0] || "",
                description: fieldErrors.description?.[0] || "",
                category: fieldErrors.category?.[0] || "",
                priority: fieldErrors.priority?.[0] || "",
            });
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed.data),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || "Failed to create ticket");
                setSubmitting(false);
                return;
            }

            toast.success(`Incident ${data.ticket.ticketNumber} created!`);
            setTitle("");
            setDescription("");
            setCategory("");
            setPriority("Medium");
            setAttachments([]);
            setOpen(false);
            onCreated();
        } catch {
            toast.error("Network error while creating ticket");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Report Clinical Incident
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">
                        Report Clinical IT Incident
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        SLA timers start immediately upon submission. Urgent incidents carry a
                        1-hour response and 8-hour resolution target.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="title" className="text-xs font-medium">
                            Incident Summary / Title
                        </Label>
                        <Input
                            id="title"
                            placeholder="e.g., Epic EHR e-Prescribe timeout in Triage Room 2"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        {errors.title && (
                            <p className="text-xs text-red-600">{errors.title}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">System Category</Label>
                            <Select value={category} onValueChange={handleCategoryChange}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((c) => (
                                        <SelectItem key={c._id} value={c._id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.category && (
                                <p className="text-xs text-red-600">{errors.category}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Impact Priority</Label>
                            <Select
                                value={priority}
                                onValueChange={(val) =>
                                    setPriority(val as "Low" | "Medium" | "High" | "Urgent")
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Low">Low (24h Resp / 72h Res)</SelectItem>
                                    <SelectItem value="Medium">
                                        Medium (8h Resp / 48h Res)
                                    </SelectItem>
                                    <SelectItem value="High">High (4h Resp / 24h Res)</SelectItem>
                                    <SelectItem value="Urgent">
                                        Urgent (1h Resp / 8h Res)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-xs font-medium">
                            Detailed Clinical Impact & Error Codes
                        </Label>
                        <Textarea
                            id="description"
                            rows={4}
                            placeholder="Describe workstation ID, room number, error message, and clinical impact..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        {errors.description && (
                            <p className="text-xs text-red-600">{errors.description}</p>
                        )}
                    </div>

                    {/* Attachments Section (Max 3) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">
                                Attachments ({attachments.length}/3)
                            </Label>
                            {attachments.length < 3 && (
                                <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800">
                                    {uploading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Paperclip className="h-3.5 w-3.5" />
                                    )}
                                    <span>{uploading ? "Uploading..." : "Attach Screenshot/Log"}</span>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf,.txt,.log"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>

                        {attachments.length > 0 && (
                            <div className="space-y-1.5">
                                {attachments.map((att, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-100 border border-slate-200 text-xs"
                                    >
                                        <span className="truncate max-w-[320px] font-mono">
                                            {att.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(idx)}
                                            className="text-slate-400 hover:text-red-600"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={submitting || uploading}
                            className="bg-slate-900 hover:bg-slate-800 text-white"
                        >
                            {submitting ? "Submitting..." : "Submit Incident Ticket"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}