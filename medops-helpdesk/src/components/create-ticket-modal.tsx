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
    categories = [],
    onCreated,
    triggerText = "Create Ticket",
    triggerClassName,
}: {
    categories: CategoryOption[];
    onCreated: () => void;
    triggerText?: string;
    triggerClassName?: string;
}) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<string | undefined>(undefined);
    const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
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
            toast.error("Maximum 3 attachments allowed");
            return;
        }

        setUploading(true);
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append("file", file);

            try {
                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) {
                    toast.error(data.error || `Failed to upload ${file.name}`);
                } else {
                    setAttachments((prev) => [
                        ...prev,
                        { name: data.name, url: data.url, publicId: data.publicId },
                    ]);
                }
            } catch {
                toast.error(`Error uploading ${file.name}`);
            }
        }
        setUploading(false);
        e.target.value = "";
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
                toast.error(data.error || "Failed to submit ticket");
                setSubmitting(false);
                return;
            }

            toast.success(`Incident ${data.ticket.ticketNumber} created!`);
            setTitle("");
            setDescription("");
            setCategory(undefined);
            setPriority("Medium");
            setAttachments([]);
            setOpen(false);
            onCreated();

        } catch (error) {
            console.error("Submit error:", error);
            toast.error("Network timeout. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                className={
                    triggerClassName ||
                    "h-10 px-4 rounded-xl bg-[#00D084] hover:bg-[#00BC76] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                }
            >
                <Plus className="h-4 w-4" />
                {triggerText}
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-900">Report Clinical IT Incident</DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        SLA timers start immediately. Urgent incidents carry a 1h response target.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Incident Summary</Label>
                        <Input
                            placeholder="Epic EHR timeout in Room 2"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={submitting}
                            className="rounded-xl"
                        />
                        {errors.title && <p className="text-[11px] text-rose-600 font-medium">{errors.title}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">System Category</Label>
                            <Select value={category} onValueChange={(val) => { if (val) handleCategoryChange(val); }} disabled={submitting}>
                                <SelectTrigger className="w-full rounded-xl">
                                    <SelectValue placeholder={categories.length === 0 ? "Loading..." : "Select category"} />
                                </SelectTrigger>
                                <SelectContent className="z-[9999]">
                                    {categories.map((c) => (
                                        <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.category && <p className="text-[11px] text-rose-600 font-medium">{errors.category}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Impact Priority</Label>
                            <Select value={priority} onValueChange={(val) => { if (val) setPriority(val as "Low" | "Medium" | "High" | "Urgent"); }} disabled={submitting}>
                                <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent className="z-[9999]">
                                    <SelectItem value="Low">Low (24h/72h)</SelectItem>
                                    <SelectItem value="Medium">Medium (8h/48h)</SelectItem>
                                    <SelectItem value="High">High (4h/24h)</SelectItem>
                                    <SelectItem value="Urgent">Urgent (1h/8h)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Detailed Impact</Label>
                        <Textarea
                            rows={4}
                            placeholder="Describe error message and clinical impact..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={submitting}
                            className="rounded-xl"
                        />
                        {errors.description && <p className="text-[11px] text-rose-600 font-medium">{errors.description}</p>}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-slate-700">Attachments ({attachments.length}/3)</Label>
                            {attachments.length < 3 && (
                                <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold ${submitting ? 'text-slate-400' : 'text-[#6052E9] hover:underline'}`}>
                                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                                    <span>{uploading ? "Uploading..." : "Attach File"}</span>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf,.txt,.log"
                                        onChange={handleFileUpload}
                                        disabled={uploading || submitting}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>

                        {attachments.length > 0 && (
                            <div className="space-y-1.5">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-100 border text-xs">
                                        <span className="truncate max-w-[320px] font-mono">{att.name}</span>
                                        <button type="button" onClick={() => removeAttachment(idx)} disabled={submitting} className="text-slate-400 hover:text-rose-600">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={submitting} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={submitting || uploading} className="bg-[#00D084] hover:bg-[#00BC76] text-white rounded-xl font-bold">
                            {submitting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Submitting...</> : "Submit Incident"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
