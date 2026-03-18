## 1. Widget Loading Overlay (library core)

- [x] 1.1 Update `renderer.ts`: add loading overlay HTML/CSS inside the widget's Shadow DOM, shown by default when `createWidget()` is called
- [x] 1.2 Support `loadingMessages` parameter in `createWidget()` — cycle through messages with a CSS animation or interval
- [x] 1.3 Dismiss overlay (with fade-out) on first `widget.update()` call with real content
- [x] 1.4 Update `streaming.ts`: extract `loading_messages` and `title` from early partial args, pass to `renderer.createWidget()`
- [x] 1.5 Ensure `renderWidget()` (direct render path) also shows/dismisses loading overlay correctly

## 2. Demo Markdown Rendering

- [x] 2.1 Install `marked` and `DOMPurify` as npm dependencies
- [x] 2.2 Update `demo/main.ts`: replace `textEl.textContent = assistantText` with Markdown-rendered `innerHTML` (sanitized via DOMPurify)
- [x] 2.3 Add Markdown prose styles to `demo/style.css` (headings, lists, code blocks, links, tables, blockquotes)
- [x] 2.4 Handle streaming text updates — debounced markdown re-render (80ms) with final flush on stream completion

## 3. Validation

- [ ] 3.1 Manual test: send a message that triggers `read_me` + `show_widget` — confirm loading overlay appears and dismisses smoothly
- [ ] 3.2 Manual test: send a text-only message — confirm Markdown renders correctly (headings, bold, code, lists)
- [ ] 3.3 Manual test: verify dark mode and light mode for both loading overlay and Markdown styles
