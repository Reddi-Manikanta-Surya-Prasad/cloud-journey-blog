import { useEffect, useRef, useState } from "react";

// Cache icon pack so we only fetch once per page session
let iconPackPromise = null;
function loadLogosIcons() {
  if (!iconPackPromise) {
    iconPackPromise = fetch(
      "https://unpkg.com/@iconify-json/logos@1/icons.json",
      { signal: AbortSignal.timeout(8000) },
    )
      .then((r) => r.json())
      .catch(() => null);
  }
  return iconPackPromise;
}

/**
 * Collapse bare newlines inside [...] and (...) regions.
 * Uses [^]*? (dotAll-equivalent) so it crosses line boundaries.
 */
function collapseMultilineLabels(code) {
  // Collapse newlines inside [...]
  let result = code.replace(/\[([^]*?)\]/g, (_, inner) => {
    if (!/\r?\n/.test(inner)) return `[${inner}]`;
    return `[${inner
      .replace(/\r?\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()}]`;
  });
  // Collapse newlines inside (...)
  result = result.replace(/\(([^)]*)\)/g, (_, inner) => {
    if (!/\r?\n/.test(inner)) return `(${inner})`;
    return `(${inner.replace(/\r?\n/g, " ").trim()})`;
  });
  return result;
}

/**
 * Convert architecture-beta diagram to a standard flowchart LR.
 * Called AFTER collapseMultilineLabels so all labels are single-line.
 */
function convertArchBetaToFlowchart(code) {
  const lines = code.split("\n");
  const nodes = [];
  const edges = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // service id(icon)[Label]  or  service id(icon)[Label] in group
    const svc = trimmed.match(/^service\s+(\w+)\s*\([^)]*\)\s*\[([^\]]+)\]/);
    if (svc) {
      const label = svc[2].trim().replace(/"/g, "'");
      nodes.push({ id: svc[1], label });
      continue;
    }

    // id:Direction --> Direction:id  (architecture-beta connection syntax)
    const conn = trimmed.match(/^(\w+):[LRTB]\s*-->\s*[LRTB]:(\w+)/);
    if (conn) {
      edges.push(`    ${conn[1]} --> ${conn[2]}`);
      continue;
    }
  }

  if (nodes.length === 0) {
    return 'flowchart LR\n    A["Architecture Diagram"]';
  }
  const nodeDefs = nodes.map((n) => `    ${n.id}["${n.label}"]`).join("\n");
  return ["flowchart LR", nodeDefs, ...edges].join("\n");
}

/**
 * Pre-process mermaid code:
 *  1. Collapse multiline labels in [...] / (...)
 *  2. Convert architecture-beta → flowchart LR (architecture-beta needs
 *     specific icon packs that are often unavailable, causing render failures)
 */
function sanitizeMermaidCode(raw) {
  const normalised = collapseMultilineLabels(raw.trim());
  if (/^architecture-beta/i.test(normalised)) {
    return convertArchBetaToFlowchart(normalised);
  }
  return normalised;
}

export default function MermaidBlock({ code }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const iconsLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      try {
        const mermaidModule = await import("mermaid");
        // Support both default export and CJS-wrapped modules
        const mermaid = mermaidModule.default ?? mermaidModule;

        if (!iconsLoaded.current) {
          const icons = await loadLogosIcons();
          if (icons) {
            try {
              mermaid.registerIconPacks([{ name: "logos", icons }]);
            } catch {
              /* already registered */
            }
          }
          iconsLoaded.current = true;
        }

        mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

        const cleanCode = sanitizeMermaidCode(code);
        const id = `mmd-${Math.random().toString(36).slice(2, 10)}`;

        // In mermaid v11, render() throws on error — the try/catch IS the validation.
        // Do NOT check svg content for error strings: the embedded CSS stylesheet
        // in every valid mermaid SVG contains class names like .error-icon, .error {}
        // which would cause false-positive "error detected" results.
        const out = await mermaid.render(id, cleanCode);

        if (!cancelled) {
          setSvg(out.svg);
          setError("");
        }
      } catch (err) {
        console.error("[MermaidBlock] render failed:", err);
        if (!cancelled) setError("diagram");
      }
    };

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error === "diagram") {
    return (
      <div
        className="mermaid-block"
        style={{
          background: "rgba(128,128,128,0.08)",
          borderRadius: 8,
          padding: "12px 16px",
          border: "1px dashed rgba(128,128,128,0.3)",
        }}
      >
        <p
          style={{
            fontSize: "0.72rem",
            opacity: 0.45,
            margin: "0 0 8px",
            fontFamily: "monospace",
          }}
        >
          ⬡ Architecture Diagram (preview unavailable)
        </p>
        <pre
          style={{
            fontSize: "0.78rem",
            overflowX: "auto",
            margin: 0,
            whiteSpace: "pre-wrap",
            opacity: 0.8,
          }}
        >
          {code}
        </pre>
      </div>
    );
  }

  if (!svg)
    return (
      <p style={{ fontSize: "0.85rem", opacity: 0.45 }}>Rendering diagram…</p>
    );

  return (
    <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
