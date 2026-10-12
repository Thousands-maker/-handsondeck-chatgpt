# Offline use

Standard editing works from a single HTML file. Scripts, styles, the placeholder logo and deck images are embedded. There is no account requirement or automatic model download.

## Save an editable copy

Choose **Save & share → Download editable copy**. The file contains the editor, deck, original brief and embedded images, with a 10 MiB limit. Open it in a browser that supports local HTML. Download a fresh copy after editing. A presentation copy is for viewing; a project JSON needs an editor to reopen it.

Browser recovery saves the brief and deck locally when storage is available. It can be disabled and removed in Save & share. Storage failures and a newer draft in another tab are reported. Recovery is a convenience, not a file backup; keep an editable download before clearing browser data or changing devices.

## Standard and Supercharged

Standard organises up to 20,000 characters of free text into sentences and paragraphs while preserving wording. It does not synthesise an argument or rewrite content.

Supercharged runs WebLLM 0.2.86 in a dedicated worker using a compatible WebGPU device. Qwen2.5 0.5B is the smaller download (283.1 MiB); Qwen2.5 1.5B is the larger option (846.8 MiB). These totals cover runtime, compiled model library, configuration, tokenizer, tensor manifest and every weight shard. The app shell is saved separately and is under 1 MiB without user images. Runtime graphics memory needs are higher than download size; the setup screen gives an approximate allowance.

The first setup needs internet. Nothing is downloaded before the user chooses **Download & enable**. Input is capped at 2,400 combined characters and output at 1,050 tokens. A draft has 3–6 slides, one headline and 1–3 points per slide. Users review the proposal before applying; applying retains the original notes in the brief. The model can invent or omit information, so users must check facts and caveats.

## Download and storage boundaries

- `ai/models.json` lists exact bytes and SHA-256 hashes for every required asset. Model/configuration and compiled libraries use immutable revision URLs. The runtime is a checksum-locked CDN bundle of a fixed package version. A CDN rebundle fails closed and requires a reviewed catalogue update.
- HTTPS downloads omit credentials and referrer information. Each streamed response is stopped at its declared file limit, then checked for exact size and checksum before storage. There is no retry loop or automatic fallback provider.
- Cancellation preserves only previously verified files. Resume rechecks those files and fetches missing assets. Only one model is kept; selecting another removes the previous model after device/storage checks. Remove download clears this app’s model caches without clearing a deck or another app’s caches.
- The worker receives a read-only view of the verified cache. It verifies cached bytes again, blocks unknown URLs and replaces its fetch function with cache-only reads. Prompts and outputs remain local. Cached assets are not duplicated into shared vendor caches.
- Setup saves the app shell through a scoped service worker. The worker handles only this app’s navigation, not other projects on the same host. A small inference self-check must pass before the model is labelled ready.
- Keep the same browser profile and web address. Clearing site data, private browsing or storage eviction can remove the app/model. The app never silently redownloads missing weights. Return online and choose setup again when necessary.

A local `file://` editable copy supports Standard. It cannot register the service worker or share the HTTPS site’s model cache. It is not a portable offline AI package. For offline AI, first complete setup at the published web address, then reopen that address in the same browser. Check this on the actual device before relying on it without internet.

## Separate agent connection

[MCP setup](MCP.md) exposes local deck tools to a separately configured model or agent. Cloud hosts need internet; fully local hosts can use the tools offline. MCP does not automatically control this browser’s current deck.

## Verification

Automated tests exercise download boundaries, checksum failures, cancellation, cache-only worker failures, output validation and review/apply behaviour with mocked browser surfaces. Manifest files were checked against published model trees and tensor records; the runtime bundle has no external module imports. Actual WebGPU inference, real-browser offline reload, visual layout and model-writing quality have not been verified in the maintainer environment. Runtime self-checks help detect unsupported user devices but do not replace those tests.

## Technical references

- [WebLLM documentation](https://webllm.mlc.ai/docs/)
- [Model files](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/tree/main)
- [Browser storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
