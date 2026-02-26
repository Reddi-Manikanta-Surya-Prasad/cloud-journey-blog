import { useEffect, useMemo, useState } from "react";
import { detectCodeRuntimeHint } from "../utils/richText";

export default function CodeBlock({ code, lang }) {
  const [html, setHtml] = useState("");
  const [copied, setCopied] = useState(false);
  const runHint = useMemo(
    () => detectCodeRuntimeHint(lang, code),
    [lang, code],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const mod = await import("highlight.js/lib/common");
        const hljs = mod.default;
        const highlighted =
          lang && lang !== "auto"
            ? hljs.highlight(code, { language: lang, ignoreIllegals: true })
                .value
            : hljs.highlightAuto(code).value;
        if (!cancelled) setHtml(highlighted);
      } catch {
        if (!cancelled)
          setHtml(
            code.replace(
              /[&<>]/g,
              (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch],
            ),
          );
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  return (
    <div className="code-block-shell">
      <div className="code-head">
        <span className="dot red" />
        <span className="dot yellow" />
        <span className="dot green" />
        <small>{lang || "code"}</small>
        <button
          type="button"
          className="ghost code-copy-btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            } catch {
              // no-op
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="code-block">
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      {runHint ? (
        <div className="code-run-hints">
          <span>
            Windows: <code>{runHint.windows}</code>
          </span>
          <span>
            Linux: <code>{runHint.linux}</code>
          </span>
          <span>
            Mac: <code>{runHint.mac}</code>
          </span>
        </div>
      ) : null}
    </div>
  );
}
