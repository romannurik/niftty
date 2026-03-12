# Niftty CLI Demos & Playground

This directory contains interactive demos and a full-featured TUI playground for exploring Niftty's capabilities.

## 🎮 Playground

The main attraction is the **interactive TUI playground** powered by React Ink. It provides a complete interface for exploring all of Niftty's features.

### Running the Playground

```bash
npm run playground
```

Or make it executable and run directly:

```bash
chmod +x playground.tsx
./playground.tsx
```

### Features

The playground includes five modes:

#### 1. **RENDER Mode** - Basic Syntax Highlighting
- View beautifully highlighted code in various languages
- Switch between different themes in real-time
- Toggle line number display

#### 2. **DIFF Mode** - Side-by-side Diffs
- See code changes with inline diffs
- Highlight modified words and characters
- Collapse unchanged regions for better focus
- Switch between "before" and "after" line numbers

#### 3. **STREAM Mode** - LLM Streaming Simulation
- Simulates live code generation from an LLM
- Watch code appear incrementally with syntax highlighting
- Adjust streaming window size
- Perfect for testing streaming UX

#### 4. **SETTINGS** - Configuration Panel
- Configure all rendering options
- Line number display modes
- Collapse unchanged regions
- Streaming parameters

#### 5. **HELP** - Documentation
- Complete keyboard shortcuts reference
- Available themes and languages
- Mode-specific controls

### Keyboard Controls

#### Global
- **Tab** - Cycle through modes (Render → Diff → Stream → Settings → Help)
- **Q** - Quit the playground

#### Render/Diff/Stream Modes
- **← →** - Change theme (10 themes available)
- **↑ ↓** - Change language (TypeScript, Python, JSX, Rust)
- **L** - Toggle line numbers (true → both → false)

#### Diff Mode
- **C** - Toggle collapse unchanged regions

#### Stream Mode
- **S** - Start streaming simulation
- **R** - Reset stream progress

#### Settings Mode
- **1** - Toggle line numbers
- **2** - Toggle collapse unchanged
- **3** - Toggle streaming mode
- **4** - Increase stream window size
- **Shift+4** - Decrease stream window size

### Available Themes

- catppuccin-frappe
- everforest-dark
- rose-pine-moon
- github-dark
- github-light
- nord
- one-dark-pro
- tokyo-night
- dracula
- monokai

### Available Languages

- TypeScript (tsx)
- Python
- JSX
- Rust

## 📝 Simple Demos

The directory also includes simpler, focused demos:

### demo-big.mts
Shows a large diff with collapsed unchanged regions:

```bash
npm run demo:big
# or
./demo-big.mts
```

### demo-stream.mts
Demonstrates streaming code generation with animated output:

```bash
npm run demo:stream
# or
./demo-stream.mts
```

### demo-cjs.js
CommonJS example showing basic usage:

```bash
npm run demo:cjs
# or
node demo-cjs.js
```

## 🛠️ Development

The playground is built with:
- **React Ink** - Terminal UI framework
- **Niftty** - Code rendering engine
- **Shiki** - Syntax highlighting
- **tsx** - TypeScript execution

To modify the playground:
1. Edit `playground.tsx`
2. Run with `npm run playground`
3. The playground will load with your changes

## 📦 Package Scripts

```json
{
  "playground": "tsx playground.tsx",
  "demo:big": "tsx demo-big.mts",
  "demo:stream": "tsx demo-stream.mts",
  "demo:cjs": "node demo-cjs.js"
}
```

## 🎨 Customization

The playground includes sample code snippets for each language. To add your own:

1. Edit the `SAMPLE_CODES` and `SAMPLE_DIFFS` objects in `playground.tsx`
2. Add new languages to the `LANGUAGES` array
3. Add new themes to the `THEMES` array

## 💡 Tips

- Use **DIFF mode** to see how Niftty highlights changes at the character level
- Try **STREAM mode** to understand how to integrate Niftty with LLM streaming
- The **SETTINGS** screen shows all available configuration options
- Press **Q** from any mode except Settings to quickly exit

## 🐛 Troubleshooting

**"Raw mode is not supported"**: This error occurs when stdin doesn't support raw mode (e.g., when piping input). The playground needs an interactive terminal to capture keyboard input.

**Rendering issues**: Ensure your terminal supports 256 colors. Most modern terminals (iTerm2, Windows Terminal, GNOME Terminal, etc.) work great.

## 🚀 Next Steps

- Try modifying the sample code to see how diffs work
- Experiment with different themes to find your favorite
- Use the streaming mode to plan your LLM integration
- Check out the main Niftty documentation for API details
