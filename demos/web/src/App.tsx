import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import { createHighlighter } from "shiki";
import { niftty } from "niftty";
import { useResizeObserver } from "./useResizeObserver";
import * as shiki from "shiki";

import "@xterm/xterm/css/xterm.css";
import styles from "./App.module.scss";

const DEMO_CHUNK_SIZE = [15, 30] as const;
const DEMO_CHUNK_DELAY = [0, 30] as const;
const STREAM_WINDOW = 20;

function App() {
  const [node, setNode] = useState<HTMLDivElement>();
  const [before, setBefore] = useState<string>("Loading...");
  const [after, setAfter] = useState<string>("Loading...");
  const [streaming, setStreaming] = useState(false);
  const [theme, setTheme] = useState<string>("catppuccin-macchiato");
  const [highlighter, setHighlighter] = useState<shiki.Highlighter>();
  const [collapse, setCollapse] = useState(true);

  const lastScrollSyncRef = useRef<{
    source: "left" | "right" | "term";
    time: number;
  }>({ source: "left", time: 0 });

  const editorLeft = useRef<HTMLTextAreaElement>(null);
  const editorRight = useRef<HTMLTextAreaElement>(null);
  const termRef = useRef<{
    terminal: Terminal;
    fitAddon: FitAddon;
  }>();

  useEffect(() => {
    let cancel = false;
    (async () => {
      let highlighter = await createHighlighter({
        langs: ["tsx"],
        themes: [theme],
      });
      if (cancel) return;
      setHighlighter(highlighter);
    })();
    return () => {
      cancel = true;
    };
  }, [theme]);

  const syncScroll = (pctScroll: number, source: "left" | "right" | "term") => {
    if (
      lastScrollSyncRef.current.source !== source &&
      lastScrollSyncRef.current.time > Date.now() - 500
    ) {
      return;
    }
    lastScrollSyncRef.current = { source, time: Date.now() };
    if (source !== "term") {
      termRef.current?.terminal.scrollToLine(
        Math.floor(
          pctScroll * (termRef.current?.terminal.buffer.active.baseY || 0)
        )
      );
    }
    if (source !== "left" && editorLeft.current) {
      editorLeft.current.scrollTop =
        (editorLeft.current.scrollHeight - editorLeft.current.clientHeight) *
        pctScroll;
    }
    if (source !== "right" && editorRight.current) {
      editorRight.current.scrollTop =
        (editorRight.current.scrollHeight - editorRight.current.clientHeight) *
        pctScroll;
    }
  };

  useResizeObserver(() => termRef.current?.fitAddon.fit(), node, []);

  useEffect(() => {
    if (!node) return;
    const terminal = new Terminal({
      convertEol: true,
      fontFamily: "Google Sans Code",
      fontSize: 12,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(node);
    terminal.onScroll((top) => {
      if (
        lastScrollSyncRef.current.source !== "term" &&
        lastScrollSyncRef.current.time > Date.now() - 500
      ) {
        return;
      }
      syncScroll(top / (terminal.buffer.active.baseY || 1), "term");
    });
    termRef.current = { terminal, fitAddon };
    fitAddon.fit();

    (async () => {
      const [BEFORE, AFTER] = await Promise.all([
        fetch("fs/before").then((res) => res.text()),
        fetch("fs/after").then((res) => res.text()),
      ]);
      setBefore(BEFORE);
      setAfter(AFTER);
    })();

    return () => {
      termRef.current = undefined;
      terminal.dispose();
    };
  }, [node]);

  useEffect(() => {
    if (!termRef.current || !highlighter) return;
    let cancel = false;
    let terminal = termRef.current.terminal;
    terminal.clear();
    (async () => {
      if (streaming) {
        // streaming view
        let length = 0;
        while (!cancel && length < after.length) {
          length +=
            DEMO_CHUNK_SIZE[0] +
            Math.floor(
              Math.random() * (DEMO_CHUNK_SIZE[1] - DEMO_CHUNK_SIZE[0])
            );
          let curAfter = after.substring(0, length);
          terminal.write("\x1b[H");

          terminal.write(
            `${((curAfter.length / after.length) * 100).toFixed(0)}%\n\n`
          );
          terminal.write(
            await niftty({
              highlighter,
              code: curAfter,
              diffWith: before,
              streaming: STREAM_WINDOW,
              lang: "tsx",
              theme: theme as shiki.ThemeRegistrationAny,
              lineNumbers: true,
            })
          );

          await new Promise((resolve) => {
            setTimeout(
              resolve,
              DEMO_CHUNK_DELAY[0] +
                Math.floor(
                  Math.random() * (DEMO_CHUNK_DELAY[1] - DEMO_CHUNK_DELAY[0])
                )
            );
          });
        }
        setStreaming(false);
      } else {
        // regular view
        let out = await niftty({
          highlighter,
          code: after,
          diffWith: before,
          lang: "tsx",
          theme: theme as shiki.ThemeRegistrationAny,
          lineNumbers: "both",
          collapseUnchanged: collapse ? {
            padding: 3,
            separator: (u) => `\n··· ${u} unchanged ···\n`,
          } : undefined,
        });
        if (cancel) return;
        lastScrollSyncRef.current = { source: "left", time: Date.now() }; // avoid scroll feedback loop
        terminal.reset();
        terminal.clear();
        terminal.write(out);
        setTimeout(() => terminal.scrollToTop());
      }
    })();
    return () => {
      cancel = true;
    };
  }, [streaming, highlighter, theme, before, after, collapse]);

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <h1>Niftty</h1>
        <button disabled={streaming} onClick={() => setStreaming(true)}>Stream</button>
        <select value={theme} onChange={(e) => {
          setTheme(e.currentTarget.value);
          setHighlighter(undefined); // clear highlighter
        }}>
          {shiki.bundledThemesInfo.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
        <label><input type="checkbox" checked={collapse} onClick={ev => setCollapse(ev.currentTarget.checked)} />Collapse diffs</label>
      </div>
      <div className={styles.editorLeft}>
        <h2>diffWith</h2>
        <textarea
          ref={editorLeft}
          value={before}
          onScroll={(ev) => {
            syncScroll(
              ev.currentTarget.scrollTop /
                (ev.currentTarget.scrollHeight - ev.currentTarget.clientHeight),
              "left"
            );
          }}
          onInput={(ev) => setBefore(ev.currentTarget.value)}
        />
      </div>
      <div className={styles.terminalContainer}>
        <h2>Output (terminal)</h2>
        <div
          className={styles.terminal}
          ref={(node) => setNode(node || undefined)}
        />
      </div>
      <div className={styles.editorRight}>
        <h2>code</h2>
        <textarea
          className={styles.editorRight}
          ref={editorRight}
          value={after}
          onScroll={(ev) => {
            syncScroll(
              ev.currentTarget.scrollTop /
                (ev.currentTarget.scrollHeight - ev.currentTarget.clientHeight),
              "right"
            );
          }}
          onInput={(ev) => setAfter(ev.currentTarget.value)}
        />
      </div>
    </div>
  );
}

export default App;
