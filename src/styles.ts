export const debuggerStyles: string = `
  :host {
    --debug-bg: #202124;
    --debug-panel: #252629;
    --debug-panel-raised: #292a2d;
    --debug-border: #3c4043;
    --debug-border-soft: #303134;
    --debug-blue: #8ab4f8;
    --debug-blue-strong: #669df6;
    --debug-green: #81c995;
    --debug-red: #f28b82;
    --debug-yellow: #fdd663;
    --debug-text: #e8eaed;
    --debug-muted: #9aa0a6;
    --debug-faint: #74777d;
    --debug-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    color-scheme: dark;
    display: block;
    min-width: 300px;
  }

  * {
    box-sizing: border-box;
  }

  button,
  input {
    font: inherit;
  }

  button {
    color: inherit;
  }

  .shell {
    background: var(--debug-bg);
    border: 1px solid var(--debug-border);
    border-radius: 10px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
    color: var(--debug-text);
    display: grid;
    font: 12px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
    grid-template-rows: 34px 38px minmax(0, 1fr) 25px;
    height: 100%;
    min-height: 470px;
    overflow: hidden;
  }

  .tab-strip,
  .toolbar,
  .statusbar {
    align-items: center;
    display: flex;
  }

  .tab-strip {
    background: #292a2d;
    border-bottom: 1px solid var(--debug-border);
    justify-content: space-between;
  }

  .file-tab {
    align-items: center;
    align-self: stretch;
    background: var(--debug-bg);
    border: 0;
    border-right: 1px solid var(--debug-border);
    color: var(--debug-text);
    display: flex;
    font: 500 11px/1 var(--debug-mono);
    gap: 7px;
    min-width: 140px;
    padding: 0 13px;
  }

  .ts-badge {
    color: #4fc3f7;
    font: 700 10px/1 var(--debug-mono);
    letter-spacing: -0.04em;
  }

  .mode-badge {
    align-items: center;
    color: var(--debug-muted);
    display: flex;
    font: 10px/1 var(--debug-mono);
    gap: 7px;
    margin-right: 11px;
  }

  .mode-dot {
    background: var(--debug-blue);
    border-radius: 999px;
    box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.12);
    height: 6px;
    width: 6px;
  }

  .toolbar {
    background: #252629;
    border-bottom: 1px solid var(--debug-border);
    gap: 2px;
    padding: 0 7px;
  }

  .tool-button,
  .view-toggle,
  .section-toggle,
  .breakpoint-remove {
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .tool-button {
    align-items: center;
    border-radius: 4px;
    display: inline-flex;
    height: 28px;
    justify-content: center;
    padding: 0;
    position: relative;
    width: 30px;
  }

  .tool-button:hover:not(:disabled),
  .view-toggle:hover,
  .section-toggle:hover,
  .breakpoint-remove:hover {
    background: rgba(232, 234, 237, 0.08);
  }

  .tool-button:focus-visible,
  .view-toggle:focus-visible,
  .section-toggle:focus-visible,
  .breakpoint-remove:focus-visible {
    outline: 2px solid var(--debug-blue);
    outline-offset: -2px;
  }

  .tool-button:disabled {
    cursor: default;
    opacity: 0.32;
  }

  .tool-button svg {
    height: 15px;
    stroke-width: 1.8;
    width: 15px;
  }

  .tool-button[data-command="continue"] {
    color: var(--debug-blue);
  }

  .toolbar-separator {
    background: var(--debug-border);
    height: 19px;
    margin: 0 5px;
    width: 1px;
  }

  .view-toggle {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--debug-muted);
    cursor: pointer;
    font: 10px/1 var(--debug-mono);
    height: 24px;
    padding: 0 7px;
  }

  .view-toggle[aria-pressed="true"] {
    background: rgba(138, 180, 248, 0.12);
    border-color: rgba(138, 180, 248, 0.28);
    color: var(--debug-blue);
  }

  .pause-summary {
    color: var(--debug-muted);
    font: 10px/1.3 var(--debug-mono);
    margin-left: auto;
    max-width: min(46vw, 520px);
    overflow: hidden;
    padding-left: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pause-summary[data-status="paused"] {
    color: var(--debug-yellow);
  }

  .pause-summary[data-status="error"] {
    color: var(--debug-red);
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 31%);
    min-height: 0;
  }

  .editor-pane {
    min-height: 0;
    min-width: 0;
    position: relative;
  }

  .editor-host {
    height: 100%;
  }

  .sidebar {
    background: var(--debug-panel);
    border-left: 1px solid var(--debug-border);
    min-height: 0;
    overflow: auto;
  }

  .teaching-card {
    background: linear-gradient(135deg, rgba(138, 180, 248, 0.11), rgba(138, 180, 248, 0.025));
    border-bottom: 1px solid var(--debug-border);
    padding: 13px 14px 14px;
  }

  .teaching-kicker {
    color: var(--debug-blue);
    font: 600 9px/1.3 var(--debug-mono);
    letter-spacing: 0.08em;
    margin: 0 0 6px;
    text-transform: uppercase;
  }

  .teaching-title {
    font: 500 13px/1.4 var(--debug-mono);
    margin: 0 0 6px;
  }

  .teaching-copy {
    color: var(--debug-muted);
    font-size: 11px;
    line-height: 1.5;
    margin: 0;
  }

  .teaching-copy p,
  .question-prompt p,
  .solution-copy p {
    margin: 0;
  }

  .teaching-copy p + p,
  .question-prompt p + p,
  .solution-copy p + p {
    margin-top: 6px;
  }

  .teaching-copy code,
  .question-prompt code,
  .solution-copy code {
    background: rgba(138, 180, 248, 0.11);
    border-radius: 3px;
    color: var(--debug-blue);
    font: 10px/1.4 var(--debug-mono);
    padding: 1px 3px;
  }

  .teaching-question {
    border-top: 1px solid rgba(138, 180, 248, 0.2);
    margin-top: 11px;
    padding-top: 10px;
  }

  .question-label,
  .solution-label {
    color: var(--debug-blue);
    font: 600 9px/1.3 var(--debug-mono);
    letter-spacing: 0.08em;
    margin: 0 0 5px;
    text-transform: uppercase;
  }

  .question-prompt,
  .solution-copy {
    color: var(--debug-text);
    font-size: 11px;
    line-height: 1.5;
  }

  .question-response {
    background: rgba(32, 33, 36, 0.78);
    border: 1px solid var(--debug-border);
    border-radius: 4px;
    color: var(--debug-text);
    display: block;
    font: 10px/1.45 var(--debug-mono);
    margin-top: 8px;
    min-height: 48px;
    padding: 6px 7px;
    resize: vertical;
    width: 100%;
  }

  .question-response:focus {
    border-color: var(--debug-blue-strong);
    outline: none;
  }

  .solution-toggle {
    background: rgba(138, 180, 248, 0.1);
    border: 1px solid rgba(138, 180, 248, 0.28);
    border-radius: 4px;
    color: var(--debug-blue);
    cursor: pointer;
    font: 10px/1 var(--debug-mono);
    margin-top: 7px;
    padding: 6px 8px;
  }

  .solution-toggle:hover {
    background: rgba(138, 180, 248, 0.17);
  }

  .teaching-solution {
    background: rgba(129, 201, 149, 0.07);
    border-left: 2px solid var(--debug-green);
    margin-top: 9px;
    padding: 7px 8px;
  }

  .solution-label {
    color: var(--debug-green);
  }

  .ast-token {
    background: rgba(138, 180, 248, 0.13);
    border: 1px solid rgba(138, 180, 248, 0.25);
    border-radius: 3px;
    color: var(--debug-blue);
    display: inline-block;
    font: 10px/1 var(--debug-mono);
    margin-top: 9px;
    padding: 4px 6px;
  }

  .panel-section {
    border-bottom: 1px solid var(--debug-border);
  }

  .section-toggle {
    align-items: center;
    display: flex;
    font-size: 11px;
    font-weight: 600;
    height: 30px;
    padding: 0 9px;
    text-align: left;
    width: 100%;
  }

  .section-toggle svg {
    height: 13px;
    margin-right: 5px;
    transition: transform 120ms ease;
    width: 13px;
  }

  .panel-section[data-collapsed="true"] .section-toggle svg {
    transform: rotate(-90deg);
  }

  .panel-section[data-collapsed="true"] .section-content {
    display: none;
  }

  .section-count {
    background: rgba(154, 160, 166, 0.14);
    border-radius: 999px;
    color: var(--debug-muted);
    font: 9px/1 var(--debug-mono);
    margin-left: auto;
    padding: 3px 6px;
  }

  .section-content {
    padding: 2px 0 8px;
  }

  .empty-state {
    color: var(--debug-faint);
    font-size: 10px;
    padding: 5px 13px 8px 27px;
  }

  .scope-group + .scope-group {
    border-top: 1px solid rgba(60, 64, 67, 0.65);
    margin-top: 4px;
    padding-top: 4px;
  }

  .scope-name {
    color: var(--debug-muted);
    font-size: 10px;
    padding: 4px 11px 3px;
  }

  .value-row,
  .frame-row,
  .breakpoint-row,
  .console-row {
    min-height: 24px;
  }

  .value-row {
    align-items: baseline;
    display: grid;
    font: 10px/1.45 var(--debug-mono);
    gap: 6px;
    grid-template-columns: minmax(74px, 0.8fr) minmax(0, 1.3fr);
    padding: 3px 10px 3px 18px;
  }

  .value-name {
    color: #bdc1c6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value-kind {
    color: #6f747a;
    font-size: 8px;
    margin-right: 4px;
  }

  .value-preview {
    color: #c7c9cc;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .value-string {
    color: #f28b82;
  }

  .value-number,
  .value-boolean {
    color: #8ab4f8;
  }

  .value-nullish {
    color: #a7aab0;
    font-style: italic;
  }

  details.object-value summary {
    cursor: pointer;
    list-style-position: outside;
  }

  .object-properties {
    border-left: 1px solid var(--debug-border);
    margin: 4px 0 2px 5px;
    padding-left: 7px;
  }

  .object-property {
    display: grid;
    gap: 5px;
    grid-template-columns: minmax(46px, 0.7fr) minmax(0, 1fr);
    padding: 2px 0;
  }

  .property-key {
    color: #bdc1c6;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .frame-row {
    align-items: center;
    display: grid;
    font: 10px/1.3 var(--debug-mono);
    gap: 8px;
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 4px 11px 4px 19px;
  }

  .frame-row:first-child {
    background: rgba(138, 180, 248, 0.08);
  }

  .frame-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .frame-location {
    color: var(--debug-blue);
  }

  .breakpoint-row {
    align-items: center;
    display: grid;
    font: 10px/1.3 var(--debug-mono);
    gap: 7px;
    grid-template-columns: 10px minmax(0, 1fr) auto;
    padding: 4px 7px 4px 19px;
  }

  .breakpoint-dot {
    background: #e35b66;
    border-radius: 50%;
    height: 7px;
    width: 7px;
  }

  .breakpoint-location {
    color: var(--debug-blue);
  }

  .breakpoint-remove {
    border-radius: 3px;
    color: var(--debug-muted);
    font-size: 14px;
    height: 20px;
    line-height: 1;
    width: 20px;
  }

  .console-row {
    border-top: 1px solid rgba(60, 64, 67, 0.55);
    display: grid;
    font: 10px/1.45 var(--debug-mono);
    gap: 6px;
    grid-template-columns: 12px minmax(0, 1fr);
    padding: 5px 10px;
  }

  .console-row[data-level="warn"] {
    background: rgba(253, 214, 99, 0.06);
    color: var(--debug-yellow);
  }

  .console-row[data-level="error"] {
    background: rgba(242, 139, 130, 0.06);
    color: var(--debug-red);
  }

  .console-prefix {
    color: var(--debug-faint);
    user-select: none;
  }

  .statusbar {
    background: #1b1c1e;
    border-top: 1px solid var(--debug-border);
    color: var(--debug-muted);
    font: 9px/1 var(--debug-mono);
    gap: 13px;
    padding: 0 9px;
  }

  .statusbar-state {
    align-items: center;
    display: flex;
    gap: 6px;
  }

  .status-indicator {
    background: var(--debug-muted);
    border-radius: 50%;
    height: 5px;
    width: 5px;
  }

  .statusbar-state[data-status="paused"] .status-indicator {
    background: var(--debug-yellow);
  }

  .statusbar-state[data-status="running"] .status-indicator {
    animation: pulse 1s ease-in-out infinite;
    background: var(--debug-blue);
  }

  .statusbar-state[data-status="complete"] .status-indicator {
    background: var(--debug-green);
  }

  .statusbar-state[data-status="error"] .status-indicator {
    background: var(--debug-red);
  }

  .statusbar-language {
    margin-left: auto;
  }

  @keyframes pulse {
    50% { opacity: 0.35; }
  }

  @media (max-width: 820px) {
    .shell {
      grid-template-rows: 34px 38px minmax(0, 1fr) 25px;
    }

    .workspace {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(300px, 55%) minmax(220px, 45%);
    }

    .sidebar {
      border-left: 0;
      border-top: 1px solid var(--debug-border);
    }

    .teaching-card {
      padding: 10px 12px;
    }

    .ast-token {
      margin-top: 5px;
    }

    .pause-summary {
      max-width: 44vw;
    }
  }

  @media (max-width: 520px) {
    .mode-badge,
    .pause-summary {
      display: none;
    }

    .toolbar {
      justify-content: center;
    }

    .workspace {
      grid-template-rows: minmax(280px, 50%) minmax(250px, 50%);
    }
  }
`;
