# Replace filter CSS section with clean dropdown CSS
$all = Get-Content "src\styles.css"
$n = $all.Count - 1
$prefix = $all[0..2582]   # Lines 1-2583 (before filter section)

$newCSS = @'

/* --- Level & Topic Filter Dropdowns -------------------------------- */
.filter-dropdowns-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.filter-select {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--border, rgba(0,0,0,0.12));
  background: var(--bg-elevated, rgba(255,255,255,0.08));
  color: var(--text, #213a61);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.17s, box-shadow 0.17s;
  min-width: 160px;
  appearance: auto;
}
.filter-select:focus {
  outline: none;
  border-color: var(--accent, #0ec5ff);
  box-shadow: 0 0 0 3px rgba(14, 197, 255, 0.18);
}
.filter-select:hover {
  border-color: var(--accent, #0ec5ff);
}
.filter-clear-btn {
  font-size: 0.8rem;
  padding: 7px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  color: var(--text-muted, #8899aa);
  cursor: pointer;
  transition: border-color 0.17s, color 0.17s;
}
.filter-clear-btn:hover { border-color: #ef4444; color: #ef4444; }
'@

($prefix + $newCSS) | Set-Content "src\styles.css" -Encoding UTF8
Write-Host "Done. styles.css lines: $((Get-Content 'src\styles.css').Count)"
