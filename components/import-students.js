"use client";
import { useEffect, useState } from "react";
import { importFields, suggestMapping, prepareRow } from "../lib/import.mjs";
import Dropdown from "./dropdown";
async function send(input) {
  const response = await fetch("/api/imports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "Import failed");
  return result;
}
export default function ImportStudents({ onChanged }) {
  const [rows, setRows] = useState([]),
    [columns, setColumns] = useState([]),
    [mapping, setMapping] = useState({}),
    [filename, setFilename] = useState(""),
    [client, setClient] = useState(""),
    [batches, setBatches] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(null),
    [session, setSession] = useState(null),
    [errors, setErrors] = useState([]);
  async function refresh() {
    const r = await fetch("/api/imports");
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    setBatches(data.batches);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  async function readFile(file) {
    if (!file) return;
    setRows([]);
    setSession(null);
    setProgress(null);
    setErrors([]);
    setError("");
    setBusy(true);
    try {
      if (file.size > 20 * 1024 * 1024)
        throw Error("Use a file smaller than 20 MB");
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: "",
        blankrows: true,
      });
      const headers = (grid[0] || []).map((v) => String(v).trim());
      if (
        !headers.length ||
        headers.some((h) => !h) ||
        new Set(headers).size !== headers.length
      )
        throw Error(
          "The first row must contain unique, non-empty column headers",
        );
      // Keep blank worksheet rows so error row numbers match Excel.
      const parsed = grid
        .slice(1)
        .map((cells) =>
          Object.fromEntries(
            headers.map((h, i) => [h, String(cells[i] ?? "")]),
          ),
        );
      if (!parsed.length || parsed.length > 100000)
        throw Error("Use a worksheet with 1–100,000 rows");
      setRows(parsed);
      setColumns(headers);
      setFilename(file.name);
      setMapping(suggestMapping(headers));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function mappedRow(row) {
    const used = new Set(Object.values(mapping).filter(Boolean));
    return {
      ...Object.fromEntries(
        Object.keys(importFields).map((k) => [k, row[mapping[k]] || ""]),
      ),
      extra_fields: Object.fromEntries(
        Object.entries(row).filter(([k]) => !used.has(k)),
      ),
      source: row,
    };
  }
  async function upload(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const mappedColumns = Object.values(mapping).filter(Boolean);
      if (
        !mapping.name ||
        !mapping.phone ||
        new Set(mappedColumns).size !== mappedColumns.length
      )
        throw Error("Map name and phone, and use each column only once");
      let current = session;
      if (!current) {
        const result = await send({
          action: "start",
          filename,
          client,
          mapping,
          total: rows.length,
        });
        current = {
          id: result.batch.id,
          offset: 0,
          index: 0,
          imported: 0,
          review_count: 0,
          failed: 0,
        };
        setSession(current);
        setErrors([]);
      }
      while (current.offset < rows.length) {
        const chunk = [];
        let bytes = 0;
        for (
          let i = current.offset;
          i < Math.min(rows.length, current.offset + 200);
          i++
        ) {
          const row = mappedRow(rows[i]);
          const size = new TextEncoder().encode(JSON.stringify(row)).length;
          if (size > 1500000)
            throw Error(`Worksheet row ${i + 2} is too large to upload`);
          if (chunk.length && bytes + size > 1500000) break;
          chunk.push(row);
          bytes += size;
        }
        const result = await send({
          action: "chunk",
          id: current.id,
          index: current.index,
          rows: chunk,
        });
        current = {
          ...current,
          offset: current.offset + chunk.length,
          index: current.index + 1,
          imported: current.imported + result.imported,
          review_count: current.review_count + result.review_count,
          failed: current.failed + result.errors.length,
        };
        setErrors((previous) => [...previous, ...result.errors]);
        setSession(current);
        setProgress(current);
      }
      await send({ action: "finish", id: current.id });
      setRows([]);
      setSession(null);
      await refresh();
      await onChanged();
    } catch (e) {
      setError(
        `${e.message}. Saved chunks are preserved; retry to continue, or delete the import.`,
      );
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function downloadErrors(batch) {
    try {
      const r = await fetch(`/api/imports?id=${encodeURIComponent(batch.id)}`);
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      const blob = new Blob([JSON.stringify(data.errors, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `${batch.filename}-errors.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(batch) {
    const confirm = window.prompt(
      `Permanently delete ${batch.filename}? This deletes students created by this import, including their call history and follow-ups. Existing students are preserved. Other imports’ incoming records are preserved for review. Type the filename to confirm.`,
    );
    if (confirm === null) return;
    setBusy(true);
    setError("");
    try {
      await send({ action: "delete", id: batch.id, confirm });
      if (session?.id === batch.id) {
        setSession(null);
        setRows([]);
      }
      await refresh();
      await onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel padded">
      <h2>Import students</h2>
      <p className="muted">
        XLSX, XLS or CSV · first worksheet, headers in row 1 · up to 100,000
        rows and 20 MB. Your browser reads the file; only row data is uploaded
        in bulk.
      </p>
      {error && <p role="alert">{error}</p>}
      <label className="upload">
        Choose a student file
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={busy || !!session}
          onChange={(e) => readFile(e.target.files[0])}
        />
      </label>
      {rows.length > 0 && (
        <form onSubmit={upload}>
          <h3>
            {filename} · {rows.length.toLocaleString()} rows
          </h3>
          <fieldset disabled={busy || !!session}>
            <label>
              Client / source name
              <input
                required
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </label>
            <div className="mapping">
              {Object.entries(importFields).map(([key, label]) => (
                <label key={key}>
                  {label}
                  {["name", "phone"].includes(key) ? " *" : ""}
                  <Dropdown
                    aria-label={`${label} column`}
                    value={mapping[key] || ""}
                    disabled={busy || !!session}
                    required={["name", "phone"].includes(key)}
                    onChange={(value) =>
                      setMapping({ ...mapping, [key]: value })
                    }
                    options={[
                      { value: "", label: "Not mapped" },
                      ...columns.map((c) => ({ value: c, label: c })),
                    ]}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <p className="muted">
            Unmapped columns are saved as extra fields. Phone matches are
            imported into the review queue for a manager’s decision. Invalid
            rows are reported and skipped.
          </p>
          <h3>Preview · first 5 rows</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {Object.values(importFields).map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => {
                  const mapped = mappedRow(row);
                  let validation = "Ready";
                  try {
                    prepareRow(mapped, client);
                  } catch (e) {
                    validation = e.message;
                  }
                  return (
                    <tr key={i}>
                      {Object.keys(importFields).map((k) => (
                        <td key={k}>{mapped[k]}</td>
                      ))}
                      <td>{validation}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button disabled={busy}>
            {busy
              ? "Importing…"
              : session
                ? "Retry / continue import"
                : "Confirm import"}
          </button>
        </form>
      )}
      {progress && (
        <div role="status" aria-live="polite">
          <p>
            {progress.offset.toLocaleString()} processed ·{" "}
            {progress.imported.toLocaleString()} students created ·{" "}
            {progress.review_count.toLocaleString()} awaiting review ·{" "}
            {progress.failed.toLocaleString()} errors
          </p>
          {rows.length > 0 && (
            <progress value={progress.offset} max={rows.length} />
          )}
        </div>
      )}
      {errors.length > 0 && (
        <details>
          <summary>Row errors ({errors.length})</summary>
          {errors.slice(0, 100).map((e) => (
            <p key={e.row}>
              Row {e.row}: {e.error}
            </p>
          ))}
          {errors.length > 100 && (
            <p>Download the complete report from import history.</p>
          )}
        </details>
      )}
      <h3>Import history</h3>
      <p className="muted">
        Interrupted imports retain saved rows. Retry in this tab, or delete the
        partial import before reuploading. Legacy imports have no reliable
        student creation tracking and cannot be deleted here.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>File / client</th>
              <th>Uploaded by</th>
              <th>Status</th>
              <th>Processed</th>
              <th>Created</th>
              <th>Sent to review</th>
              <th>Errors</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.filename}
                  <br />
                  {b.client}
                  <br />
                  {new Date(b.created_at).toLocaleString()}
                </td>
                <td>{b.author_name}</td>
                <td>{b.status}</td>
                <td>
                  {b.processed} / {b.total_rows}
                </td>
                <td>{b.imported}</td>
                <td>{b.review_count}</td>
                <td>{b.failed}</td>
                <td>
                  {b.failed > 0 && (
                    <button type="button" onClick={() => downloadErrors(b)}>
                      Error report
                    </button>
                  )}
                  {b.status !== "legacy" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(b)}
                    >
                      Delete import
                    </button>
                  )}
                  <details>
                    <summary>Column mapping</summary>
                    {Object.entries(b.mapping)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <p key={k}>
                          {importFields[k] || k}: {v}
                        </p>
                      ))}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
