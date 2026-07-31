import { FormEvent, useEffect, useState, ChangeEvent } from "react";
import { toast } from "react-toastify";
import { CheckSquare, RefreshCw, Search, Square, Upload, Image as ImageIcon } from "lucide-react";
import { resolveImagePath } from "../../../components/catalog/SamplePreview";

type CategoryRecord = {
    catCode: string;
    catName: string;
};

type ReportEntryRecord = {
    repIdNo: number;
    repId: string;
    catCode: string;
    repName: string;
    paramList: string;
    favorite: number;
    active: number;
    description?: string;
    path?: string;
};

type ReportParameterRecord = {
    paraId: number;
    paraName: string;
    description: string;
    populated: boolean;
};

const isPopulatedValue = (value: unknown): boolean => {
    if (typeof value === "boolean") {
        return value;
    }

    const normalized = (value ?? "").toString().trim().toLowerCase();
    return normalized === "1" || normalized === "yes" || normalized === "true";
};

type CreateEntryForm = {
    repIdNo: number;
    repId: string;
    catCode: string;
    repName: string;
    description: string;
    path: string;
    favorite: boolean;
    active: boolean;
};

const initialForm: CreateEntryForm = {
    repIdNo: 0,
    repId: "",
    catCode: "",
    repName: "",
    description: "",
    path: "",
    favorite: true,
    active: true,
};

const fieldBaseClass =
    "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 shadow-sm outline-none transition focus:border-[#7A0000] focus:ring-2 focus:ring-[#7A0000]/10 disabled:bg-stone-100 disabled:text-stone-500";

const actionButtonPrimaryClass =
    "rounded-lg bg-[#7A0000] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#620000] disabled:cursor-not-allowed disabled:opacity-60";

const actionButtonSoftClass =
    "rounded-lg bg-[#7A0000]/85 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#620000] disabled:cursor-not-allowed disabled:opacity-50";

const actionButtonDarkClass =
    "rounded-lg bg-[#8E8E8E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7A7A7A] disabled:cursor-not-allowed disabled:opacity-50";

const actionButtonLightClass =
    "rounded-lg border border-[#7A0000]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#7A0000] transition hover:bg-[#7A0000]/5";

const normalizeRepId = (value: string) => value.trim().toUpperCase();

const ReportEntry = () => {
    const [categories, setCategories] = useState<CategoryRecord[]>([]);
    const [entries, setEntries] = useState<ReportEntryRecord[]>([]);
    const [parameters, setParameters] = useState<ReportParameterRecord[]>([]);
    const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
    const [selectedRepIdNo, setSelectedRepIdNo] = useState<number | null>(null);
    const [selectedCatCode, setSelectedCatCode] = useState<string | null>(null);
    const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState<string>("");

    const [isLoading, setIsLoading] = useState(false);
    const [isEntriesLoading, setIsEntriesLoading] = useState(false);
    const [isParametersLoading, setIsParametersLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    const [form, setForm] = useState<CreateEntryForm>(initialForm);
    const [mode, setMode] = useState<"add" | "edit">("add");
    const [deleteTargetEntry, setDeleteTargetEntry] = useState<ReportEntryRecord | null>(null);

    const loadNextId = async () => {
        try {
            const response = await fetch("/misapi/api/reportentry/nextid");
            const payload = await response.json();
            if (payload?.data) {
                setForm((prev) => ({ ...prev, repIdNo: payload.data }));
            }
        } catch (error) {
            console.error("Failed to load next ID:", error);
        }
    };

    const loadCategories = async () => {
        setIsLoading(true);

        try {
            const response = await fetch("/misapi/api/reportcategory");
            const payload = await response.json();

            if (payload?.errorMessage) {
                throw new Error(payload.errorMessage);
            }

            const nextCategories = Array.isArray(payload?.data)
                ? payload.data.map((item: any) => ({
                    catCode: (item?.CatCode ?? item?.catCode ?? "").toString().trim().toUpperCase(),
                    catName:
                        item?.CatName ??
                        item?.catName ??
                        item?.Description ??
                        item?.description ??
                        "",
                }))
                : [];
            setCategories(nextCategories);
        } catch (error) {
            console.error("Failed to load categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadReportEntries = async (categoryCode?: string) => {
        setIsEntriesLoading(true);

        try {
            let normalizedCategory = (categoryCode ?? activeCategoryFilter).trim().toUpperCase();
            const endpoint = normalizedCategory
                ? `/misapi/api/reportentry?catcode=${encodeURIComponent(normalizedCategory)}`
                : "/misapi/api/reportentry";
            const response = await fetch(endpoint);
            const payload = await response.json();

            if (payload?.errorMessage) {
                throw new Error(payload.errorMessage);
            }

            const nextEntries = Array.isArray(payload?.data)
                ? payload.data.map((item: any) => ({
                    repIdNo: Number(item?.RepIdNo ?? item?.repIdNo ?? 0),
                    repId: item?.RepId ?? item?.repId ?? "",
                    catCode: (item?.CatCode ?? item?.catCode ?? "").toString().trim().toUpperCase(),
                    repName: item?.RepName ?? item?.repName ?? "",
                    paramList: item?.ParamList ?? item?.paramList ?? "",
                    favorite: Number(item?.Favorite ?? item?.favorite ?? 0),
                    active: Number(item?.Active ?? item?.active ?? 0),
                    description: item?.Description ?? item?.description ?? "",
                    path: item?.Path ?? item?.path ?? "",
                }))
                : [];

            setEntries(nextEntries);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load report entries.";
            toast.error(message);
            setEntries([]);
        } finally {
            setIsEntriesLoading(false);
        }
    };

    const loadParameters = async () => {
        setIsParametersLoading(true);

        try {
            const response = await fetch("/misapi/api/reppara/GET_POPEDREPPARAMS");
            const payload = await response.json();

            if (payload?.errorMessage) {
                throw new Error(payload.errorMessage);
            }

            const nextParameters = Array.isArray(payload?.data)
                ? payload.data.map((item: any) => ({
                    paraId: Number(item?.ParaId ?? item?.paraId ?? 0),
                    paraName: (item?.ParaName ?? item?.paraName ?? "").toString().trim(),
                    description: (item?.Description ?? item?.description ?? "").toString().trim(),
                    populated: isPopulatedValue(item?.Populated ?? item?.populated),
                })).sort((a: ReportParameterRecord, b: ReportParameterRecord) => a.paraId - b.paraId)
                : [];

            setParameters(nextParameters);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load report parameters.";
            toast.error(message);
            setParameters([]);
        } finally {
            setIsParametersLoading(false);
        }
    };

    const buildParamListValue = (allParaNames: string[], selectedParaNames: string[]) => {
        const uniqueParams = Array.from(new Set(allParaNames.map((item) => item.trim()).filter(Boolean)));
        if (uniqueParams.length === 0) {
            return "";
        }

        const selectedSet = new Set(selectedParaNames.map((item) => item.trim().toUpperCase()).filter(Boolean));
        const tokenString = uniqueParams
            .map((item) => `${item}=${selectedSet.has(item.toUpperCase()) ? "1" : "0"}`)
            .join("&");
        return tokenString;
    };

    const extractParamsFromList = (paramListValue: string) => {
        const raw = (paramListValue || "").trim();
        if (!raw) return [] as string[];

        const normalized = raw.startsWith("<")
            ? raw.replace(/^<[^>]*>&?/, "")
            : raw;

        return normalized
            .split("&")
            .map((token) => token.trim())
            .filter(Boolean)
            .map((token) => {
                const [name, value] = token.split("=");
                return {
                    name: (name ?? "").trim(),
                    value: (value ?? "").trim(),
                };
            })
            .filter((item) => item.name)
            .filter((item) => item.value === "1" || item.value.toLowerCase() === "true")
            .map((item) => item.name)
            .filter(Boolean);
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setSelectedImageFile(null);
            setImagePreviewUrl(null);
            return;
        }

        const validTypes = ["image/png", "image/jpeg", "image/jpg"];
        const ext = file.name.split(".").pop()?.toLowerCase();
        const isValidExt = ext === "png" || ext === "jpg" || ext === "jpeg";

        if (!validTypes.includes(file.type) && !isValidExt) {
            toast.error("Only PNG, JPG, and JPEG images are allowed.");
            e.target.value = "";
            setSelectedImageFile(null);
            setImagePreviewUrl(null);
            return;
        }

        setSelectedImageFile(file);
        setImagePreviewUrl(URL.createObjectURL(file));
    };

    const uploadImage = async (repId: string): Promise<string> => {
        if (!selectedImageFile) return form.path || "";

        const formData = new FormData();
        formData.append("file", selectedImageFile);
        formData.append("repId", repId);

        const response = await fetch("/misapi/api/reportentry/upload", {
            method: "POST",
            body: formData,
        });

        const payload = await response.json();
        if (payload?.errorMessage) {
            throw new Error(payload.errorDetails ? `${payload.errorMessage} Details: ${payload.errorDetails}` : payload.errorMessage);
        }

        return payload?.data?.path || "";
    };

    const handleAdd = async (e?: FormEvent) => {
        if (e) e.preventDefault();

        const normalizedRepId = normalizeRepId(form.repId);
        const normalizedRepIdNo = Number(form.repIdNo ?? 0);

        if (!normalizedRepId || !form.catCode.trim() || !form.repName.trim()) {
            toast.error("Report ID, Category, and Name are required.");
            return;
        }

        if (selectedParameters.length === 0) {
            toast.error("At least one parameter is required.");
            return;
        }

        if (normalizedRepIdNo > 0) {
            const duplicateIdNo = entries.some(
                (entry) => Number(entry.repIdNo) === normalizedRepIdNo
            );

            if (duplicateIdNo) {
                toast.error("Report ID NO already exists.");
                return;
            }
        }

        const duplicateRepId = entries.some(
            (entry) => normalizeRepId(entry.repId) === normalizedRepId
        );

        if (duplicateRepId) {
            toast.error("Report ID already exists.");
            return;
        }

        setIsSubmitting(true);

        try {
            // Fetch next ID if repIdNo is not set
            let nextRepIdNo = form.repIdNo;
            if (nextRepIdNo === 0) {
                const nextIdResponse = await fetch("/misapi/api/reportentry/nextid");
                const nextIdPayload = await nextIdResponse.json();

                if (nextIdPayload?.errorMessage) {
                    throw new Error(nextIdPayload.errorDetails ? `${nextIdPayload.errorMessage} Details: ${nextIdPayload.errorDetails}` : nextIdPayload.errorMessage);
                }

                nextRepIdNo = nextIdPayload?.data ?? 0;
                if (nextRepIdNo === 0) {
                    throw new Error("Failed to generate Report Entry ID.");
                }
            }

            let generatedPath = form.path;
            if (selectedImageFile) {
                generatedPath = await uploadImage(normalizedRepId);
            }

            const paramList = buildParamListValue(
                parameters.map((item) => item.paraName),
                selectedParameters
            );

            const response = await fetch("/misapi/api/reportentry", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    repIdNo: nextRepIdNo,
                    repId: normalizedRepId,
                    catCode: form.catCode.trim(),
                    repName: form.repName.trim(),
                    paramList,
                    favorite: form.favorite ? 1 : 0,
                    active: form.active ? 1 : 0,
                    description: form.description.trim(),
                    path: generatedPath,
                }),
            });

            const payload = await response.json();

            if (payload?.errorMessage) {
                throw new Error(payload.errorDetails ? `${payload.errorMessage} Details: ${payload.errorDetails}` : payload.errorMessage);
            }

            toast.success(payload?.data?.message || "Report entry added successfully.");
            handleReset();
            await loadReportEntries(form.catCode.trim());
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to add report entry.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = async (e?: FormEvent) => {
        if (e) e.preventDefault();

        if (selectedRepIdNo === null || !selectedCatCode) {
            toast.error("Please select a report entry to edit.");
            return;
        }

        if (!form.catCode.trim() || !form.repName.trim()) {
            toast.error("Category and Name are required.");
            return;
        }

        if (selectedParameters.length === 0) {
            toast.error("At least one parameter is required.");
            return;
        }

        setIsSubmitting(true);

        try {
            let generatedPath = form.path;
            if (selectedImageFile) {
                generatedPath = await uploadImage(form.repId.trim().toUpperCase());
            }

            const paramList = buildParamListValue(
                parameters.map((item) => item.paraName),
                selectedParameters
            );

            const response = await fetch(
                `/misapi/api/reportentry/${selectedRepIdNo}/${encodeURIComponent(selectedCatCode)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        catCode: form.catCode.trim(),
                        repName: form.repName.trim(),
                        paramList,
                        favorite: form.favorite ? 1 : 0,
                        active: form.active ? 1 : 0,
                        description: form.description.trim(),
                        path: generatedPath,
                    }),
                }
            );

            const payload = await response.json();

            if (payload?.errorMessage) {
                throw new Error(payload.errorDetails ? `${payload.errorMessage} Details: ${payload.errorDetails}` : payload.errorMessage);
            }

            if (payload?.data && !payload.data.success) {
                throw new Error(payload.data.message || "Failed to update report entry.");
            }

            toast.success(payload?.data?.message || "Report entry updated successfully.");
            handleReset();
            await loadReportEntries(form.catCode.trim());
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update report entry.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = () => {
        if (selectedRepIdNo === null || !selectedCatCode) {
            toast.error("No entry selected for deletion.");
            return;
        }

        const selectedEntry = entries.find(
            (entry) =>
                Number(entry.repIdNo) === Number(selectedRepIdNo) &&
                entry.catCode.trim().toUpperCase() === selectedCatCode.trim().toUpperCase()
        );

        if (!selectedEntry) {
            toast.error("Selected report entry was not found. Please refresh and select again.");
            return;
        }

        setDeleteTargetEntry(selectedEntry);
    };

    const confirmDelete = async () => {
        if (!deleteTargetEntry) {
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(
                `/misapi/api/reportentry/${deleteTargetEntry.repIdNo}/${encodeURIComponent(deleteTargetEntry.catCode)}`,
                {
                    method: "DELETE",
                }
            );

            const payload = await response.json();

            if (payload?.errorMessage) {
                throw new Error(payload.errorDetails ? `${payload.errorMessage} Details: ${payload.errorDetails}` : payload.errorMessage);
            }

            if (payload?.data && !payload.data.success) {
                throw new Error(payload.data.message || "Failed to delete report entry.");
            }

            toast.success(payload?.data?.message || "Report entry deleted successfully.");
            setDeleteTargetEntry(null);
            handleReset();
            await loadReportEntries();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete report entry.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRowDoubleClick = (entry: ReportEntryRecord) => {
        const normalizedCatCode = entry.catCode.toString().trim().toUpperCase();

        setSelectedRepIdNo(entry.repIdNo);
        setSelectedCatCode(normalizedCatCode);
        setForm({
            repIdNo: entry.repIdNo,
            repId: entry.repId,
            catCode: normalizedCatCode,
            repName: entry.repName,
            description: entry.description || "",
            path: entry.path || "",
            favorite: entry.active === 1 && entry.favorite === 1,
            active: entry.active === 1,
        });
        setSelectedParameters(extractParamsFromList(entry.paramList));
        setSelectedImageFile(null);
        setImagePreviewUrl(null);
        setMode("edit");
    };

    const handleReset = () => {
        setForm(initialForm);
        setSelectedImageFile(null);
        setImagePreviewUrl(null);
        setMode("add");
        setSelectedRepIdNo(null);
        setSelectedCatCode(null);
        setSelectedParameters([]);
        setActiveCategoryFilter("");
        setSearchQuery("");
        loadReportEntries("");
        loadNextId();
    };

    useEffect(() => {
        loadCategories();
        loadReportEntries();
        loadParameters();
        loadNextId();
    }, []);

    const handleCategoryFilterClick = (catCode: string) => {
        setActiveCategoryFilter(catCode);
        setSelectedRepIdNo(null);
        setSelectedCatCode(null);
        setMode("add");
        setForm({ ...initialForm, catCode });
        setSelectedParameters([]);
        loadReportEntries(catCode);
        loadNextId();
    };

    const filteredEntries = entries.filter((entry) => {
        const matchesSearch = searchQuery.trim() === "" || 
            entry.repIdNo.toString().includes(searchQuery) ||
            entry.repId.toUpperCase().includes(searchQuery.toUpperCase()) ||
            entry.catCode.toUpperCase().includes(searchQuery.toUpperCase()) ||
            entry.repName.toUpperCase().includes(searchQuery.toUpperCase());
        return matchesSearch;
    });

    const normalizedSelectedCatCode = form.catCode.trim().toUpperCase();
    const categoryOptionValues = categories.map((c) => c.catCode);
    const categoryOptionLabels = categories.map((c) =>
        c.catName?.trim() ? `${c.catCode} - ${c.catName}` : c.catCode
    );

    if (
        normalizedSelectedCatCode &&
        !categoryOptionValues.includes(normalizedSelectedCatCode)
    ) {
        categoryOptionValues.unshift(normalizedSelectedCatCode);
        categoryOptionLabels.unshift(normalizedSelectedCatCode);
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(122,0,0,0.08),_transparent_35%),linear-gradient(180deg,_#faf7f2_0%,_#f3efe7_100%)] px-2 py-4 text-stone-900">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="grid gap-6 xl:grid-cols-[minmax(0,40%)_minmax(0,60%)] xl:items-start">
                    <form
                        onSubmit={(event) => event.preventDefault()}
                        className="h-fit w-full rounded-[28px] border border-[#7A0000]/10 bg-white p-6 shadow-[0_16px_50px_rgba(122,0,0,0.08)]"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-semibold text-stone-900">Report Entry Form</h2>
                            </div>
                            <button
                                type="button"
                                onClick={loadCategories}
                                className="inline-flex items-center gap-2 rounded-full border border-[#7A0000]/20 px-4 py-2 text-sm font-medium text-[#7A0000] transition hover:border-[#7A0000]/40 hover:bg-[#7A0000]/5"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                                Refresh
                            </button>
                        </div>

                        <div className="mt-6 space-y-6">
                            <div className="grid gap-4">
                                <div className="flex gap-4">
                                    <Input
                                        label="Report ID NO"
                                        value={form.repIdNo === 0 ? "0" : form.repIdNo ? form.repIdNo.toString() : ""}
                                        onChange={(value) => {
                                            const nextValue = value.trim();
                                            setForm({
                                                ...form,
                                                repIdNo: nextValue === "" ? 0 : Number(nextValue),
                                            });
                                        }}
                                        placeholder="Enter report id no"
                                        type="number"
                                        disabled={mode === "edit"}
                                    />
                                    <Input
                                        label="Report ID"
                                        value={form.repId}
                                        onChange={(value) => setForm({ ...form, repId: value.toUpperCase() })}
                                        placeholder="e.g., REP01"
                                        disabled={mode === "edit"}
                                    />
                                </div>

                                <Select
                                    label="Category"
                                    value={form.catCode}
                                    onChange={(value) => setForm({ ...form, catCode: value.trim().toUpperCase() })}
                                    options={categoryOptionLabels}
                                    optionValues={categoryOptionValues}
                                    placeholder="Select a category"
                                />

                                <Input
                                    label="Report Name"
                                    value={form.repName}
                                    onChange={(value) => setForm({ ...form, repName: value })}
                                    placeholder="e.g., Monthly Summary"
                                />

                                <div>
                                    <label className="block">
                                        <span className="mb-1.5 block text-sm font-medium text-stone-700">Description</span>
                                        <textarea
                                            value={form.description}
                                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                                            placeholder="Enter report description (optional)"
                                            rows={3}
                                            className={fieldBaseClass}
                                        />
                                    </label>
                                </div>

                                <div>
                                    <label className="block">
                                        <span className="mb-1.5 block text-sm font-medium text-stone-700">Sample Report Image Upload</span>
                                        <div className="space-y-3">
                                            <input
                                                type="file"
                                                accept="image/png, image/jpeg, image/jpg"
                                                onChange={handleFileChange}
                                                className="w-full text-sm text-stone-600 file:mr-4 file:rounded-xl file:border-0 file:bg-[#7A0000]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#7A0000] hover:file:bg-[#7A0000]/20 cursor-pointer"
                                            />
                                            {imagePreviewUrl || (form.path ? resolveImagePath(form.path) : null) ? (
                                                <div className="relative rounded-2xl border border-stone-200 bg-stone-50/70 p-3 text-center">
                                                    <img
                                                        src={imagePreviewUrl || (form.path ? resolveImagePath(form.path)! : "")}
                                                        alt="Sample Report Preview"
                                                        className="mx-auto max-h-44 rounded-xl object-contain shadow-xs"
                                                    />
                                                    <p className="mt-2 text-xs text-stone-500 font-mono truncate">
                                                        {selectedImageFile ? `Selected: ${selectedImageFile.name}` : `Path: ${form.path}`}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border border-dashed border-stone-300 p-3 text-center text-xs text-stone-500">
                                                    No sample image selected or uploaded. (Only PNG, JPG, and JPEG allowed)
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                </div>

                                <div>
                                    <span className="mb-2 block text-sm font-medium text-stone-700">Report Parameters</span>
                                    <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-3">
                                        {isParametersLoading ? (
                                            <div className="text-xs text-stone-500">Loading parameters...</div>
                                        ) : parameters.length === 0 ? (
                                            <div className="text-xs text-stone-500">No parameters found in parameter table.</div>
                                        ) : (
                                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                {parameters.map((parameter) => {
                                                    const isChecked = selectedParameters.some(
                                                        (item) => item.toUpperCase() === parameter.paraName.toUpperCase()
                                                    );

                                                    return (
                                                        <Checkbox
                                                            key={parameter.paraName}
                                                            label={parameter.description || parameter.paraName}
                                                            checked={isChecked}
                                                            asImage
                                                            onChange={(checked) => {
                                                                setSelectedParameters((current) => {
                                                                    if (checked) {
                                                                        return Array.from(new Set([...current, parameter.paraName]));
                                                                    }
                                                                    return current.filter(
                                                                        (item) => item.toUpperCase() !== parameter.paraName.toUpperCase()
                                                                    );
                                                                });
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                                    <p className="text-xs font-semibold text-stone-600">Generated Parameters URL Pattern</p>
                                    <p className="mt-1 break-all font-mono text-xs text-[#8B0000]">
                                        {form.repId.trim()
                                            ? buildParamListValue(
                                                parameters.map((item) => item.paraName),
                                                selectedParameters
                                            )
                                            : "Enter Report ID to generate parameter URL pattern."}
                                    </p>
                                </div>

                                <div className="flex gap-6 mt-2">
                                    <Checkbox
                                        label="Add to Favourite :"
                                        checked={form.favorite}
                                        asImage
                                        onChange={(checked) => setForm({ ...form, favorite: checked })}
                                        disabled={!form.active}
                                    />
                                    <Checkbox
                                        label="Active Report :"
                                        checked={form.active}
                                        asImage
                                        onChange={(checked) =>
                                            setForm((current) => ({
                                                ...current,
                                                active: checked,
                                                favorite: checked,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => handleAdd()}
                                disabled={isSubmitting}
                                className={actionButtonPrimaryClass}
                            >
                                {isSubmitting ? "Saving..." : "ADD"}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleEdit()}
                                disabled={selectedRepIdNo === null || !selectedCatCode || isSubmitting}
                                className={actionButtonSoftClass}
                            >
                                {isSubmitting ? "Updating..." : "EDIT"}
                            </button>
                            <button
                                type="button"
                                disabled={selectedRepIdNo === null || !selectedCatCode || isSubmitting}
                                onClick={handleDelete}
                                className={actionButtonDarkClass}
                            >
                                DELETE
                            </button>
                            <button
                                type="button"
                                onClick={handleReset}
                                className={actionButtonLightClass}
                            >
                                RESET
                            </button>
                        </div>
                    </form>

                    <div className="w-full rounded-[28px] border border-[#7A0000]/10 bg-white p-6 shadow-[0_16px_50px_rgba(122,0,0,0.08)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 className="text-2xl font-semibold text-stone-900">Report Entry Table</h2>
                            <button
                                type="button"
                                onClick={() => loadReportEntries()}
                                className="inline-flex items-center gap-2 rounded-full border border-[#7A0000]/20 px-4 py-2 text-sm font-medium text-[#7A0000] transition hover:border-[#7A0000]/40 hover:bg-[#7A0000]/5"
                            >
                                <RefreshCw className={`h-4 w-4 ${isEntriesLoading ? "animate-spin" : ""}`} />
                                Refresh
                            </button>
                        </div>

                        <div className="mb-4 flex gap-3">
                            <select
                                value={activeCategoryFilter}
                                onChange={(e) => {
                                    const catCode = e.target.value;
                                    handleCategoryFilterClick(catCode);
                                }}
                                className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm outline-none transition focus:border-[#7A0000] focus:ring-2 focus:ring-[#7A0000]/10"
                            >
                                <option value="">All Categories</option>
                                {categories.map((category) => (
                                    <option key={category.catCode} value={category.catCode}>
                                        {category.catCode} - {category.catName}
                                    </option>
                                ))}
                            </select>

                            <div className="flex flex-1 items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                                    <input
                                        type="text"
                                        placeholder="Search report id or name"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm text-stone-700 shadow-sm outline-none transition focus:border-[#7A0000] focus:ring-2 focus:ring-[#7A0000]/10"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="inline-flex items-center gap-2 rounded-xl border border-[#7A0000]/25 bg-white px-6 py-2 text-sm font-semibold text-[#7A0000] transition hover:bg-[#7A0000]/5"
                                >
                                    <Search className="h-4 w-4" />
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50/40">
                            <div className="max-h-[520px] overflow-auto">
                                <table className="w-full border-collapse text-left text-sm">
                                    <thead className="sticky top-0 bg-stone-100 text-xs uppercase tracking-[0.15em] text-stone-500">
                                        <tr>
                                            <th className="border border-stone-200 px-3 py-2 text-center">Report ID NO</th>
                                            <th className="border border-stone-200 px-3 py-2">Category</th>
                                            <th className="border border-stone-200 px-3 py-2">Name</th>
                                            <th className="border border-stone-200 px-3 py-2">Parameters</th>
                                            <th className="border border-stone-200 px-3 py-2 text-center">Favorite</th>
                                            <th className="border border-stone-200 px-3 py-2 text-center">Active</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isEntriesLoading ? (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-8 text-center text-stone-500">
                                                    <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />
                                                    Loading report entries...
                                                </td>
                                            </tr>
                                        ) : filteredEntries.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-8 text-center text-stone-500">
                                                    No report entries found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredEntries.map((entry) => (
                                                <tr
                                                    key={`${entry.repIdNo}-${entry.catCode}-${entry.repId}`}
                                                    onClick={() => handleRowDoubleClick(entry)}
                                                    className={`cursor-pointer transition ${selectedRepIdNo === entry.repIdNo && selectedCatCode === entry.catCode ? "bg-blue-50" : "bg-white hover:bg-stone-50"}`}
                                                >
                                                    <td className="border border-stone-200 px-3 py-2 text-center">{entry.repIdNo ?? "-"}</td>
                                                    <td className="border border-stone-200 px-3 py-2">{entry.catCode || "-"}</td>
                                                    <td className="border border-stone-200 px-3 py-2 font-semibold text-stone-800">{entry.repId || "-"}</td>
                                                    <td className="border border-stone-200 px-3 py-2">{entry.paramList || "-"}</td>
                                                    <td className="border border-stone-200 px-3 py-2 text-center">{entry.favorite === 1 ? "Yes" : "No"}</td>
                                                    <td className="border border-stone-200 px-3 py-2 text-center">{entry.active === 1 ? "Yes" : "No"}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {deleteTargetEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 px-4">
                    <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
                        <h3 className="text-lg font-semibold text-stone-900">Delete Report Entry</h3>
                        <p className="mt-2 text-sm text-stone-600">
                            Are you sure you want to delete this report entry?
                        </p>

                        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                            <p><span className="font-semibold text-stone-900">Report ID NO:</span> {deleteTargetEntry.repIdNo}</p>
                            <p><span className="font-semibold text-stone-900">Report ID:</span> {deleteTargetEntry.repId || "-"}</p>
                            <p><span className="font-semibold text-stone-900">Category:</span> {deleteTargetEntry.catCode || "-"}</p>
                        </div>

                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteTargetEntry(null)}
                                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="rounded-lg bg-[#8E8E8E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7A7A7A] disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Input = ({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    disabled
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
}) => (
    <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
        <input
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className={fieldBaseClass}
            disabled={disabled}
        />
    </label>
);

const Select = ({
    label,
    value,
    onChange,
    options,
    optionValues,
    placeholder,
    disabled
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    optionValues?: string[];
    placeholder?: string;
    disabled?: boolean;
}) => (
    <label className="block h-full">
        <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={fieldBaseClass}
            disabled={disabled}
        >
            <option value="">{placeholder ?? "Select an option"}</option>
            {options.map((option, index) => (
                <option key={option} value={optionValues?.[index] ?? option}>
                    {option}
                </option>
            ))}
        </select>
    </label>
);

const Checkbox = ({
    label,
    checked,
    onChange,
    disabled,
    asImage = false
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    asImage?: boolean;
}) => (
    <label className={`mt-1 flex items-center gap-2 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
        {asImage ? (
            <button
                type="button"
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                className="inline-flex h-6 w-6 items-center justify-center disabled:opacity-50"
                aria-label={label}
            >
                {checked ? (
                    <CheckSquare className="h-6 w-6 text-blue-600" />
                ) : (
                    <Square className="h-6 w-6 text-stone-400" />
                )}
            </button>
        ) : (
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="h-5 w-5 rounded-md border-stone-300 text-[#7A0000] focus:ring-[#7A0000] shadow-sm disabled:opacity-50"
                disabled={disabled}
            />
        )}
        <span className="text-sm font-semibold text-stone-800">{label}</span>
    </label>
);

export default ReportEntry;
