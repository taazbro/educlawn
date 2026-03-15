# Contributing

## Scope

This repository is an open-source local-first studio for building student projects from documents, templates, and agent workflows.

Contributions are welcome in these areas:

- template packs
- plugin packs
- document parsers
- export targets
- UI workflows
- evaluation and benchmark coverage
- desktop packaging

## Development

Backend:

```bash
cd backend
uv sync
uv run pytest
uv run uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm run dev
```

Docker:

```bash
docker compose up --build
```

## Contribution Rules

- keep the local-first path working without any external API dependency
- do not remove or overwrite `Legacy_of_Justice.html`
- preserve deterministic fallbacks when adding optional AI features
- keep provenance and citation data attached to generated artifacts
- include tests when changing backend contracts or workflow behavior
- document any new template, plugin, or environment variable

## Templates

New templates should:

- declare a stable `id`
- define workflow stages and sections explicitly
- provide theme tokens and export targets
- work in deterministic `no-llm` mode

See [docs/TEMPLATE_SDK.md](/Users/tanjim/Downloads/educlawn/docs/TEMPLATE_SDK.md).

## Plugins

New plugins should ship a `plugin.json` manifest and clearly describe their capabilities.

See [docs/PLUGIN_SDK.md](/Users/tanjim/Downloads/educlawn/docs/PLUGIN_SDK.md).

## Content Licensing

- code contributions are accepted under Apache-2.0
- contributed educational content should use CC-BY or CC-BY-SA unless there is a specific reason not to
