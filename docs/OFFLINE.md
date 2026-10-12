# Offline use

Hands on Deck runs from a single HTML file. Its scripts, styles, placeholder logo and deck images are embedded. It makes no runtime network requests and has no account requirement.

## Save an editable copy

1. Open **Save & share**.
2. Review the file size and choose **Download editable copy**.
3. Open the downloaded HTML file in a browser that supports local HTML.

The download includes the editor and the current deck, brief, style and embedded images. It is limited to **10 MiB**. The editor refuses larger downloads and asks you to remove or reduce images. Nothing downloads until you select the button. A SHA-256 checksum is displayed when supported; it helps compare file bytes but is not a publisher signature.

A downloaded file is a snapshot. Download a new copy after making further changes. Refreshing or closing the editor without saving loses unsaved work. Mobile file preview apps may show the file without running its editor; use a compatible browser.

**Download presentation** creates a presentation for viewing. **Download editable copy** creates a copy for continued editing.

## Free-text capability in this version

Choose **Free text** in the Brief drawer to organise up to 20,000 characters into a suggested slide structure. The organiser groups paragraphs and sentences, preserves the supplied wording and uses short opening sentences as headings. It runs entirely on the device, including without internet.

This is a basic rule-based starting point. It does not infer the main argument, rewrite or summarise it intelligently, fact-check statements or use a language model. Review the structure and edit the wording before presenting.

## AI and agents through MCP

The optional local MCP server lets a compatible AI application or agent use the deck tools. The connected host supplies the model and can synthesise the user's brief, author a plan, review it and render a standalone presentation. This is separate from the basic free-text organiser in the HTML editor.

- A host using a cloud model needs internet while generating or revising content.
- A fully local host with its model already installed can run inference and the local MCP tools without internet, provided the host has no other network dependencies.
- The resulting self-contained presentation can be viewed offline regardless of where it was generated.

MCP does not download a model for the user. Configure the host and model separately using [MCP setup](MCP.md). This version does not synchronise a connected agent's plan with an open browser editor.

## Optional AI inside the browser: future design

True offline synthesis is possible with a language model running on the device. A browser implementation could use WebLLM and WebGPU to turn free text into a structured deck plan. This version does **not** install, download or run such a model.

An implementation would need:

- An explicit opt-in screen showing model identity, exact total download size, device requirements and a hard size limit before downloading.
- Pinned runtime, model, tokenizer and configuration assets, downloaded over HTTPS with hashes checked against a trusted manifest.
- Progress, cancellation, storage checks and a way to remove downloaded files.
- A check that every required asset is present, followed by a successful restart with networking blocked before showing “Ready offline”.
- Local-only inference with no automatic network fallback, bounded input/output lengths and validation of generated deck data.
- Evaluation of writing quality and actual desktop and mobile performance, plus source-text retention and user review of suggestions.

Small model weights can still require hundreds of megabytes; running them needs additional memory. The final cap must cover the complete download, not only the weights. Browser storage can be evicted, so readiness must be rechecked and any replacement download must require a new user action.

A cached web app would need separate hosting and storage work. Service workers require a suitable secure web origin and cannot be registered by an ordinary standalone `file://` editor. A downloaded HTML file alone is not a complete offline AI package.

## Technical references

- [WebLLM documentation](https://webllm.mlc.ai/docs/)
- [Example small-model files](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/tree/main)
- [Service worker registration](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
- [Browser storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
